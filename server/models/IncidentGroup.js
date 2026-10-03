import mongoose from "mongoose";

// Khu vuc / nhom 2 bac: bac 1 (parentId = null) la phan vung, vd "TQL HVT"; bac 2 la
// tuyen trong vung, vd "SN 620 Le Loi". Tuyen giu so khach hang gan nhat (customers),
// thay doi theo thoi gian (xay them nha, lap / thao dong ho).
const incidentGroupSchema = new mongoose.Schema({
  user: { type: Number, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "IncidentGroup", default: null },
  customers: { type: Number, min: 0, default: 0 },
  sortOrder: { type: Number, default: 0 },
  createAt: { type: Date, default: Date.now },
});

incidentGroupSchema.index({ user: 1, parentId: 1, name: 1 }, { unique: true });
incidentGroupSchema.index({ user: 1, sortOrder: 1 });

const IncidentGroup = mongoose.model("IncidentGroup", incidentGroupSchema);

export default IncidentGroup;
