import mongoose from "mongoose";

// Loai hinh phat hien (vd "Nghe", "Nghe dem", "Nghe phoi hop voi to") - nguoi dung tu them.
const incidentMethodSchema = new mongoose.Schema({
  user: { type: Number, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  sortOrder: { type: Number, default: 0 },
  createAt: { type: Date, default: Date.now },
});

incidentMethodSchema.index({ user: 1, name: 1 }, { unique: true });

const IncidentMethod = mongoose.model("IncidentMethod", incidentMethodSchema);

export default IncidentMethod;
