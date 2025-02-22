import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "employee"], required: true },
  profileImage: { type: String },
  total: { type: Number, default: 0 },
  interval: { type: Number },
  sample: { type: Number },
  tracking: { type: Number },
  trackingB: { type: Number },
  temperature: { type: Number },
  sen_id: [{ name: String, id: Number, lat: Number, lng: Number }],
  createAt: { type: Date, default: Date.now },
})

const User = mongoose.model("User", userSchema)
export default User