import ExcelJS from "exceljs";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import IncidentGroup from "../models/IncidentGroup.js";
import IncidentMethod from "../models/IncidentMethod.js";
import IncidentType from "../models/IncidentType.js";
import MapPoint, { MAP_POINT_KINDS, MAP_POINT_STATUSES } from "../models/MapPoint.js";
import {
  LEAK_RATE_BUCKETS,
  estimateLeakRate,
  getLeakBucketLabel,
  normalizeLeakRateKey,
} from "../services/leakRate.js";
import { ensureDefaultTypes } from "./incidentTypeController.js";
import { buildBulletin } from "../services/incidentBulletin.js";

const MAX_LIST_LIMIT = 5000;
const TZ = "Asia/Ho_Chi_Minh";

export const INCIDENT_IMAGE_DIR = path.join(path.resolve(), "upload", "incidents");
if (!fs.existsSync(INCIDENT_IMAGE_DIR)) fs.mkdirSync(INCIDENT_IMAGE_DIR, { recursive: true });

const STATUS_LABELS = { open: "Chưa xử lý", resolved: "Đã xử lý" };

const getUserNumber = (req, source) => {
  const raw = Number(source?.user);
  return Number.isFinite(raw) ? raw : Number(req.user?.user ?? 0);
};

const isReadOnlyRole = (req) => req.user?.role === "trial";

const toNumberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseDate = (value, fallback = null) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const formatVn = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

// "Bách Việt,Phía Nam" hoac "all" -> mang nhom. Rong = tat ca.
const parseGroups = (value) => String(value || "")
  .split(",")
  .map((item) => item.trim())
  .filter((item) => item && item.toLowerCase() !== "all");

const buildFilter = (req, source) => {
  const user = getUserNumber(req, source);
  const filter = { user };

  const status = String(source.status || "").trim();
  if (status && status !== "all") {
    const list = status.split(",").filter((item) => MAP_POINT_STATUSES.includes(item));
    if (list.length) filter.status = { $in: list };
  }

  // typeId co the la loai bac 2 hoac nhom bac 1 (loc ca nhom).
  const typeIds = String(source.typeId || "").split(",").map((item) => item.trim()).filter((item) => mongoose.isValidObjectId(item));
  if (typeIds.length && !String(source.typeId).includes("all")) {
    filter.$or = [{ typeId: { $in: typeIds } }, { typeGroupId: { $in: typeIds } }];
  }

  // "point" = chi diem tren ban do (bo luot nghe khong thay diem); "no_find" = nguoc lai.
  if (source.kind === "point") filter.kind = { $ne: "no_find" };
  else if (source.kind === "no_find") filter.kind = "no_find";

  const groups = parseGroups(source.group);
  if (groups.length) filter.group = { $in: groups };

  const fromDate = parseDate(source.fromDate);
  const toDate = parseDate(source.toDate);
  if (fromDate || toDate) {
    filter.occurredAt = {
      ...(fromDate ? { $gte: fromDate } : {}),
      ...(toDate ? { $lte: toDate } : {}),
    };
  }

  return filter;
};

const toCount = (value) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 ? Math.min(number, 10000000) : 0;
};

const findOwned = async (Model, id, user) => (
  id && mongoose.isValidObjectId(id) ? Model.findOne({ _id: id, user }).lean() : null
);

