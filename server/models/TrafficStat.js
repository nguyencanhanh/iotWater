import mongoose from "mongoose";

const trafficStatSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: "global" },
  mobileVisits: { type: Number, default: 0, min: 0 },
  desktopVisits: { type: Number, default: 0, min: 0 },
  updatedAt: { type: Date, default: Date.now },
});

const TrafficStat = mongoose.model("TrafficStat", trafficStatSchema);

export default TrafficStat;
