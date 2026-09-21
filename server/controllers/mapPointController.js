import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import IncidentType from "../models/IncidentType.js";
import MapPoint, { MAP_POINT_STATUSES } from "../models/MapPoint.js";
import {
  LEAK_RATE_BUCKETS,
  estimateLeakRate,
  getLeakBucketLabel,
  normalizeLeakRateKey,
} from "../services/leakRate.js";
import { ensureDefaultTypes } from "./incidentTypeController.js";

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

  const typeIds = String(source.typeId || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (typeIds.length && !typeIds.includes("all")) filter.typeId = { $in: typeIds };

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

const buildPayload = async (req, { isUpdate = false } = {}) => {
  const body = req.body || {};
  const lat = toNumberOrNull(body.lat);
  const lng = toNumberOrNull(body.lng);

  if (!isUpdate || body.lat !== undefined || body.lng !== undefined) {
    if (lat === null || lng === null) throw new Error("Toạ độ không hợp lệ");
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("Toạ độ ngoài phạm vi cho phép");
  }

  const title = String(body.title || "").trim();
  if (!isUpdate && !title) throw new Error("Vui lòng nhập tên sự cố");

  const status = MAP_POINT_STATUSES.includes(body.status) ? body.status : "open";
  const user = getUserNumber(req, body);

  // Snapshot ten loai de xuat Excel/bao cao khong phai join.
  let typeId = body.typeId || null;
  let typeName = String(body.typeName || "").trim();
  if (typeId) {
    const type = await IncidentType.findOne({ _id: typeId, user }).select("name").lean();
    if (!type) throw new Error("Loại sự cố không hợp lệ");
    typeName = type.name;
  } else {
    typeId = null;
  }

  const payload = {
    ...(title ? { title: title.slice(0, 200) } : {}),
    typeId,
    typeName,
    leakRate: normalizeLeakRateKey(body.leakRate),
    status,
    note: String(body.note || "").trim().slice(0, 2000),
    group: String(body.group || "").trim().slice(0, 120),
    occurredAt: parseDate(body.occurredAt, new Date()),
    resolvedAt: status === "resolved" ? parseDate(body.resolvedAt, new Date()) : null,
    unresolvedReason: status === "open" ? String(body.unresolvedReason || "").trim().slice(0, 500) : "",
  };

  if (lat !== null && lng !== null) {
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
    const payload = await buildPayload(req);
    const point = await MapPoint.create({
      ...payload,
      user: getUserNumber(req, req.body),
      createdBy: req.user?._id,
      createdByName: req.user?.name || "",
    });

    return res.status(201).json({ success: true, point });
  } catch (error) {
    const isValidation = /Toạ độ|tên sự cố|Loại sự cố/i.test(error.message);
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

    const point = await MapPoint.findOneAndUpdate(
      { _id: req.params.id, user },
      { $set: { ...payload, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).lean();

    if (!point) return res.status(404).json({ success: false, error: "Không tìm thấy điểm" });
    return res.status(200).json({ success: true, point });
  } catch (error) {
    const isValidation = /Toạ độ|tên sự cố|Loại sự cố/i.test(error.message);
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

export const exportMapPoints = async (req, res) => {
  try {
    const filter = buildFilter(req, req.body || {});
    const points = await MapPoint.find(filter).sort({ occurredAt: -1 }).limit(MAX_LIST_LIMIT).lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Su co");

    sheet.columns = [
      { header: "Tên sự cố", key: "title", width: 38 },
      { header: "Thời gian phát hiện", key: "occurredAt", width: 20 },
      { header: "Trạng thái", key: "status", width: 14 },
      { header: "Loại sự cố", key: "typeName", width: 22 },
      { header: "Mức độ", key: "leakRate", width: 16 },
      { header: "Khu vực", key: "group", width: 22 },
      { header: "Toạ độ", key: "coordinate", width: 26 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle" };

    points.forEach((point) => {
      sheet.addRow({
        title: point.title,
        occurredAt: formatVn(point.occurredAt),
        status: STATUS_LABELS[point.status] || point.status,
        typeName: point.typeName || "Chưa phân loại",
        leakRate: getLeakBucketLabel(point.leakRate),
        group: point.group || "Không có",
        coordinate: `${Number(point.lat).toFixed(6)}, ${Number(point.lng).toFixed(6)}`,
      });
    });

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
    const filter = buildFilter(req, req.query);
    await ensureDefaultTypes(user);

    const [points, types] = await Promise.all([
      MapPoint.find(filter).sort({ occurredAt: -1 }).limit(MAX_LIST_LIMIT).lean(),
      IncidentType.find({ user }).sort({ sortOrder: 1, name: 1 }).lean(),
    ]);

    const toRow = (point) => ({
      _id: point._id,
      title: point.title,
      group: point.group || "Không có",
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
    });

    // Moi loai deu phai xuat hien trong bao cao, ke ca loai khong co su co nao.
    const byType = types.map((type) => {
      const rows = points
        .filter((point) => String(point.typeId) === String(type._id))
        .map(toRow);
      return {
        typeId: type._id,
        typeName: type.name,
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
    const filter = buildFilter(req, req.query);
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
