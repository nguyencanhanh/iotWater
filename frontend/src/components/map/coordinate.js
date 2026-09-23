// Doc toa do tu chuoi nguoi dung dan vao: "21.27, 106.19", "(21.27, 106.19)",
// hoac link Google Maps dang ".../@21.27,106.19,17z" / "...?q=21.27,106.19".
export const parseCoordinateText = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;

  const fromUrl = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/)
    || text.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  const parts = fromUrl
    ? [fromUrl[1], fromUrl[2]]
    : text.replace(/[()]/g, "").split(/[,;\s]+/).filter(Boolean);

  if (parts.length !== 2) return null;

  let lat = Number(parts[0]);
  let lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // Nguoi dung dan nguoc thu tu kinh do, vi do.
  if (Math.abs(lat) > 90 && Math.abs(lat) <= 180 && Math.abs(lng) <= 90) {
    [lat, lng] = [lng, lat];
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
};

export const formatCoordinate = (lat, lng) => (
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
    ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
    : ""
);
