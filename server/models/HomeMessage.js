import mongoose from "mongoose";

const homeMessageSchema = new mongoose.Schema({
  user: { type: Number, default: 0, index: true },
  sender: { type: String, required: true, trim: true, maxlength: 80 },
  message: { type: String, required: true, trim: true, maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdByName: { type: String, trim: true },
  createAt: { type: Date, default: Date.now, index: true },
});

const HomeMessage = mongoose.model("HomeMessage", homeMessageSchema);

export default HomeMessage;