const buildPayload = async (req, { isUpdate = false } = {}) => {
  const body = req.body || {};
  const user = getUserNumber(req, body);
  const kind = MAP_POINT_KINDS.includes(body.kind) ? body.kind : "point";
  const noFind = kind === "no_find";
  const lat = toNumberOrNull(body.lat);
  const lng = toNumberOrNull(body.lng);

  if (!noFind && (!isUpdate || body.lat !== undefined || body.lng !== undefined)) {
    if (lat === null || lng === null) throw new Error("Toạ độ không hợp lệ");
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("Toạ độ ngoài phạm vi cho phép");
  }

  // Khu vuc bac 1 / tuyen bac 2. Chon tuyen thi khu vuc lay theo tuyen.
  const route = await findOwned(IncidentGroup, body.routeId, user);
  if (body.routeId && !route?.parentId) throw new Error("Tuyến không hợp lệ");
  const area = route
    ? await IncidentGroup.findOne({ _id: route.parentId, user }).lean()
    : await findOwned(IncidentGroup, body.areaId, user);
  if (body.areaId && !route && (!area || area.parentId)) throw new Error("Khu vực không hợp lệ");
  if (noFind && !route) throw new Error("Vui lòng chọn tuyến đã nghe");

  // Nguoi dung sua so khach hang cua tuyen ngay trong form -> luu lai cho lan sau.
  let routeCustomers = Number(route?.customers || 0);
  if (route && body.routeCustomers !== undefined && body.routeCustomers !== "") {
    routeCustomers = toCount(body.routeCustomers);
    if (routeCustomers !== Number(route.customers || 0)) {
      await IncidentGroup.updateOne({ _id: route._id }, { $set: { customers: routeCustomers } });
    }
  }

  const title = String(body.title || "").trim() || (noFind && route ? route.name : "");
  if (!isUpdate && !title) throw new Error("Vui lòng nhập tên sự cố");

  // Snapshot ten loai (bac 2) + nhom loai (bac 1) de bao cao khong phai join.
  let typeId = null;
  let typeName = "";
  let typeGroupId = null;
  let typeGroupName = "";
  if (!noFind && body.typeId) {
    const type = await findOwned(IncidentType, body.typeId, user);
    if (!type || !type.parentId) throw new Error("Loại sự cố không hợp lệ");
    const group = await IncidentType.findOne({ _id: type.parentId, user }).select("name").lean();
    typeId = type._id;
    typeName = type.name;
    typeGroupId = type.parentId;
    typeGroupName = group?.name || "";
  }

  const method = await findOwned(IncidentMethod, body.methodId, user);
  if (body.methodId && !method) throw new Error("Loại hình phát hiện không hợp lệ");

  const status = noFind ? "resolved" : (MAP_POINT_STATUSES.includes(body.status) ? body.status : "open");

  const payload = {
    ...(title ? { title: title.slice(0, 200) } : {}),
    kind,
    typeId,
    typeName,
    typeGroupId,
    typeGroupName,
    areaId: area?._id || null,
    areaName: area?.name || "",
    // Truong cu: ten khu vuc bac 1 (bo loc khu vuc, AI, bao cao cu dang dung).
    group: area?.name || "",
    routeId: route?._id || null,
    routeName: route?.name || "",
    routeCustomers,
    heardCustomers: toCount(body.heardCustomers),
    methodId: method?._id || null,
    methodName: method?.name || "",
    leakRate: noFind ? normalizeLeakRateKey("") : normalizeLeakRateKey(body.leakRate),
    status,
    note: String(body.note || "").trim().slice(0, 2000),
    occurredAt: parseDate(body.occurredAt, new Date()),
    resolvedAt: !noFind && status === "resolved" ? parseDate(body.resolvedAt, new Date()) : null,
    unresolvedReason: !noFind && status === "open" ? String(body.unresolvedReason || "").trim().slice(0, 500) : "",
  };

  if (noFind) {
    payload.lat = undefined;
    payload.lng = undefined;
    payload.location = undefined;
  } else if (lat !== null && lng !== null) {
    payload.lat = lat;
    payload.lng = lng;
    payload.location = { type: "Point", coordinates: [lng, lat] };
  }

  return payload;
};

export const listMapPoints = async (req, res) => {
  try {
    const filter = buildFilter(req, req.query);
    const limit = Math.min(Math.max(Number(req.query.limit) || 2000, 1), MAX_LIST_LIMIT);
    const points = await MapPoint.find(filter).sort({ occurredAt: -1 }).limit(limit).lean();

    return res.status(200).json({ success: true, points, total: points.length });
  } catch (error) {
    console.error("Không tải được điểm sự cố:", error.message);
    return res.status(500).json({ success: false, error: "Không tải được danh sách điểm" });
  }
};

export const createMapPoint = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không thêm được điểm" });
  }

  try {
    const payload = Object.fromEntries(Object.entries(await buildPayload(req)).filter(([, value]) => value !== undefined));
    const point = await MapPoint.create({
      ...payload,
      user: getUserNumber(req, req.body),
      createdBy: req.user?._id,
      createdByName: req.user?.name || "",
    });

    return res.status(201).json({ success: true, point });
  } catch (error) {
    const isValidation = /Toạ độ|tên sự cố|Loại sự cố|Tuyến|tuyến|Khu vực|Loại hình/i.test(error.message);
    return res.status(isValidation ? 400 : 500).json({
      success: false,
      error: isValidation ? error.message : "Không tạo được điểm",
    });
  }
};

