import mongoose from "mongoose";

// Hinh nguoi dung tu ve tren ban do: "zone" = vung (da giac, to mo theo mau chon),
// "pipe" = duong ong nuoc sach (duong gap khuc, net ve day theo co ong DN).
// Phan lop + thuoc tinh ong theo cach cua CityWork (ban do mang luoi cap nuoc).
export const PIPE_LAYERS = ["raw", "ttpp", "service", "branch"];
export const ZONE_LAYERS = ["zone"];
// Thiet bi dang diem (giong chu giai CityWork).
export const POINT_LAYERS = ["tee", "airValve", "drainValve", "gateValve", "connection", "hydrant", "tower", "pump", "masterMeter", "serviceMeter", "plant"];
const mapShapeSchema = new mongoose.Schema({
  user: { type: Number, required: true, index: true },
  kind: { type: String, enum: ["zone", "pipe", "point"], required: true },
  name: { type: String, trim: true, maxlength: 160, default: "" },
  color: { type: String, match: /^#[0-9a-fA-F]{6}$/, default: "#2563eb" },
  // Do mo cua phan to ben trong vung (0.05 - 0.7) de van nhin duoc ban do ben duoi.
  opacity: { type: Number, min: 0.05, max: 0.7, default: 0.25 },
  // Co ong (DN, mm) - chi cho duong ong.
  diameter: { type: Number, min: 0, max: 3000, default: 0 },
  // [[lat, lng], ...]: vung >= 3 dinh, duong ong >= 2 diem.
  coordinates: { type: [[Number]], required: true },
  note: { type: String, trim: true, maxlength: 1000, default: "" },
  // Lop: ong nuoc tho / truyen tai phan phoi (TTPP) / ong dich vu / nhanh dich vu; vung = "zone".
  layer: { type: String, enum: [...PIPE_LAYERS, ...ZONE_LAYERS, ...POINT_LAYERS], default: function defaultLayer() { return { pipe: "ttpp", point: "gateValve" }[this.kind] || "zone"; } },
  // Thuoc tinh ong (giong bang thuoc tinh CityWork).
  route: { type: String, trim: true, maxlength: 160, default: "" },
  material: { type: String, trim: true, maxlength: 60, default: "" },
  manager: { type: String, trim: true, maxlength: 160, default: "" },
  contractor: { type: String, trim: true, maxlength: 160, default: "" },
  supplyZone: { type: String, trim: true, maxlength: 160, default: "" },
  createdByName: { type: String, trim: true, maxlength: 120, default: "" },
}, { timestamps: true });

mapShapeSchema.index({ user: 1, kind: 1 });

export default mongoose.model("MapShape", mapShapeSchema);
