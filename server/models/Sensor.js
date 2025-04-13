import mongoose from "mongoose";

const sensorSchema = new mongoose.Schema({
    index: { type: Number, required: true},
    user: {type: Number},
    Pressure: { type: Number },
    battery: { type: Number },
    flow: {type: Number},
    temperature: { type: Number },
    createAt: {type: Date},
});
sensorSchema.index({ user: 1, createAt: 1, index: 1 });
const Sensor = mongoose.model("Sensor", sensorSchema);

export default Sensor;