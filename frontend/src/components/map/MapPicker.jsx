import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./leafletIconFix";
import { FaCheck, FaCrosshairs, FaSearch, FaTimes } from "react-icons/fa";

const DEFAULT_CENTER = [21.2731, 106.1946]; // Bac Giang
const DEFAULT_ZOOM = 16;

const ClickCatcher = ({ onPick }) => {
  useMapEvents({
    click: (event) => onPick([event.latlng.lat, event.latlng.lng]),
  });
  return null;
};

const Recenter = ({ position }) => {
  const map = useMapEvents({});
  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 17));
  }, [map, position]);
  return null;
};

const round6 = (value) => Number(Number(value).toFixed(6));

// Chap nhan ca "21.27, 106.19" lan URL Google Maps dang .../@21.27,106.19,17z
const parseCoordinateText = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;

  const fromUrl = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const parts = fromUrl
    ? [fromUrl[1], fromUrl[2]]
    : text.replace(/[()]/g, "").split(",").map((part) => part.trim());

  if (parts.length !== 2) return null;

  let lat = Number(parts[0]);
  let lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  if (Math.abs(lat) > 90 && Math.abs(lat) <= 180 && Math.abs(lng) <= 90) {
    [lat, lng] = [lng, lat];
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return [lat, lng];
};

const MapPicker = ({
  open,
  initialLat,
  initialLng,
  title = "Chọn toạ độ trên bản đồ",
  onCancel,
  onConfirm,
}) => {
  const initial = useMemo(() => {
    const lat = Number(initialLat);
    const lng = Number(initialLng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
  }, [initialLat, initialLng]);

  const [position, setPosition] = useState(initial);
  const [searchText, setSearchText] = useState("");
  const [searchError, setSearchError] = useState("");
  const [recenterTo, setRecenterTo] = useState(null);

  useEffect(() => {
    if (!open) return;
    setPosition(initial);
    setSearchText("");
    setSearchError("");
    setRecenterTo(initial);
  }, [open, initial]);

  if (!open) return null;

  const applySearch = () => {
    const parsed = parseCoordinateText(searchText);
    if (!parsed) {
      setSearchError("Không đọc được toạ độ. Ví dụ hợp lệ: 21.273100, 106.194600");
      return;
    }
    setSearchError("");
    setPosition(parsed);
    setRecenterTo(parsed);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setSearchError("Trình duyệt không hỗ trợ định vị");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const next = [result.coords.latitude, result.coords.longitude];
        setSearchError("");
        setPosition(next);
        setRecenterTo(next);
      },
      () => setSearchError("Không lấy được vị trí hiện tại. Hãy cho phép truy cập vị trí.")
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-[71] flex h-[min(90vh,46rem)] w-[min(96vw,64rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h3 className="text-lg font-black text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Đóng"
          >
            <FaTimes />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <FaSearch className="text-slate-400" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && applySearch()}
              placeholder="Dán toạ độ hoặc link Google Maps rồi Enter"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
            />
          </div>
          <button
            type="button"
            onClick={applySearch}
            className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
          >
            Tới toạ độ
          </button>
          <button
            type="button"
            onClick={useMyLocation}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:border-teal-300 hover:text-teal-700"
          >
            <FaCrosshairs /> Vị trí của tôi
          </button>
        </div>

        {searchError && (
          <div className="border-b border-rose-100 bg-rose-50 px-5 py-2 text-sm font-semibold text-rose-700">
            {searchError}
          </div>
        )}

        <div className="relative min-h-0 flex-1">
          <MapContainer
            center={position || initial || DEFAULT_CENTER}
            zoom={position || initial ? 17 : DEFAULT_ZOOM}
            className="h-full w-full"
          >
            <TileLayer
              url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
              subdomains={["mt1", "mt2", "mt3"]}
            />
            <TileLayer
              url="https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}"
              subdomains={["mt1", "mt2", "mt3"]}
            />
            <ClickCatcher onPick={setPosition} />
            <Recenter position={recenterTo} />
            {position && <Marker position={position} />}
          </MapContainer>

          <div className="pointer-events-none absolute left-1/2 top-3 z-[1000] -translate-x-1/2 rounded-full bg-slate-900/80 px-4 py-1.5 text-xs font-bold text-white">
            Bấm vào bản đồ để đặt điểm
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <div className="text-sm font-bold text-slate-700">
            {position
              ? `Toạ độ đã chọn: ${round6(position[0])}, ${round6(position[1])}`
              : "Chưa chọn điểm nào"}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={!position}
              onClick={() => onConfirm({ lat: round6(position[0]), lng: round6(position[1]) })}
              className="flex h-10 items-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FaCheck /> Dùng toạ độ này
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MapPicker;
