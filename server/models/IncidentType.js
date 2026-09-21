import mongoose from "mongoose";

// Loai su co do nguoi dung tu them (vi du "Nut gay cut ren 20"), giong cach them nhom logger.
const incidentTypeSchema = new mongoose.Schema({
  user: { type: Number, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  sortOrder: { type: Number, default: 0 },
  createAt: { type: Date, default: Date.now },
});

incidentTypeSchema.index({ user: 1, name: 1 }, { unique: true });
incidentTypeSchema.index({ user: 1, sortOrder: 1 });

const IncidentType = mongoose.model("IncidentType", incidentTypeSchema);

export default IncidentType;
