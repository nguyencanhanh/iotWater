import mongoose from "mongoose";

const AlarmFlow = new mongoose.Schema({
  name: {type: String},
  createAt: { type: Date, default: Date.now }
})

const Alarm = mongoose.model("Alarm", AlarmFlow)

export default Alarm;