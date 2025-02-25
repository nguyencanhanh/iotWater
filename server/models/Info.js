import mongoose from "mongoose";

const infoSchema = new mongoose.Schema({
    tracking: {type: Number},
    trackingB: {type: Number},
    interval: {type: Number},
    display: {type: Number},
    id: {type: Number},
    name: {type: String},
    lat: {type: Number},
    lng: {type: Number},
    sample: {type: Number},
    temperature: {type: Number},
})

const Info = mongoose.model("Info", infoSchema)

export default Info;