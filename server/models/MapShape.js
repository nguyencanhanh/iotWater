import mongoose from "mongoose";

// Hinh nguoi dung tu ve tren ban do: "zone" = vung (da giac, to mo theo mau chon),
// "pipe" = duong ong nuoc sach (duong gap khuc, net ve day theo co ong DN).
const mapShapeSchema = new mongoose.Schema({
  user: { type: Number, required: true, index: true },
  kind: { type: String, enum: ["zone", "pipe"], required: true },
  name: { type: String, trim: true, maxlength: 160, default: "" },
  color: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: "#2563eb" },
  // Do mo cua phan to ben trong vung (0.05 - 0.7) de van nhin duoc ban do ben duoi.
  opacity: { type: Number, min: 0.05, max: 0.7, default: 0.25 },
  // Co ong (DN, mm) - chi cho duong ong.
  diameter: { type: Number, min: 0, max: 3000, default: 0 },
  // [[lat, lng], ...]: vung >= 3 dinh, duong ong >= 2 diem.
  coordinates: { type: [[Number]], required: true },
  note: { type: String, trim: true, maxlength: 1000, default: "" },
  createdByName: { type: String, trim: true, maxlength: 120, default: "" },
}, { timestamps: true });

mapShapeSchema.index({ user: 1, kind: 1 });

export default mongoose.model("MapShape", mapShapeSchema);
