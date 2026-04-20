import mongoose from "mongoose";

const PrvControl = new mongoose.Schema({
  id: {type: Number},
  user: {type: Number},
  control: {type: String},
  min: {type: Number},
  max: {type: Number},
  time: {type: Number},
  createAt: {type: Date, default: Date.now}
})

PrvControl.index({ createAt: -1 }, { expireAfterSeconds: 86400 });
const PrvC = mongoose.model("PrvControl", PrvControl)

export default PrvC;