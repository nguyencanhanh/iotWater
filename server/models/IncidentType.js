import mongoose from "mongoose";

// Loai su co 2 bac: bac 1 (parentId = null, vd "Phu kien PN 10") gom nhieu bac 2
// (vd "Cut ren ngoai 20"). Diem su co chon loai bac 2; bao cao tinh ty le theo bac 1.
const incidentTypeSchema = new mongoose.Schema({
  user: { type: Number, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "IncidentType", default: null },
  // Bieu tuong hien tren ban do cho loai bac 2 (xem frontend/src/components/map/pointIcons.js).
  icon: { type: String, trim: true, maxlength: 40, default: "drop" },
  sortOrder: { type: Number, default: 0 },
  createAt: { type: Date, default: Date.now },
});

incidentTypeSchema.index({ user: 1, parentId: 1, name: 1 }, { unique: true });
incidentTypeSchema.index({ user: 1, sortOrder: 1 });

const IncidentType = mongoose.model("IncidentType", incidentTypeSchema);

export default IncidentType;
