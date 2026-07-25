import mongoose from "mongoose";

const fcmTokenSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userNumber: { type: Number, default: 0, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, default: "web" },
    userAgent: { type: String, default: "" },
    active: { type: Boolean, default: true },
    createAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

const FcmToken = mongoose.model("FcmToken", fcmTokenSchema);

export default FcmToken;
