import mongoose from "mongoose";

const dnpConfigSchema = new mongoose.Schema({
  user: { type: Number, required: true, unique: true },
  name: { type: String, default: "DNP" },
  loggerIds: { type: [Number], default: [] },
  updatedAt: { type: Date, default: Date.now },
});

const DnpConfig = mongoose.model("DnpConfig", dnpConfigSchema);

export default DnpConfig;
