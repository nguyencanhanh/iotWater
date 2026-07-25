import mongoose from "mongoose";

const aiUsageSchema = new mongoose.Schema({
  user: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  dateKey: { type: String, required: true },
  count: { type: Number, default: 0, min: 0 },
  expiresAt: { type: Date },
  updatedAt: { type: Date, default: Date.now },
});

aiUsageSchema.index({ user: 1, dateKey: 1 }, { unique: true });
aiUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AiUsage = mongoose.model("AiUsage", aiUsageSchema);

export default AiUsage;
