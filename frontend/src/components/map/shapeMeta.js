// Vung / duong ong nguoi dung tu ve: mau, co ong, tinh chieu dai va dien tich.

export const SHAPE_COLORS = ["#2563eb", "#0ea5e9", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#64748b"];

// Co ong nuoc sach thuong dung (DN, mm).
export const PIPE_DIAMETERS = [20, 25, 32, 40, 50, 63, 75, 90, 110, 125, 160, 200, 225, 250, 280, 315, 400, 500, 600];

// Net ve day dan theo co ong: DN32 ~2.5px, DN110 ~3.8px, DN300 ~7px (toi da 9px).
export const pipeWeight = (diameter) => Math.min(9, Math.max(2, 2 + Number(diameter || 0) / 60));

const EARTH_RADIUS_M = 6371000;
const toRad = (degree) => (degree * Math.PI) / 180;

const distance = ([lat1, lng1], [lat2, lng2]) => {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const lineLength = (points = []) => points.reduce((sum, point, index) => (index ? sum + distance(points[index - 1], point) : 0), 0);

// Dien tich da giac (m2): chieu len mat phang quanh tam vung roi dung cong thuc shoelace.
export const polygonArea = (points = []) => {
  if (points.length < 3) return 0;
  const lat0 = toRad(points.reduce((sum, [lat]) => sum + lat, 0) / points.length);
  const xy = points.map(([lat, lng]) => [toRad(lng) * EARTH_RADIUS_M * Math.cos(lat0), toRad(lat) * EARTH_RADIUS_M]);
  let area = 0;
  xy.forEach(([x1, y1], index) => {
    const [x2, y2] = xy[(index + 1) % xy.length];
    area += x1 * y2 - x2 * y1;
  });
  return Math.abs(area) / 2;
};

export const formatLength = (meters) => (meters >= 1000
  ? `${(meters / 1000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} km`
  : `${Math.round(meters).toLocaleString("vi-VN")} m`);

export const formatArea = (squareMeters) => (squareMeters >= 10000
  ? `${(squareMeters / 10000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ha`
  : `${Math.round(squareMeters).toLocaleString("vi-VN")} m²`);

export const describeShape = (shape) => {
  if (shape.kind === "point") return shape.diameter ? `DN${shape.diameter}` : "";
  return shape.kind === "pipe"
    ? `${shape.diameter ? `DN${shape.diameter} · ` : ""}${formatLength(lineLength(shape.coordinates))}`
    : formatArea(polygonArea(shape.coordinates));
};

/* ------------------------------ Lop (giong CityWork) ------------------------------ */

// Ky hieu thiet bi (SVG 24x24) theo chu giai ban do mang luoi cap nuoc CityWork.
const SYMBOLS = {
  tee: '<path d="M12 3l8 9-8 9-8-9z" fill="#3b82f6" stroke="#fff" stroke-width="1.5"/>',
  airValve: '<circle cx="12" cy="12" r="8" fill="#bbf7d0" stroke="#16a34a" stroke-width="2"/><path d="M4 12h16" stroke="#16a34a" stroke-width="2"/>',
  drainValve: '<circle cx="12" cy="12" r="8" fill="#fef3c7" stroke="#57534e" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="#1c1917"/>',
  gateValve: '<circle cx="12" cy="12" r="8" fill="#fef9c3" stroke="#a16207" stroke-width="2"/><path d="M7 7l10 10M17 7L7 17" stroke="#a16207" stroke-width="2"/>',
  connection: '<circle cx="12" cy="12" r="5" fill="#1d4ed8" stroke="#fff" stroke-width="2"/>',
  hydrant: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="#ea580c" stroke="#fff" stroke-width="1.2"/><circle cx="12" cy="12" r="2.5" fill="#7c2d12"/>',
  tower: '<path d="M12 3l9 17H3z" fill="#d946ef" stroke="#fff" stroke-width="1.5"/>',
  pump: '<rect x="3" y="5" width="18" height="14" rx="2" fill="#bfdbfe" stroke="#1e40af" stroke-width="1.5"/><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" font-family="sans-serif" fill="#1e3a8a">WP</text>',
  masterMeter: '<circle cx="12" cy="12" r="9" fill="#99f6e4" stroke="#0f766e" stroke-width="1.5"/><path d="M8 8h8M12 8v9" stroke="#0f766e" stroke-width="2"/>',
  serviceMeter: '<circle cx="12" cy="12" r="7" fill="#dcfce7" stroke="#15803d" stroke-width="1.5"/><circle cx="12" cy="12" r="2.5" fill="#15803d"/>',
  plant: '<rect x="3" y="8" width="18" height="12" fill="#e2e8f0" stroke="#334155" stroke-width="1.5"/><path d="M5 8V4h3v4M10 8l4-3v3l4-3v3" fill="none" stroke="#334155" stroke-width="1.5"/>',
};

export const symbolMarkup = (key, size = 22) => (
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display:block;overflow:visible;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))">${SYMBOLS[key] || SYMBOLS.connection}</svg>`
);