export const updateMapPoint = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không sửa được điểm" });
  }

  try {
    const user = getUserNumber(req, req.body);
    const payload = await buildPayload(req, { isUpdate: true });
    // Diem tren ban do bat buoc co toa do (vd doi luot "khong thay diem" thanh diem ma chua chon vi tri).
    if (payload.kind === "point" && payload.lat === undefined) {
      const existing = await MapPoint.findOne({ _id: req.params.id, user }).select("lat lng").lean();
      if (!Number.isFinite(existing?.lat) || !Number.isFinite(existing?.lng)) throw new Error("Toạ độ không hợp lệ");
    }

    // Chuyen sang "luot nghe khong thay diem" thi bo han toa do (khong de lai location rong).
    const unset = {};
    ["lat", "lng", "location"].forEach((key) => {
      if (payload[key] === undefined && key in payload) {
        unset[key] = "";
        delete payload[key];
      }
    });
    const point = await MapPoint.findOneAndUpdate(
      { _id: req.params.id, user },
      { $set: { ...payload, updatedAt: new Date() }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { new: true, runValidators: true }
    ).lean();

    if (!point) return res.status(404).json({ success: false, error: "Không tìm thấy điểm" });
    return res.status(200).json({ success: true, point });
  } catch (error) {
    console.error("Không cập nhật được điểm:", error.message);
    const isValidation = /Toạ độ|tên sự cố|Loại sự cố|Tuyến|tuyến|Khu vực|Loại hình/i.test(error.message);
    return res.status(isValidation ? 400 : 500).json({
      success: false,
      error: isValidation ? error.message : "Không cập nhật được điểm",
    });
  }
};

export const deleteMapPoint = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không xoá được điểm" });
  }

  try {
    const user = getUserNumber(req, req.query);
    const deleted = await MapPoint.findOneAndDelete({ _id: req.params.id, user }).lean();
    if (!deleted) return res.status(404).json({ success: false, error: "Không tìm thấy điểm" });

    (deleted.images || []).forEach((name) => {
      fs.unlink(path.join(INCIDENT_IMAGE_DIR, name), () => {});
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Không xoá được điểm:", error.message);
    return res.status(500).json({ success: false, error: "Không xoá được điểm" });
  }
};

export const addMapPointImages = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không thêm được ảnh" });
  }

  try {
    const user = getUserNumber(req, req.body);
    const names = (req.files || []).map((file) => file.filename);
    if (!names.length) return res.status(400).json({ success: false, error: "Chưa chọn ảnh" });

    const point = await MapPoint.findOneAndUpdate(
      { _id: req.params.id, user },
      { $push: { images: { $each: names } }, $set: { updatedAt: new Date() } },
      { new: true }
    ).lean();

    if (!point) {
      names.forEach((name) => fs.unlink(path.join(INCIDENT_IMAGE_DIR, name), () => {}));
      return res.status(404).json({ success: false, error: "Không tìm thấy điểm" });
    }

    return res.status(200).json({ success: true, point });
  } catch (error) {
    console.error("Không thêm được ảnh:", error.message);
    return res.status(500).json({ success: false, error: "Không thêm được ảnh" });
  }
};

export const deleteMapPointImage = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không xoá được ảnh" });
  }

  try {
    const user = getUserNumber(req, req.query);
    const name = path.basename(String(req.params.name || ""));

    const point = await MapPoint.findOneAndUpdate(
      { _id: req.params.id, user },
      { $pull: { images: name }, $set: { updatedAt: new Date() } },
      { new: true }
    ).lean();

    if (!point) return res.status(404).json({ success: false, error: "Không tìm thấy điểm" });
    fs.unlink(path.join(INCIDENT_IMAGE_DIR, name), () => {});

    return res.status(200).json({ success: true, point });
  } catch (error) {
    console.error("Không xoá được ảnh:", error.message);
    return res.status(500).json({ success: false, error: "Không xoá được ảnh" });
  }
};

export const getMapPointImage = (req, res) => {
  const name = path.basename(String(req.params.name || ""));
  const filePath = path.join(INCIDENT_IMAGE_DIR, name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: "Không tìm thấy ảnh" });
  return res.sendFile(filePath);
};

// So khach hang cua mot lan nghe: nguoi tong hop nhap so da nghe; de 0 thi lay so khach hang cua tuyen.
const effectiveCustomers = (point) => (
  Number(point.heardCustomers) > 0 ? Number(point.heardCustomers) : Number(point.routeCustomers || 0)
);

