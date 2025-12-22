import mongoose from "mongoose";

const prvSchema = new mongoose.Schema({
    index: { type: Number, required: true},
    user: {type: Number},
    Pressure1: { type: Number },
    Pressure2: { type: Number },
    Pressure3: { type: Number },
    battery: { type: Number },
    flow: {type: Number},
    temperature: { type: Number },
    createAt: { type: Date, required: true, default: Date.now },
});
prvSchema.index({ createAt: 1 }, { expireAfterSeconds: 2592000 });
const Prv_data = mongoose.model("PrvData", prvSchema);

export default Prv_data;