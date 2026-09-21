import { aiConfig, providerConfig, resolveProviderChain } from "./config.js";
import { isBreakerOpen, recordBreakerFailure, recordBreakerSuccess } from "./circuitBreaker.js";
import { acquireSlot, AiBusyError } from "./semaphore.js";
import { buildCacheKey, readCache, writeCache } from "./cache.js";

export class AiError extends Error {
  constructor(message, { statusCode = 502, retryable = false, provider = null, cause = null } = {}) {
    super(message);
    this.name = "AiError";
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.provider = provider;
    if (cause) this.cause = cause;
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 522, 524]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const backoffDelay = (attempt) => {
  const capped = Math.min(aiConfig.retryBaseDelayMs * 2 ** attempt, aiConfig.retryMaxDelayMs);
  return Math.round(capped / 2 + Math.random() * (capped / 2));
};

const logAi = (event, data) => {
  if (!aiConfig.logRequests) return;
  console.log(`[ai] ${event} ${JSON.stringify(data)}`);
};

// Timer được arm lại mỗi khi có dữ liệu mới nên stream dài vẫn sống,
// còn kết nối treo thì vẫn bị cắt sau timeoutMs.
const linkSignals = (external, timeoutMs) => {
  const controller = new AbortController();
  let timer = null;

  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);
  };

  const onAbort = () => controller.abort(external?.reason ?? new Error("aborted"));

  arm();
  if (external) {
    if (external.aborted) onAbort();
    else external.addEventListener("abort", onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    touch: arm,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      timer = null;
      external?.removeEventListener?.("abort", onAbort);
    },
  };
};

const postChatCompletion = async (provider, body, { signal, timeoutMs }) => {
  const { signal: linkedSignal, cleanup, touch } = linkSignals(signal, timeoutMs);
  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: linkedSignal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      cleanup();
      throw new AiError(`Provider ${provider.name} trả về HTTP ${response.status}`, {
        statusCode: response.status,
        retryable: RETRYABLE_STATUS.has(response.status),
        provider: provider.name,
        cause: detail.slice(0, 400),
      });
    }

    return { response, cleanup, touch };
  } catch (error) {
    cleanup();
    if (error instanceof AiError) throw error;
    if (signal?.aborted) {
      throw new AiError("Yêu cầu AI đã bị hủy", { statusCode: 499, retryable: false, provider: provider.name });
    }
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new AiError(`Provider ${provider.name} quá thời gian chờ`, {
        statusCode: 504,
        retryable: true,
        provider: provider.name,
      });
    }
    throw new AiError(`Không kết nối được provider ${provider.name}`, {
      statusCode: 503,
      retryable: true,
      provider: provider.name,
      cause: error.message,
    });
  }
};

const runOnce = async (provider, { messages, temperature, maxTokens, signal, timeoutMs }) => {
  const startedAt = Date.now();
  const { response, cleanup } = await postChatCompletion(
    provider,
    {
      model: provider.model,
      messages,
      temperature,
      stream: false,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
    },
    { signal, timeoutMs }
  );

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new AiError(`Provider ${provider.name} trả về dữ liệu không hợp lệ`, {
      statusCode: 502,
      retryable: true,
      provider: provider.name,
      cause: error.message,
    });
  } finally {
    cleanup();
  }

  const content = String(data?.choices?.[0]?.message?.content ?? "").trim();
  if (!content) {
    throw new AiError(`Provider ${provider.name} không trả về nội dung`, {
      statusCode: 502,
      retryable: true,
      provider: provider.name,
    });
  }

  return {
    content,
    model: data?.model || provider.model,
    provider: provider.name,
    usage: data?.usage || null,
    latencyMs: Date.now() - startedAt,
    cached: false,
  };
};

const runProviderWithRetry = async (provider, options) => {
  let lastError;
  for (let attempt = 0; attempt <= aiConfig.retryAttempts; attempt += 1) {
    try {
      const result = await runOnce(provider, options);
      recordBreakerSuccess(provider.name);
      logAi("ok", {
        provider: provider.name,
        model: result.model,
        attempt,
        latencyMs: result.latencyMs,
        chars: result.content.length,
      });
      return result;
    } catch (error) {
      lastError = error;
      if (error.statusCode === 499) throw error;
      recordBreakerFailure(provider.name);
      logAi("fail", { provider: provider.name, attempt, status: error.statusCode, message: error.message });
      if (!error.retryable || attempt === aiConfig.retryAttempts) break;
      await sleep(backoffDelay(attempt));
    }
  }
  throw lastError;
};

