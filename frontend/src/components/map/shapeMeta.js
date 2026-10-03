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

export const describeShape = (shape) => (shape.kind === "pipe"
  ? `${shape.diameter ? `DN${shape.diameter} · ` : ""}${formatLength(lineLength(shape.coordinates))}`
  : formatArea(polygonArea(shape.coordinates)));
