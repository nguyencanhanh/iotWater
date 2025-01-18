import mongoose from "mongoose";

const infoSchema = new mongoose.Schema({
    total: {type: Number, default: 0},
    interval: {type: Number},
    display: {type: Number},
    sen_id: [{name: String, id: Number}],
})

const Info = mongoose.model("Info", infoSchema)

export default Info;