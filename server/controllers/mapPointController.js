import MapPoint, {
  MAP_POINT_SEVERITIES,
  MAP_POINT_STATUSES,
  MAP_POINT_TYPES,
} from "../models/MapPoint.js";

const MAX_LIST_LIMIT = 2000;

const getUserNumber = (req, source) => {
  const raw = Number(source?.user);
  return Number.isFinite(raw) ? raw : Number(req.user?.user ?? 0);
};

const isReadOnlyRole = (req) => req.user?.role === "trial";

const pickEnum = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

const toNumberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseDate = (value, fallback = null) => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const buildPayload = (req, { isUpdate = false } = {}) => {
  const body = req.body || {};
  const lat = toNumberOrNull(body.lat);
  const lng = toNumberOrNull(body.lng);

  if (!isUpdate || body.lat !== undefined || body.lng !== undefined) {
    if (lat === null || lng === null) throw new Error("Toạ độ không hợp lệ");
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw new Error("Toạ độ ngoài phạm vi cho phép");
  }

  const title = String(body.title || "").trim();
  if (!isUpdate && !title) throw new Error("Vui lòng nhập tên điểm");

  const status = pickEnum(body.status, MAP_POINT_STATUSES, "open");

  const payload = {
    ...(title ? { title: title.slice(0, 200) } : {}),
    type: pickEnum(body.type, MAP_POINT_TYPES, "leak"),
    severity: pickEnum(body.severity, MAP_POINT_SEVERITIES, "medium"),
    status,
    address: String(body.address || "").trim().slice(0, 300),
    note: String(body.note || "").trim().slice(0, 2000),
    group: String(body.group || "").trim().slice(0, 120),
    occurredAt: parseDate(body.occurredAt, new Date()),
    resolvedAt: status === "resolved" ? parseDate(body.resolvedAt, new Date()) : null,
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
    const user = getUserNumber(req, req.query);
    const filter = { user };

    const status = String(req.query.status || "").trim();
    if (status && status !== "all") {
      filter.status = { $in: status.split(",").filter((item) => MAP_POINT_STATUSES.includes(item)) };
    }

    const type = String(req.query.type || "").trim();
    if (type && type !== "all") {
      filter.type = { $in: type.split(",").filter((item) => MAP_POINT_TYPES.includes(item)) };
    }

    const fromDate = parseDate(req.query.fromDate);
    const toDate = parseDate(req.query.toDate);
    if (fromDate || toDate) {
      filter.occurredAt = {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toDate ? { $lte: toDate } : {}),
      };
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), MAX_LIST_LIMIT);
    const points = await MapPoint.find(filter).sort({ occurredAt: -1 }).limit(limit).lean();

    return res.status(200).json({ success: true, points, total: points.length });
  } catch (error) {
    console.error("Không tải được điểm bản đồ:", error.message);
    return res.status(500).json({ success: false, error: "Không tải được danh sách điểm" });
  }
};

export const createMapPoint = async (req, res) => {
  if (isReadOnlyRole(req)) {
    return res.status(403).json({ success: false, error: "Tài khoản dùng thử không thêm được điểm" });
  }

  try {
    const payload = buildPayload(req);
    const point = await MapPoint.create({
      ...payload,
      user: getUserNumber(req, req.body),
      createdBy: req.user?._id,
      createdByName: req.user?.name || "",
    });

    return res.status(201).json({ success: true, point });
  } catch (error) {
    const isValidation = /Toạ độ|tên điểm/i.test(error.message);
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
    const payload = buildPayload(req, { isUpdate: true });

    const point = await MapPoint.findOneAndUpdate(
      { _id: req.params.id, user },
      { $set: { ...payload, updatedAt: new Date() } },
      { new: true, runValidators: true }
    ).lean();

    if (!point) return res.status(404).json({ success: false, error: "Không tìm thấy điểm" });
    return res.status(200).json({ success: true, point });
  } catch (error) {
    const isValidation = /Toạ độ|tên điểm/i.test(error.message);
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
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Không xoá được điểm bản đồ:", error.message);
    return res.status(500).json({ success: false, error: "Không xoá được điểm" });
  }
};

// Gom nhom su co theo o luoi de biet khu vuc nao tap trung nhieu su co nhat.
// gridSize tinh bang do (0.002 do ~ 200m), du de phan vung so bo.
export const getMapPointHotspots = async (req, res) => {
  try {
    const user = getUserNumber(req, req.query);
    const gridSize = Math.min(Math.max(Number(req.query.gridSize) || 0.002, 0.0005), 0.05);
    const fromDate = parseDate(req.query.fromDate);
    const toDate = parseDate(req.query.toDate);

    const match = { user };
    if (fromDate || toDate) {
      match.occurredAt = {
        ...(fromDate ? { $gte: fromDate } : {}),
        ...(toDate ? { $lte: toDate } : {}),
      };
    }

    const type = String(req.query.type || "").trim();
    if (type && type !== "all") {
      match.type = { $in: type.split(",").filter((item) => MAP_POINT_TYPES.includes(item)) };
    }

    const hotspots = await MapPoint.aggregate([
      { $match: match },
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
          high: { $sum: { $cond: [{ $eq: ["$severity", "high"] }, 1, 0] } },
          lastAt: { $max: "$occurredAt" },
          types: { $addToSet: "$type" },
        },
      },
      { $match: { count: { $gte: 2 } } },
      { $sort: { count: -1 } },
      { $limit: 200 },
      {
        $project: {
          _id: 0,
          lat: "$avgLat",
          lng: "$avgLng",
          count: 1,
          open: 1,
          high: 1,
          lastAt: 1,
          types: 1,
        },
      },
    ]);

    return res.status(200).json({ success: true, gridSize, hotspots });
  } catch (error) {
    console.error("Không tính được điểm nóng sự cố:", error.message);
    return res.status(500).json({ success: false, error: "Không tính được điểm nóng sự cố" });
  }
};
