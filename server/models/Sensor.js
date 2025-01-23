import mongoose from "mongoose";

const sensorSchema = new mongoose.Schema({
    index: { type: Number, required: true },
    Pressure: { type: Number },
    battery: { type: Number },
    createAt: {
        type: Date,
    },
});

const Sensor = mongoose.model("Sensor", sensorSchema)

export default Sensor;