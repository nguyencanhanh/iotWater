import InfoSen from "../models/Info.js";
import MapPoint from "../models/MapPoint.js";
import { getTypeLabel, getSeverityLabel, getStatusLabel } from "./incidentLabels.js";

const EARTH_RADIUS_M = 6371000;
const DEFAULT_RADIUS_M = 500;
const MAX_INCIDENTS = 40;
const LOOKBACK_DAYS = 7;

const toRad = (degree) => (degree * Math.PI) / 180;

// Prompt cam dung ISO/UTC nen phai dinh dang san theo gio Viet Nam.
const formatVnDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const haversineMeters = (a, b) => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

const isValidCoord = (point) => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));

// Hop bao quanh tat ca logger, noi rong them ban kinh -> loc so bo bang index 2dsphere
// truoc khi tinh khoang cach chinh xac trong JS.
const buildBoundingBox = (loggers, radiusMeters) => {
  const lats = loggers.map((logger) => logger.lat);
  const lngs = loggers.map((logger) => logger.lng);
  const latPad = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lngPad = latPad / Math.max(Math.cos(toRad(midLat)), 0.01);

  return [
    [Math.min(...lngs) - lngPad, Math.min(...lats) - latPad],
    [Math.max(...lngs) + lngPad, Math.max(...lats) + latPad],
  ];
};

export const findIncidentsNearLoggers = async ({
  user,
  loggerIds = [],
  fromDate,
  toDate,
  radiusMeters = DEFAULT_RADIUS_M,
  limit = MAX_INCIDENTS,
}) => {
  const ids = [...new Set(loggerIds.map(Number).filter(Number.isFinite))];
  if (!ids.length) return [];

  const loggers = (await InfoSen.find({ user, id: { $in: ids } })
    .select("id name lat lng")
    .lean())
    .filter(isValidCoord)
    .map((logger) => ({ id: Number(logger.id), name: logger.name, lat: Number(logger.lat), lng: Number(logger.lng) }));

  if (!loggers.length) return [];

  const end = toDate ? new Date(toDate) : new Date();
  const start = fromDate ? new Date(fromDate) : new Date(end.getTime() - LOOKBACK_DAYS * 86400000);
  const lookbackStart = new Date(start.getTime() - LOOKBACK_DAYS * 86400000);

  const box = buildBoundingBox(loggers, radiusMeters);

  const candidates = await MapPoint.find({
    user,
    location: { $geoWithin: { $box: box } },
    occurredAt: { $lte: end },
    // Su co cu nhung chua xu ly xong van con anh huong den so lieu trong ky.
    $or: [
      { occurredAt: { $gte: lookbackStart, $lte: end } },
      { status: { $ne: "resolved" } },
    ],
  })
    .select("title type severity status lat lng address note group occurredAt resolvedAt")
    .sort({ occurredAt: -1 })
    .limit(300)
    .lean();

  const withDistance = candidates
    .map((incident) => {
      let nearest = null;
      let minDistance = Infinity;

      loggers.forEach((logger) => {
        const distance = haversineMeters(logger, { lat: incident.lat, lng: incident.lng });
        if (distance < minDistance) {
          minDistance = distance;
          nearest = logger;
        }
      });

      return { incident, nearest, distance: minDistance };
    })
    .filter((item) => item.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);

  return withDistance.map(({ incident, nearest, distance }) => ({
    title: incident.title,
    type: getTypeLabel(incident.type),
    severity: getSeverityLabel(incident.severity),
    status: getStatusLabel(incident.status),
    nearestLoggerId: nearest.id,
    nearestLoggerName: nearest.name,
    distanceMeters: Math.round(distance),
    occurredAt: formatVnDateTime(incident.occurredAt),
    resolvedAt: formatVnDateTime(incident.resolvedAt),
    address: incident.address || "",
    group: incident.group || "",
    note: String(incident.note || "").slice(0, 300),
    // Dung chuoi tieng Viet thay vi co true/false: neu model co lo field nay ra
    // van ban thi nguoi van hanh van doc hieu.
    thoiDiem: incident.occurredAt >= start && incident.occurredAt <= end
      ? "xảy ra trong kỳ phân tích"
      : "xảy ra trước kỳ phân tích và chưa xử lý xong",
  }));
};
