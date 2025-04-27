import mongoose from "mongoose";

const AlarmFlow = new mongoose.Schema({
  user: {type: Number},
  id: {type: Number},
  name: {type: String},
  time: {type: String},
  flow: {type: Number}
})

const Alarm = mongoose.model("Alarm", AlarmFlow)

export default Alarm;