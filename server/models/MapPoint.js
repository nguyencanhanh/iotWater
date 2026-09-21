import mongoose from "mongoose";
import { LEAK_RATE_BUCKETS } from "../services/leakRate.js";

// Chi con 2 trang thai theo yeu cau van hanh: da xu ly (kem thoi gian) va chua xu ly (kem ly do).
export const MAP_POINT_STATUSES = ["open", "resolved"];
export const LEAK_RATE_KEYS = LEAK_RATE_BUCKETS.map((item) => item.key);

const mapPointSchema = new mongoose.Schema({
  user: { type: Number, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },

  // Loai su co lay tu IncidentType (nguoi dung tu them). Giu them typeName de
  // xuat Excel/bao cao khong phai join, va khong mat du lieu neu loai bi xoa.
  typeId: { type: mongoose.Schema.Types.ObjectId, ref: "IncidentType" },
  typeName: { type: String, trim: true, maxlength: 120, default: "" },

  // Muc do = dai luu luong ro ri uoc tinh, vi du "50-100" hoac ">1000".
  leakRate: { type: String, enum: LEAK_RATE_KEYS, default: LEAK_RATE_KEYS[0] },

  status: { type: String, enum: MAP_POINT_STATUSES, default: "open" },
  resolvedAt: { type: Date, default: null },
  unresolvedReason: { type: String, trim: true, maxlength: 500, default: "" },

  lat: { type: Number, required: true, min: -90, max: 90 },
  lng: { type: Number, required: true, min: -180, max: 180 },
  // GeoJSON [lng, lat] de chay $geoNear / $geoWithin khi phan vung su co.
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: undefined },
  },

  group: { type: String, trim: true, maxlength: 120, default: "" },
  // Ghi chu da gop ca dia chi theo yeu cau.
  note: { type: String, trim: true, maxlength: 2000, default: "" },
  // Anh hien truong, bo sung dan sau khi dao len.
  images: { type: [String], default: [] },

  occurredAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdByName: { type: String, trim: true, maxlength: 120, default: "" },
  createAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

mapPointSchema.index({ user: 1, status: 1, occurredAt: -1 });
mapPointSchema.index({ user: 1, occurredAt: -1 });
mapPointSchema.index({ user: 1, group: 1, occurredAt: -1 });
mapPointSchema.index({ user: 1, typeId: 1 });
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
