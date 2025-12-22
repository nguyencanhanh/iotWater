import mongoose from "mongoose";

const PrvTime = new mongoose.Schema({
  user: {type: Number},
  id: {type: Number},
  time: {type: String},
  minSetpoint: {type: Number},
  maxSetpoint: {type: Number}
})

const Prv = mongoose.model("PrvTime", PrvTime)

export default Prv;