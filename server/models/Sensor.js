import mongoose from "mongoose";

const sensorSchema = new mongoose.Schema({
    index: { type: Number, required: true, index: true },
    user: {type: Number, index: true},
    Pressure: { type: Number },
    battery: { type: Number },
    temperature: { type: Number },
    createAt: {
        type: Date,
        index: true
    },
});

const Sensor = mongoose.model("Sensor", sensorSchema)

export default Sensor;