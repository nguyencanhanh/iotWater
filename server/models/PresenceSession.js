import mongoose from "mongoose";

const presenceSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  deviceType: { type: String, enum: ["mobile", "desktop"], required: true, index: true },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
});

presenceSessionSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const PresenceSession = mongoose.model("PresenceSession", presenceSessionSchema);

export default PresenceSession;
