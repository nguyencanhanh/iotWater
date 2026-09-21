import { chatComplete, AiError } from "./client.js";

export const extractJsonObject = (content) => {
  const text = String(content || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
};

// Gọi model rồi ép ra JSON. Nếu lần đầu hỏng thì gửi thêm 1 lượt "sửa lỗi"
// kèm chính output hỏng, thay vì bỏ cuộc ngay.
export const chatCompleteJson = async ({
  messages,
  validate = () => true,
  repairAttempts = 1,
  ...options
}) => {
  let conversation = messages;
  let lastRaw = "";

  for (let attempt = 0; attempt <= repairAttempts; attempt += 1) {
    const result = await chatComplete({
      ...options,
      messages: conversation,
      temperature: 0,
      skipCache: attempt > 0 ? true : options.skipCache,
    });

    lastRaw = result.content;
    const parsed = extractJsonObject(result.content);
    if (parsed && validate(parsed)) {
      return { data: parsed, meta: result };
    }

    if (attempt === repairAttempts) break;

    conversation = [
      ...messages,
      { role: "assistant", content: lastRaw.slice(0, 2000) },
      {
        role: "user",
        content: "Output vừa rồi không phải JSON hợp lệ theo schema. Trả lại DUY NHẤT một object JSON hợp lệ, không markdown, không giải thích.",
      },
    ];
  }

  throw new AiError("AI không trả về JSON hợp lệ", {
    statusCode: 502,
    retryable: false,
    cause: lastRaw.slice(0, 300),
  });
};
