import mongoose from "mongoose";

export const MAP_POINT_TYPES = ["leak", "burst", "repair", "valve", "meter", "other"];
export const MAP_POINT_SEVERITIES = ["low", "medium", "high"];
export const MAP_POINT_STATUSES = ["open", "in_progress", "resolved"];

const mapPointSchema = new mongoose.Schema({
  user: { type: Number, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  type: { type: String, enum: MAP_POINT_TYPES, default: "leak" },
  severity: { type: String, enum: MAP_POINT_SEVERITIES, default: "medium" },
  status: { type: String, enum: MAP_POINT_STATUSES, default: "open" },
  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  // GeoJSON [lng, lat] de sau nay chay $geoNear / $geoWithin khi phan vung su co.
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: undefined },
  },
  address: { type: String, trim: true, maxlength: 300, default: "" },
  note: { type: String, trim: true, maxlength: 2000, default: "" },
  group: { type: String, trim: true, maxlength: 120, default: "" },
  occurredAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdByName: { type: String, trim: true, maxlength: 120, default: "" },
  createAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

mapPointSchema.index({ user: 1, status: 1, occurredAt: -1 });
mapPointSchema.index({ user: 1, type: 1 });
mapPointSchema.index({ location: "2dsphere" });

const syncLocation = function syncLocation(next) {
  if (Number.isFinite(this.lat) && Number.isFinite(this.lng)) {
    this.location = { type: "Point", coordinates: [this.lng, this.lat] };
  }
  this.updatedAt = new Date();
  next();
};

mapPointSchema.pre("save", syncLocation);

const MapPoint = mongoose.model("MapPoint", mapPointSchema);

export default MapPoint;
