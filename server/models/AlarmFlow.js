import mongoose from "mongoose";

const AlarmFlow = new mongoose.Schema({
  name: {type: String},
  message: { type: String },
  user: { type: Number },
  sensorId: { type: Number },
  sensorName: { type: String },
  group: { type: String },
  type: { type: String, default: "warning" },
  level: { type: String, default: "warning" },
  value: { type: Number },
  createAt: { type: Date, default: Date.now }
})

AlarmFlow.index({ user: 1, createAt: -1 });
AlarmFlow.index({ sensorId: 1, createAt: -1 });

const Alarm = mongoose.model("Alarm", AlarmFlow)

export default Alarm;