export const chatComplete = async ({
  messages,
  temperature = 0.2,
  maxTokens,
  signal,
  longForm = false,
  timeoutMs,
  cacheNamespace = null,
  cacheTtlSeconds,
  skipCache = false,
}) => {
  const chain = resolveProviderChain({ longForm });
  if (!chain.length) {
    throw new AiError("Chưa cấu hình provider AI khả dụng", { statusCode: 503, retryable: false });
  }

  const cacheKey = cacheNamespace && !skipCache
    ? buildCacheKey(cacheNamespace, { messages, temperature, longForm })
    : null;

  if (cacheKey) {
    const cached = await readCache(cacheKey);
    if (cached?.content) {
      logAi("cache-hit", { namespace: cacheNamespace, provider: cached.provider });
      return { ...cached, cached: true };
    }
  }

  const releaseSlot = await acquireSlot();
  try {
    let lastError;
    for (const name of chain) {
      if (isBreakerOpen(name)) {
        logAi("breaker-open", { provider: name });
        lastError = new AiError(`Provider ${name} đang tạm ngắt do lỗi liên tiếp`, {
          statusCode: 503,
          retryable: false,
          provider: name,
        });
        continue;
      }

      const provider = providerConfig[name];
      try {
        const result = await runProviderWithRetry(provider, {
          messages,
          temperature,
          maxTokens,
          signal,
          timeoutMs: timeoutMs || provider.timeoutMs,
        });
        if (cacheKey) await writeCache(cacheKey, result, cacheTtlSeconds);
        return result;
      } catch (error) {
        lastError = error;
        if (error.statusCode === 499) throw error;
      }
    }
    throw lastError || new AiError("Tất cả provider AI đều lỗi", { statusCode: 503 });
  } finally {
    releaseSlot();
  }
};

async function* readSseDeltas(response) {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary = buffer.indexOf("\n");
    while (boundary !== -1) {
      const line = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 1);
      boundary = buffer.indexOf("\n");
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // chunk hỏng: bỏ qua, stream vẫn tiếp tục
      }
    }
  }
}

export const streamChatComplete = async function* ({
  messages,
  temperature = 0.2,
  maxTokens,
  signal,
  longForm = true,
  timeoutMs,
}) {
  const chain = resolveProviderChain({ longForm });
  if (!chain.length) {
    throw new AiError("Chưa cấu hình provider AI khả dụng", { statusCode: 503, retryable: false });
  }

  const releaseSlot = await acquireSlot();
  try {
    let lastError;
    for (const name of chain) {
      if (isBreakerOpen(name)) {
        logAi("breaker-open", { provider: name });
        continue;
      }

      const provider = providerConfig[name];
      let stream;
      try {
        stream = await postChatCompletion(
          provider,
          {
            model: provider.model,
            messages,
            temperature,
            stream: true,
            ...(maxTokens ? { max_tokens: maxTokens } : {}),
          },
          { signal, timeoutMs: timeoutMs || provider.timeoutMs }
        );
      } catch (error) {
        lastError = error;
        if (error.statusCode === 499) throw error;
        recordBreakerFailure(name);
        continue;
      }

      const startedAt = Date.now();
      let emitted = 0;
      let streamError = null;
      try {
        for await (const delta of readSseDeltas(stream.response)) {
          stream.touch();
          emitted += delta.length;
          yield { type: "delta", text: delta, provider: name };
        }
      } catch (error) {
        streamError = error;
      } finally {
        stream.cleanup();
      }

      if (streamError && emitted > 0) {
        recordBreakerFailure(name);
        throw new AiError(`Provider ${name} đứt kết nối giữa chừng`, {
          statusCode: 502,
          retryable: false,
          provider: name,
          cause: streamError.message,
        });
      }

      if (streamError || emitted === 0) {
        recordBreakerFailure(name);
        lastError = new AiError(`Provider ${name} không trả về nội dung`, {
          statusCode: 502,
          retryable: true,
          provider: name,
          cause: streamError?.message,
        });
        continue;
      }

      recordBreakerSuccess(name);
      logAi("stream-ok", { provider: name, latencyMs: Date.now() - startedAt, chars: emitted });
      yield { type: "done", provider: name, model: provider.model, latencyMs: Date.now() - startedAt };
      return;
    }
    throw lastError || new AiError("Tất cả provider AI đều lỗi", { statusCode: 503 });
  } finally {
    releaseSlot();
  }
};

export { AiBusyError };
