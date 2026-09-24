import mongoose from "mongoose";

const monitorReportSchema = new mongoose.Schema({
  user: { type: Number, required: true },
  kind: { type: String, default: "daily" },
  periodFrom: { type: Date, required: true },
  periodTo: { type: Date, required: true },
  stats: { type: Object, default: {} },
  summary: { type: String, default: "" },
  provider: { type: String, default: "" },
  aiError: { type: String, default: "" },
  sentAt: { type: Date, default: null },
}, { timestamps: true });

monitorReportSchema.index({ user: 1, periodTo: -1 });

export default mongoose.model("MonitorReport", monitorReportSchema);
