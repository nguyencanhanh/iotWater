import { aiConfig, providerConfig, resolveProviderChain, isProviderConfigured } from "./config.js";
import { getBreakerSnapshot } from "./circuitBreaker.js";
import { getQueueSnapshot } from "./semaphore.js";

export { chatComplete, streamChatComplete, AiError, AiBusyError } from "./client.js";
export { chatCompleteJson, extractJsonObject } from "./json.js";
export { aiConfig, providerConfig, resolveProviderChain, isProviderConfigured };

export const getAiHealth = () => ({
  primaryProvider: aiConfig.primaryProvider,
  fallbackProviders: aiConfig.fallbackProviders,
  activeChain: resolveProviderChain({ longForm: false }),
  longFormChain: resolveProviderChain({ longForm: true }),
  providers: Object.fromEntries(
    Object.entries(providerConfig).map(([name, provider]) => [
      name,
      {
        configured: isProviderConfigured(name),
        model: provider.model,
        timeoutMs: provider.timeoutMs,
        supportsLongForm: provider.supportsLongForm,
      },
    ])
  ),
  breakers: getBreakerSnapshot(),
  queue: getQueueSnapshot(),
  cache: {
    enabled: aiConfig.cacheEnabled,
    ttlSeconds: aiConfig.cacheTtlSeconds,
  },
});

// Ping nhẹ để biết provider còn sống, không tiêu tốn quota người dùng.
export const probeProviders = async ({ timeoutMs = 8000 } = {}) => {
  const results = {};
  await Promise.all(
    Object.entries(providerConfig).map(async ([name, provider]) => {
      if (!isProviderConfigured(name)) {
        results[name] = { ok: false, reason: "not-configured" };
        return;
      }
      const startedAt = Date.now();
      try {
        const response = await fetch(`${provider.baseUrl}/models`, {
          headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
          signal: AbortSignal.timeout(timeoutMs),
        });
        results[name] = {
          ok: response.ok,
          status: response.status,
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        results[name] = { ok: false, reason: error.message, latencyMs: Date.now() - startedAt };
      }
    })
  );
  return results;
};