const EXPORT_COLUMNS = [
  { header: "Thời gian phát hiện", key: "occurredAt", width: 20 },
  { header: "Trạng thái", key: "status", width: 26 },
  { header: "Nhóm loại sự cố", key: "typeGroupName", width: 24 },
  { header: "Loại sự cố", key: "typeName", width: 22 },
  { header: "Mức độ", key: "leakRate", width: 16 },
  { header: "Khu vực", key: "group", width: 22 },
  { header: "Tuyến", key: "routeName", width: 26 },
  { header: "Loại hình phát hiện", key: "methodName", width: 20 },
  { header: "Khách hàng đã nghe", key: "customers", width: 12 },
  { header: "Toạ độ", key: "coordinate", width: 26 },
  { header: "Ghi chú", key: "note", width: 48 },
  { header: "Người tạo", key: "createdByName", width: 18 },
];

export const exportMapPoints = async (req, res) => {
  try {
    const filter = buildFilter(req, req.body || {});
    const points = await MapPoint.find(filter).sort({ occurredAt: -1 }).limit(MAX_LIST_LIMIT).lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Su co");

    // Nguoi dung tick chon cot can bao cao; "Ten su co" luon co. Khong gui columns = du cot nhu truoc.
    const requested = Array.isArray(req.body?.columns) ? req.body.columns.map(String) : null;
    sheet.columns = [
      { header: "Tên sự cố", key: "title", width: 38 },
      ...EXPORT_COLUMNS.filter((column) => !requested || requested.includes(column.key)),
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle" };

    points.forEach((point) => {
      const noFind = point.kind === "no_find";
      const statusText = noFind
        ? "Đã nghe, không tìm thấy điểm"
        : point.status === "resolved"
          ? `${STATUS_LABELS.resolved}${point.resolvedAt ? ` (${formatVn(point.resolvedAt)})` : ""}`
          : `${STATUS_LABELS.open}${point.unresolvedReason ? ` (${point.unresolvedReason})` : ""}`;
      sheet.addRow({
        title: point.title,
        occurredAt: formatVn(point.occurredAt),
        status: statusText,
        typeGroupName: noFind ? "" : point.typeGroupName || "",
        typeName: noFind ? "" : point.typeName || "Chưa phân loại",
        leakRate: noFind ? "" : getLeakBucketLabel(point.leakRate),
        group: point.areaName || point.group || "Không có",
        routeName: point.routeName || "",
        methodName: point.methodName || "",
        customers: point.routeId ? effectiveCustomers(point) : "",
        coordinate: noFind ? "" : `${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`,
        note: point.note || "",
        createdByName: point.createdByName || "",
      });
    });
    sheet.getColumn("title").alignment = { wrapText: true, vertical: "top" };
    if (sheet.columns.some((column) => column.key === "note")) {
      sheet.getColumn("note").alignment = { wrapText: true, vertical: "top" };
    }

    const fileName = `su-co-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error("Không xuất được Excel sự cố:", error.message);
    return res.status(500).json({ success: false, error: "Không xuất được file Excel" });
  }
};

export const getMapPointReport = async (req, res) => {
  try {
    const user = getUserNumber(req, req.query);
    // Bao cao theo loai chi tinh diem ro ri that (bo luot nghe khong thay diem).
    const filter = buildFilter(req, { ...req.query, kind: "point" });
    await ensureDefaultTypes(user);

    const [points, allTypes] = await Promise.all([
      MapPoint.find(filter).sort({ occurredAt: -1 }).limit(MAX_LIST_LIMIT).lean(),
      IncidentType.find({ user }).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);
    const groupNames = Object.fromEntries(allTypes.filter((type) => !type.parentId).map((type) => [String(type._id), type.name]));
    // Diem chon loai bac 2: lap theo nhom bac 1 roi den loai bac 2.
    const types = allTypes
      .filter((type) => type.parentId)
      .sort((a, b) => Object.keys(groupNames).indexOf(String(a.parentId)) - Object.keys(groupNames).indexOf(String(b.parentId)));

    const toRow = (point) => ({
      _id: point._id,
      title: point.title,
      group: point.areaName || point.group || "Không có",
      routeName: point.routeName || "",
      methodName: point.methodName || "",
      typeGroupName: point.typeGroupName || "",
      customers: point.routeId ? effectiveCustomers(point) : null,
      lat: point.lat,
      lng: point.lng,
      leakRate: point.leakRate,
      leakRateLabel: getLeakBucketLabel(point.leakRate),
      estimatedLeak: estimateLeakRate(point.leakRate),
      status: point.status,
      statusLabel: STATUS_LABELS[point.status] || point.status,
      occurredAt: point.occurredAt,
      occurredAtText: formatVn(point.occurredAt),
      resolvedAtText: formatVn(point.resolvedAt),
      unresolvedReason: point.unresolvedReason || "",
      typeName: point.typeName || "Chưa phân loại",
      note: point.note || "",
      createdByName: point.createdByName || "",
    });

    // Moi loai deu phai xuat hien trong bao cao, ke ca loai khong co su co nao.
    const byType = types.map((type) => {
      const rows = points
        .filter((point) => String(point.typeId) === String(type._id))
        .map(toRow);
      return {
        typeId: type._id,
        typeName: type.name,
        typeGroupName: groupNames[String(type.parentId)] || "",
        count: rows.length,
        estimatedLeak: rows.reduce((sum, row) => sum + row.estimatedLeak, 0),
        resolved: rows.filter((row) => row.status === "resolved").length,
        points: rows,
      };
    });

    const unclassified = points.filter((point) => !point.typeId).map(toRow);
    if (unclassified.length) {
      byType.push({
        typeId: null,
        typeName: "Chưa phân loại",
        count: unclassified.length,
        estimatedLeak: unclassified.reduce((sum, row) => sum + row.estimatedLeak, 0),
        resolved: unclassified.filter((row) => row.status === "resolved").length,
        points: unclassified,
      });
    }

    const allRows = points.map(toRow);
    const resolvedRows = allRows.filter((row) => row.status === "resolved");
    const round = (value) => Number(value.toFixed(1));

    return res.status(200).json({
      success: true,
      range: {
        fromDate: req.query.fromDate || null,
        toDate: req.query.toDate || null,
        groups: parseGroups(req.query.group),
      },
      summary: {
        total: allRows.length,
        resolved: resolvedRows.length,
        open: allRows.length - resolvedRows.length,
        // Uoc tinh tu bac MUC DO, khong phai so do thuc te.
        estimatedLeakRate: round(allRows.reduce((sum, row) => sum + row.estimatedLeak, 0)),
        eliminatedLeakRate: round(resolvedRows.reduce((sum, row) => sum + row.estimatedLeak, 0)),
      },
      byType,
      buckets: LEAK_RATE_BUCKETS,
    });
  } catch (error) {
    console.error("Không tạo được báo cáo sự cố:", error.message);
    return res.status(500).json({ success: false, error: "Không tạo được báo cáo sự cố" });
  }
};

// Gom nhom su co theo o luoi de biet khu vuc nao tap trung nhieu su co nhat.
export const getMapPointHotspots = async (req, res) => {
  try {
    const filter = buildFilter(req, { ...req.query, kind: "point" });
    const gridSize = Math.min(Math.max(Number(req.query.gridSize) || 0.002, 0.0005), 0.05);

    const hotspots = await MapPoint.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            latCell: { $floor: { $divide: ["$lat", gridSize] } },
            lngCell: { $floor: { $divide: ["$lng", gridSize] } },
          },
          count: { $sum: 1 },
          avgLat: { $avg: "$lat" },
          avgLng: { $avg: "$lng" },
          open: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 0, 1] } },
          lastAt: { $max: "$occurredAt" },
          types: { $addToSet: "$typeName" },
        },
      },
      { $match: { count: { $gte: 2 } } },
      { $sort: { count: -1 } },
      { $limit: 200 },
      {
        $project: {
          _id: 0, lat: "$avgLat", lng: "$avgLng", count: 1, open: 1, lastAt: 1, types: 1,
        },
      },
    ]);

    return res.status(200).json({ success: true, gridSize, hotspots });
  } catch (error) {
    console.error("Không tính được điểm nóng sự cố:", error.message);
    return res.status(500).json({ success: false, error: "Không tính được điểm nóng sự cố" });
  }
};

// Ban tin tong hop theo khu vuc (luot/tuyen, khach hang, nguyen nhan, luu luong) cho ky da chon.
export const getMapPointBulletin = async (req, res) => {
  try {
    const user = getUserNumber(req, req.query);
    const to = parseDate(req.query.toDate, new Date());
    const from = parseDate(req.query.fromDate, new Date(to.getTime() - 30 * 86400000));
    if (from > to) return res.status(400).json({ success: false, error: "Khoảng thời gian không hợp lệ" });
    // Ban tin can ca diem va luot "khong thay diem"; trang thai / loai loc theo yeu cau.
    const filter = buildFilter(req, { ...req.query, fromDate: from.toISOString(), toDate: to.toISOString(), kind: "" });
    const bulletin = await buildBulletin({ user, filter, from, to });
    return res.status(200).json({ success: true, ...bulletin });
  } catch (error) {
    console.error("Không tạo được bản tin sự cố:", error.message);
    return res.status(500).json({ success: false, error: "Không tạo được bản tin sự cố" });
  }
};
