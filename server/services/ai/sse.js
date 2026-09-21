import { streamChatComplete } from "./client.js";

const HEARTBEAT_MS = Number(process.env.AI_SSE_HEARTBEAT_MS) || 15000;

const send = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

export const openSseStream = (res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
};

// gemini-web2api chỉ đẩy chunk sau khi sinh xong toàn bộ nội dung, nên phải tự
// gửi heartbeat để nginx và trình duyệt không cắt kết nối giữa chừng.
export const pipeAiStream = async ({
  req,
  res,
  messages,
  temperature = 0.2,
  timeoutMs,
  onDone,
  onError,
}) => {
  const controller = new AbortController();
  const abort = () => controller.abort(new Error("client disconnected"));
  req.on("aborted", abort);
  res.on("close", () => {
    if (!res.writableEnded) abort();
  });

  openSseStream(res);
  send(res, "start", { at: new Date().toISOString() });

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, HEARTBEAT_MS);

  let full = "";
  try {
    for await (const chunk of streamChatComplete({
      messages,
      temperature,
      signal: controller.signal,
      longForm: true,
      timeoutMs,
    })) {
      if (res.writableEnded) break;
      if (chunk.type === "delta") {
        full += chunk.text;
        send(res, "delta", { text: chunk.text });
      } else if (chunk.type === "done") {
        const extra = (await onDone?.(full, chunk)) || {};
        send(res, "done", { provider: chunk.provider, model: chunk.model, latencyMs: chunk.latencyMs, ...extra });
      }
    }
  } catch (error) {
    if (!res.writableEnded && error?.statusCode !== 499) {
      const extra = (await onError?.(error)) || {};
      send(res, "error", {
        error: error.message || "AI không phản hồi",
        statusCode: error.statusCode || 502,
        ...extra,
      });
    } else if (error?.statusCode === 499) {
      await onError?.(error);
    }
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }

  return full;
};
