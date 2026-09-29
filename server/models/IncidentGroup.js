import mongoose from "mongoose";

// Khu vuc / nhom cua diem su co - danh sach rieng do nguoi dung tu them / sua / xoa
// (khong dung chung voi nhom logger de sua o day khong anh huong den logger).
// Diem su co van luu ten nhom dang chuoi (MapPoint.group) de bao cao khong phai join.
const incidentGroupSchema = new mongoose.Schema({
  user: { type: Number, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  sortOrder: { type: Number, default: 0 },
  createAt: { type: Date, default: Date.now },
});

incidentGroupSchema.index({ user: 1, name: 1 }, { unique: true });
incidentGroupSchema.index({ user: 1, sortOrder: 1 });

const IncidentGroup = mongoose.model("IncidentGroup", incidentGroupSchema);

export default IncidentGroup;
