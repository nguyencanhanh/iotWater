import mongoose from "mongoose";

// Trang thai chung cua bo giam sat. Khoa (lockUntil) dam bao chi MOT tien trinh chay
// moi luot, ke ca khi ban test va ban that cung tro vao mot database.
const monitorStateSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  // Cong tac tong tren web: tat thi ca 3 lich (15 phut, 5h30, 7h) deu bo qua, dong chu chay an.
  active: { type: Boolean, default: true },
  // Hai kenh bao dong lap: nhan Telegram va dong chu chay tren dau trang web.
  notify: { type: Boolean, default: false },
  ticker: { type: Boolean, default: true },
  // Mac dinh bao cao sang tao hoan toan tren may chu; bat thi Gemini viet lai loi van.
  aiReport: { type: Boolean, default: false },
  lockUntil: { type: Date, default: null },
  lockOwner: { type: String, default: "" },
  lastRunAt: { type: Date, default: null },
  lastRunMs: { type: Number, default: 0 },
  lastRunSummary: { type: Object, default: {} },
  lastError: { type: String, default: "" },
  // Nhieu logger cung mat tin hieu -> nghi loi phia may chu/MQTT/mang, bao 1 lan thay vi tung logger.
  widespreadSince: { type: Date, default: null },
  widespreadCount: { type: Number, default: 0 },
  widespreadNotified: { type: Boolean, default: false },
  lastMnfAt: { type: Date, default: null },
  lastReportAt: { type: Date, default: null },
  updatedBy: { type: String, default: "" },
}, { timestamps: true });

export default mongoose.model("MonitorState", monitorStateSchema);
