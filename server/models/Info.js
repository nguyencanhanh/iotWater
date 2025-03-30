import mongoose from "mongoose";

const infoSchema = new mongoose.Schema({
    tracking: {type: Number},
    interval: {type: Number},
    wPress: {type: Number},
    wPressTime: {type: Number},
    timeAlarm: {type: Number},
    watch: {type: Number},
    adj: {type: Number},
    id: {type: Number},
    name: {type: String},
    lat: {type: Number},
    lng: {type: Number},
    group: {type: String},
    sample: {type: Number},
    description: {type: String},
    temperature: {type: Number},
})

const Info = mongoose.model("Info", infoSchema)

export default Info;