import mongoose from "mongoose";

const generalSettingSchema = new mongoose.Schema({
  user: { type: Number, required: true, unique: true },
  mapTooltipMinZoom: { type: Number, default: 15, min: 1, max: 22 },
  updatedAt: { type: Date, default: Date.now },
});

const GeneralSetting = mongoose.model("GeneralSetting", generalSettingSchema);

export default GeneralSetting;
