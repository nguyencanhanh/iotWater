import mongoose from "mongoose";

const infoSchema = new mongoose.Schema({
    user:{type:Number},
    tracking: {type: Number},
    interval: {type: Number},
    highAlerts: [Number],
    lowAlerts: [Number],
    alertTimes: [Number],
    flowHighs:[Number],
    flowLows:[Number],
    watch: {type: Number},
    adj: {type: Number}, 
    id: {type: Number},
    name: {type: String},
    lat: {type: Number},
    lng: {type: Number},
    unit: {type: Number},
    group: {type: String},
    sample: {type: Number},
    description: {type: String},
    temperature: {type: Number},
    isWarning:{type: Boolean},
    onP:{type: Boolean},
    onF:{type: Boolean},
    displaySettings: {
        overviewMetrics: [String],
        detailColumns: [String],
        detailChartInterval: { type: Number, default: 1 },
        detailTableInterval: { type: Number, default: 1 },
    },
    notificationChannels: {
        telegram: { type: Boolean, default: true },
        fcm: { type: Boolean, default: false },
    },
    createAt: { type: Date, default: Date.now },
    image: { type: String, default: "" },
    sortOrder: { type: Number, default: 0 }
})

infoSchema.index({ user: 1, id: 1 });
infoSchema.index({ user: 1, group: 1 });
infoSchema.index({ user: 1, createAt: -1 });

const Info = mongoose.model("Info", infoSchema)

export default Info;
