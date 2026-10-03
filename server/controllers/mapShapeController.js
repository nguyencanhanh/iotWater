import MapShape, { PIPE_LAYERS, POINT_LAYERS, ZONE_LAYERS } from "../models/MapShape.js";

const getUserNumber = (req, source) => {
  const raw = Number(source?.user);
  return Number.isFinite(raw) ? raw : Number(req.user?.user ?? 0);
};
const isReadOnlyRole = (req) => req.user?.role === "trial";
const MAX_VERTICES = 2000;

const cleanCoordinates = (value, kind) => {
  if (!Array.isArray(value)) return null;
  const points = value
    .map((pair) => (Array.isArray(pair) ? [Number(pair[0]), Number(pair[1])] : null))
    .filter((pair) => pair && Math.abs(pair[0]) <= 90 && Math.abs(pair[1]) <= 180 && pair.every(Number.isFinite))
    .map(([lat, lng]) => [Number(lat.toFixed(7)), Number(lng.toFixed(7))]);
  if (kind === "point") return points.length ? [points[0]] : null;
  const min = kind === "zone" ? 3 : 2;
  if (points.length < min || points.length > MAX_VERTICES) return null;
  return points;
};

const buildPayload = (body, kind) => {
  const payload = {};
  if (body.name !== undefined) payload.name = String(body.name || "").trim().slice(0, 160);
  if (body.note !== undefined) payload.note = String(body.note || "").trim().slice(0, 1000);
  if (body.layer !== undefined) {
    const allowed = { pipe: PIPE_LAYERS, point: POINT_LAYERS }[kind] || ZONE_LAYERS;
    if (!allowed.includes(body.layer)) throw new Error("Lớp không hợp lệ");
    payload.layer = body.layer;
  }
  if (kind !== "zone") {
    [["route", 160], ["material", 60], ["manager", 160], ["contractor", 160], ["supplyZone", 160]].forEach(([key, max]) => {
      if (body[key] !== undefined) payload[key] = String(body[key] || "").trim().slice(0, max);
    });
  }
  if (body.color !== undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(body.color))) throw new Error("Màu không hợp lệ");
    payload.color = String(body.color).toLowerCase();
  }
  if (body.opacity !== undefined) {
    const opacity = Number(body.opacity);
    if (!Number.isFinite(opacity)) throw new Error("Độ mờ không hợp lệ");
    payload.opacity = Math.min(0.7, Math.max(0.05, opacity));
  }
  if (body.diameter !== undefined && kind !== "zone") {
    const diameter = Number(body.diameter);
    if (!Number.isFinite(diameter) || diameter < 0 || diameter > 3000) throw new Error("Cỡ ống không hợp lệ");
    payload.diameter = Math.round(diameter);
  }
  if (body.coordinates !== undefined) {
    const coordinates = cleanCoordinates(body.coordinates, kind);
    if (!coordinates) throw new Error(kind === "zone" ? "Vùng cần ít nhất 3 điểm" : kind === "pipe" ? "Đường ống cần ít nhất 2 điểm" : "Thiếu toạ độ thiết bị");
    payload.coordinates = coordinates;
  }
  return payload;
};

const sendError = (res, error, fallback) => {
  const known = /không hợp lệ|ít nhất|Thiếu toạ độ/i.test(error.message);
  if (!known) console.error(`${fallback}:`, error.message);
  return res.status(known ? 400 : 500).json({ success: false, error: known ? error.message : fallback });
};

export const listMapShapes = async (req, res) => {
  try {
    const shapes = await MapShape.find({ user: getUserNumber(req, req.query) }).sort({ kind: 1, createdAt: 1 }).lean();
    return res.status(200).json({ success: true, shapes });
  } catch (error) {
    return sendError(res, error, "Không tải được vùng / đường ống");
  }
};

export const createMapShape = async (req, res) => {
  if (isReadOnlyRole(req)) return res.status(403).json({ success: false, error: "Tài khoản dùng thử không vẽ được" });
  try {
    const kind = ["pipe", "point"].includes(req.body?.kind) ? req.body.kind : "zone";
    if (req.body?.coordinates === undefined) throw new Error(kind === "zone" ? "Vùng cần ít nhất 3 điểm" : kind === "pipe" ? "Đường ống cần ít nhất 2 điểm" : "Thiếu toạ độ thiết bị");
    const shape = await MapShape.create({
      ...buildPayload(req.body || {}, kind),
      kind,
      user: getUserNumber(req, req.body),
      createdByName: req.user?.name || "",
    });
    return res.status(201).json({ success: true, shape });
  } catch (error) {
    return sendError(res, error, "Không lưu được hình vẽ");
  }
};

export const updateMapShape = async (req, res) => {
  if (isReadOnlyRole(req)) return res.status(403).json({ success: false, error: "Tài khoản dùng thử không sửa được" });
  try {
    const user = getUserNumber(req, req.body);
    const current = await MapShape.findOne({ _id: req.params.id, user }).lean();
    if (!current) return res.status(404).json({ success: false, error: "Không tìm thấy hình vẽ" });
    const shape = await MapShape.findOneAndUpdate(
      { _id: current._id, user },
      { $set: buildPayload(req.body || {}, current.kind) },
      { new: true, runValidators: true }
    ).lean();
    return res.status(200).json({ success: true, shape });
  } catch (error) {
    return sendError(res, error, "Không sửa được hình vẽ");
  }
};

export const deleteMapShape = async (req, res) => {
  if (isReadOnlyRole(req)) return res.status(403).json({ success: false, error: "Tài khoản dùng thử không xoá được" });
  try {
    const deleted = await MapShape.findOneAndDelete({ _id: req.params.id, user: getUserNumber(req, req.query) }).lean();
    if (!deleted) return res.status(404).json({ success: false, error: "Không tìm thấy hình vẽ" });
    return res.status(200).json({ success: true });
  } catch (error) {
    return sendError(res, error, "Không xoá được hình vẽ");
  }
};
