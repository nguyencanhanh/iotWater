import mongoose from "mongoose";
import { LEAK_RATE_BUCKETS } from "../services/leakRate.js";

// Chi con 2 trang thai theo yeu cau van hanh: da xu ly (kem thoi gian) va chua xu ly (kem ly do).
export const MAP_POINT_STATUSES = ["open", "resolved"];
// "point" = diem ro ri tren ban do; "no_find" = luot nghe tuyen nhung khong tim thay diem
// (khong co toa do, khong hien tren ban do, chi dung cho ban tin / bao cao).
export const MAP_POINT_KINDS = ["point", "no_find"];
export const LEAK_RATE_KEYS = LEAK_RATE_BUCKETS.map((item) => item.key);

const mapPointSchema = new mongoose.Schema({
  user: { type: Number, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  kind: { type: String, enum: MAP_POINT_KINDS, default: "point" },

  // Loai su co lay tu IncidentType (nguoi dung tu them). Giu them typeName de
  // xuat Excel/bao cao khong phai join, va khong mat du lieu neu loai bi xoa.
  typeId: { type: mongoose.Schema.Types.ObjectId, ref: "IncidentType" },
  typeName: { type: String, trim: true, maxlength: 120, default: "" },
  // Loai bac 1 cua typeId (snapshot de bao cao "nguyen nhan ro ri" khong phai join).
  typeGroupId: { type: mongoose.Schema.Types.ObjectId, ref: "IncidentType", default: null },
  typeGroupName: { type: String, trim: true, maxlength: 120, default: "" },

  // Khu vuc bac 1 / tuyen bac 2. "group" giu ten khu vuc bac 1 cho cac cho cu dang loc theo group.
  areaId: { type: mongoose.Schema.Types.ObjectId, ref: "IncidentGroup", default: null },
  areaName: { type: String, trim: true, maxlength: 120, default: "" },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: "IncidentGroup", default: null },
  routeName: { type: String, trim: true, maxlength: 120, default: "" },
  // So khach hang cua tuyen tai thoi diem nhap, va so khach hang da nghe (0 = lay so cua tuyen).
  routeCustomers: { type: Number, min: 0, default: 0 },
  heardCustomers: { type: Number, min: 0, default: 0 },

  methodId: { type: mongoose.Schema.Types.ObjectId, ref: "IncidentMethod", default: null },
  methodName: { type: String, trim: true, maxlength: 120, default: "" },

  // Muc do = dai luu luong ro ri uoc tinh, vi du "50-100" hoac ">1000".
  leakRate: { type: String, enum: LEAK_RATE_KEYS, default: LEAK_RATE_KEYS[0] },

  status: { type: String, enum: MAP_POINT_STATUSES, default: "open" },
  resolvedAt: { type: Date, default: null },
  unresolvedReason: { type: String, trim: true, maxlength: 500, default: "" },

  // Luot "no_find" khong co toa do. Diem thuong bat buoc toa do - kiem tra o buildPayload
  // (mapPointController) vi validator "required" khong biet kind khi chay findOneAndUpdate.
  lat: { type: Number, min: -90, max: 90 },
  lng: { type: Number, min: -180, max: 180 },
  // GeoJSON [lng, lat] de chay $geoNear / $geoWithin khi phan vung su co. Khong dat mac dinh
  // "Point": ban ghi khong co toa do ma co { type: "Point" } se lam loi index 2dsphere.
  location: {
    type: { type: String, enum: ["Point"] },
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
mapPointSchema.index({ user: 1, areaId: 1, occurredAt: -1 });
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
