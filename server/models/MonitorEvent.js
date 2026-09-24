import mongoose from "mongoose";

// Mot "su kien" = mot hien tuong bat thuong keo dai (mo -> dong), khong phai moi lan do.
const monitorEventSchema = new mongoose.Schema({
  user: { type: Number, required: true },
  sensorId: { type: Number, required: true },
  sensorName: { type: String, default: "" },
  group: { type: String, default: "" },
  kind: {
    type: String,
    enum: ["pressure_drop", "pressure_surge", "flow_zero", "offline", "mnf_rise", "mnf_high"],
    required: true,
  },
  level: { type: String, enum: ["cao", "trung bình", "thấp"], default: "trung bình" },
  status: { type: String, enum: ["open", "closed"], default: "open" },
  startAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
  endAt: { type: Date, default: null },
  // Gia tri te nhat trong su kien va muc binh thuong cung khung gio de so sanh.
  value: { type: Number, default: null },
  expected: { type: Number, default: null },
  unit: { type: String, default: "" },
  message: { type: String, default: "" },
  normalStreak: { type: Number, default: 0 },
  // So ngay (trong 3 ngay qua) da co su kien cung loai, cung khung gio -> co the la lich van hanh.
  recurring: { type: Number, default: 0 },
  // "on" | "report": che do cua logger luc phat hien (report thi khong day thong bao).
  mode: { type: String, default: "on" },
  notifiedAt: { type: Date, default: null },
  notifiedLevel: { type: String, default: "" },
  feedback: { type: String, enum: ["confirmed", "false_alarm", null], default: null },
  feedbackNote: { type: String, default: "" },
  feedbackBy: { type: String, default: "" },
  feedbackAt: { type: Date, default: null },
}, { timestamps: true });

monitorEventSchema.index({ user: 1, status: 1, sensorId: 1, kind: 1 });
monitorEventSchema.index({ user: 1, startAt: -1 });

export default mongoose.model("MonitorEvent", monitorEventSchema);
