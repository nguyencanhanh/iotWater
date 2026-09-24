import axios from "axios";
import { formatVnTime, getKindLabel } from "./common.js";

// Gui rieng qua Telegram (cung bot/chat voi canh bao cu). Khong dung ham trong mqtt.js
// vi ham do con ghi vao lich su canh bao cu (alarms) - giam sat co lich su rieng.

const monitorUrl = () => `${String(process.env.PUBLIC_WEB_URL || "").replace(/\/$/, "")}/admin-dashboard/monitor`;

export const sendTelegram = async (text) => {
  const token = process.env.TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: chatId,
        text: String(text).slice(0, 4000),
        disable_web_page_preview: true,
      }, { timeout: 15000 });
      return true;
    } catch (error) {
      console.error(`[monitor] Telegram lỗi (lần ${attempt}):`, error.response?.data?.description || error.message);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  return false;
};

export const notifyEventOpened = async (event) => {
  const text = [
    `🔴 GIÁM SÁT AI — ${getKindLabel(event.kind).toUpperCase()}`,
    `${event.sensorName} (${event.sensorId})${event.group ? ` · nhóm ${event.group}` : ""}`,
    event.message,
    `Phát hiện lúc ${formatVnTime(event.startAt, true)}`,
    monitorUrl(),
  ].join("\n");
  const sent = await sendTelegram(text);
  if (sent) {
    event.notifiedAt = new Date();
    event.notifiedLevel = event.level;
    await event.save();
  }
  return sent;
};

export const notifyEventClosed = async (event) => sendTelegram([
  `✅ Đã trở lại bình thường: ${event.sensorName} (${event.sensorId})`,
  `${getKindLabel(event.kind)} từ ${formatVnTime(event.startAt, true)} đến ${formatVnTime(event.endAt || new Date(), true)}`,
].join("\n"));
