import L from "leaflet";
import { getLeakColor, getLeakLabel } from "./leakRate";

// Chi con 2 trang thai theo yeu cau van hanh.
export const POINT_STATUSES = [
  { value: "open", label: "Chưa xử lý", color: "#dc2626", badge: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "resolved", label: "Đã xử lý", color: "#16a34a", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
];

const STATUS_MAP = Object.fromEntries(POINT_STATUSES.map((item) => [item.value, item]));

export const getStatusMeta = (value) => STATUS_MAP[value] || STATUS_MAP.open;

export { getLeakColor, getLeakLabel };

// Mau cham theo MUC DO ro ri, diem da xu ly thi lam mo di.
export const createPointIcon = (point) => {
  const color = getLeakColor(point?.leakRate);
  const resolved = point?.status === "resolved";

  return L.divIcon({
    className: "iot-map-point",
    html: `
      <div style="
        width:26px;height:26px;border-radius:9999px;
        background:${color};
        border:3px solid ${resolved ? "#16a34a" : "#ffffff"};
        box-shadow:0 2px 8px rgba(15,23,42,.45);
        display:flex;align-items:center;justify-content:center;
        font-size:12px;line-height:1;color:#fff;font-weight:900;
        opacity:${resolved ? 0.6 : 1};
      ">${resolved ? "✓" : "!"}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
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

export const toDateInput = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};
