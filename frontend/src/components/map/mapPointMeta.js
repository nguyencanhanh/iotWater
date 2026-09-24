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

// Dung hinh GHIM (giot nuoc up nguoc) thay vi cham tron: nen ban do ve tinh cua
// Google co rat nhieu icon tron cua dia diem, cham tron bi lan vao va rat kho thay.
// Chua xu ly: mau theo muc do ro ri + vong nhay o chan ghim. Da xu ly: ghim xanh la co dau tich.
export const createPointIcon = (point) => {
  const resolved = point?.status === "resolved";
  const color = resolved ? "#16a34a" : getLeakColor(point?.leakRate);
  const width = resolved ? 34 : 44;
  const height = Math.round(width * 1.3);

  const glyph = resolved
    ? `<path d="M14.5 21.5l4 4 8-9" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M20 11.5c2.6 3.4 5 6.6 5 9.4a5 5 0 0 1-10 0c0-2.8 2.4-6 5-9.4z" fill="${color}"/>`;

  return L.divIcon({
    className: `iot-map-point ${resolved ? "" : "iot-map-point--open"}`,
    html: `
      <div class="iot-map-point__wrap" style="width:${width}px;height:${height}px;">
        ${resolved ? "" : `<span class="iot-map-point__pulse" style="border-color:${color};"></span>`}
        <svg viewBox="0 0 40 52" width="${width}" height="${height}" style="display:block;overflow:visible;filter:drop-shadow(0 3px 4px rgba(0,0,0,.55));">
          <path d="M20 1.5C10 1.5 2 9.3 2 19.2c0 12.6 15.6 29 17 30.5a1.4 1.4 0 0 0 2 0C22.4 48.2 38 31.8 38 19.2 38 9.3 30 1.5 20 1.5z"
                fill="${color}" stroke="#ffffff" stroke-width="3"/>
          <circle cx="20" cy="19.5" r="10.5" fill="#ffffff"/>
          ${glyph}
        </svg>
      </div>`,
    iconSize: [width, height],
    // Mui ghim cham dung vi tri su co.
    iconAnchor: [width / 2, height - 1],
    popupAnchor: [0, -height + 4],
    // Bang thong tin noi (Tooltip) nam ngay tren dinh ghim.
    tooltipAnchor: [0, -height + 2],
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
