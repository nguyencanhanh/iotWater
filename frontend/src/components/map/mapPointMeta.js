import L from "leaflet";

export const POINT_TYPES = [
  { value: "leak", label: "Rò rỉ", color: "#0ea5e9", emoji: "💧" },
  { value: "burst", label: "Vỡ ống", color: "#dc2626", emoji: "💥" },
  { value: "repair", label: "Đang sửa chữa", color: "#f59e0b", emoji: "🔧" },
  { value: "valve", label: "Van", color: "#7c3aed", emoji: "🔩" },
  { value: "meter", label: "Đồng hồ", color: "#0d9488", emoji: "🔢" },
  { value: "other", label: "Khác", color: "#475569", emoji: "📍" },
];

export const POINT_SEVERITIES = [
  { value: "low", label: "Nhẹ", ring: "#94a3b8" },
  { value: "medium", label: "Trung bình", ring: "#f59e0b" },
  { value: "high", label: "Nghiêm trọng", ring: "#dc2626" },
];

export const POINT_STATUSES = [
  { value: "open", label: "Chưa xử lý", color: "#dc2626", badge: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "in_progress", label: "Đang xử lý", color: "#f59e0b", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "resolved", label: "Đã xử lý", color: "#16a34a", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
];

const byValue = (list) => Object.fromEntries(list.map((item) => [item.value, item]));

export const TYPE_MAP = byValue(POINT_TYPES);
export const SEVERITY_MAP = byValue(POINT_SEVERITIES);
export const STATUS_MAP = byValue(POINT_STATUSES);

export const getTypeMeta = (value) => TYPE_MAP[value] || TYPE_MAP.other;
export const getSeverityMeta = (value) => SEVERITY_MAP[value] || SEVERITY_MAP.medium;
export const getStatusMeta = (value) => STATUS_MAP[value] || STATUS_MAP.open;

// Diem da xu ly lam mo di de diem dang mo noi bat hon tren ban do.
export const createPointIcon = (point) => {
  const type = getTypeMeta(point?.type);
  const severity = getSeverityMeta(point?.severity);
  const resolved = point?.status === "resolved";

  return L.divIcon({
    className: "iot-map-point",
    html: `
      <div style="
        width:30px;height:30px;border-radius:9999px;
        background:${type.color};
        border:3px solid ${resolved ? "#ffffff" : severity.ring};
        box-shadow:0 2px 8px rgba(15,23,42,.45);
        display:flex;align-items:center;justify-content:center;
        font-size:14px;line-height:1;
        opacity:${resolved ? 0.55 : 1};
      ">${type.emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
};

export const createHotspotIcon = (count) => {
  const size = Math.min(34 + count * 3, 64);
  return L.divIcon({
    className: "iot-map-hotspot",
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:9999px;
        background:rgba(220,38,38,.28);
        border:2px solid rgba(220,38,38,.85);
        display:flex;align-items:center;justify-content:center;
        color:#7f1d1d;font-weight:900;font-size:${Math.min(12 + count, 18)}px;
      ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

export const formatPointDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export const toDateTimeLocal = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};