// Nhom lop giong cay "Lop chuyen de" cua CityWork.
export const LAYER_GROUPS = [
  { key: "devices", label: "Thiết bị" },
  { key: "raw", label: "Mạng nước thô" },
  { key: "ttpp", label: "Mạng TTPP" },
  { key: "service", label: "Mạng dịch vụ" },
  { key: "other", label: "Khác" },
];

// Mau mac dinh theo lop, giong chu giai ban do mang luoi cap nuoc CityWork.
export const SHAPE_LAYERS = [
  { key: "tee", kind: "point", group: "devices", label: "Tê mút", color: "#3b82f6" },
  { key: "airValve", kind: "point", group: "devices", label: "Van xả khí", color: "#16a34a" },
  { key: "drainValve", kind: "point", group: "devices", label: "Van xả cặn", color: "#57534e" },
  { key: "gateValve", kind: "point", group: "devices", label: "Van chặn", color: "#a16207" },
  { key: "connection", kind: "point", group: "devices", label: "Điểm đấu nối", color: "#1d4ed8" },
  { key: "hydrant", kind: "point", group: "devices", label: "Trụ cứu hỏa", color: "#ea580c" },
  { key: "raw", kind: "pipe", group: "raw", label: "Đường ống nước thô", color: "#d946ef" },
  { key: "tower", kind: "point", group: "ttpp", label: "Đài nước", color: "#d946ef" },
  { key: "pump", kind: "point", group: "ttpp", label: "Trạm bơm", color: "#1e40af" },
  { key: "masterMeter", kind: "point", group: "ttpp", label: "Đồng hồ tổng", color: "#0f766e" },
  { key: "ttpp", kind: "pipe", group: "ttpp", label: "Đường ống TTPP", color: "#1d7f9e" },
  { key: "branch", kind: "pipe", group: "service", label: "Nhánh dịch vụ", color: "#22c55e" },
  { key: "service", kind: "pipe", group: "service", label: "Đường ống dịch vụ", color: "#eab308" },
  { key: "serviceMeter", kind: "point", group: "service", label: "Đồng hồ dịch vụ", color: "#15803d" },
  { key: "plant", kind: "point", group: "other", label: "Nhà máy", color: "#334155" },
  { key: "zone", kind: "zone", group: "other", label: "Phân vùng", color: "#2563eb" },
];

const LAYER_BY_KEY = Object.fromEntries(SHAPE_LAYERS.map((layer) => [layer.key, layer]));

const DEFAULT_LAYER = { pipe: "ttpp", point: "gateValve", zone: "zone" };

export const layerOf = (shape) => LAYER_BY_KEY[shape?.layer] || LAYER_BY_KEY[DEFAULT_LAYER[shape?.kind] || "zone"];

export const PIPE_MATERIALS = ["Ống HDPE", "Ống PVC", "Ống PPR", "Ống gang", "Ống gang dẻo", "Ống thép", "Ống thép tráng kẽm", "Ống bê tông", "Khác"];

/* ------------------------------ Bat diem ------------------------------ */

// Diem gan nhat tren doan AB (toa do man hinh) cua diem P.
export const projectOnSegment = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return { x: a.x + t * dx, y: a.y + t * dy, t };
};

export const DEFAULT_SNAP = { enabled: true, vertex: true, ends: true, line: true, tolerance: 14 };
