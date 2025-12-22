import mongoose from "mongoose";

const Prv = new mongoose.Schema({
  user: {type: Number},
  id: {type: Number},
  idMatch: {type: Number},
  mode: {type: Number},
  name: {type: String},
  unit: {type: Number},
  temperature: {type: Number},
  low: {type: Number},
  timeNextControl:{type: Number},
  percent: {type: Number},
  minSet: {type: Number},
  maxSet: {type: Number},
  minSetAM: {type: Number},
  time_top: {type: String},
  time_bot: {type: String},
  timeout1: {type: Number},
  timeout2: {type: Number},
  timeoutO: {type: Number},
  timeoutC: {type: Number},
  flowClose: {type: Number},
  flowOpen: {type: Number},
  tFlowClose: {type: String},
  tFlowOpen: {type: String},
  low: {type: Number},
  range: [Number],
  onOff: [Number],
  open1: [String],
  open2: [String],
  pConfig: [Number],
  pBot: [Number],
  timeAlarm: [Number],
  dayMap: [Number],
})

const PrvInfo = mongoose.model("Prv", Prv)

export default PrvInfo;