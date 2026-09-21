import { Marker, Popup, useMapEvents } from "react-leaflet";
import {
  createHotspotIcon,
  createPointIcon,
  formatPointDateTime,
  getSeverityMeta,
  getStatusMeta,
  getTypeMeta,
} from "./mapPointMeta";

const AddPointCatcher = ({ active, onPick }) => {
  useMapEvents({
    click: (event) => {
      if (!active) return;
      onPick({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) });
    },
  });
  return null;
};

const PointPopup = ({ point, canEdit, onEdit }) => {
  const type = getTypeMeta(point.type);
  const severity = getSeverityMeta(point.severity);
  const status = getStatusMeta(point.status);

  return (
    <Popup>
      <div className="min-w-[230px]">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-black text-white"
            style={{ backgroundColor: type.color }}
          >
            {type.label}
          </span>
          <span className={`rounded-md border px-2 py-0.5 text-[11px] font-black ${status.badge}`}>
            {status.label}
          </span>
          <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
            {severity.label}
          </span>
        </div>

        <h4 className="!m-0 text-sm font-black text-slate-900">{point.title}</h4>

        {point.address && <div className="mt-1 text-xs font-semibold text-slate-600">{point.address}</div>}
        {point.group && <div className="mt-0.5 text-xs font-semibold text-slate-500">Khu vực: {point.group}</div>}

        <div className="mt-1 text-xs text-slate-500">Phát hiện: {formatPointDateTime(point.occurredAt)}</div>
        {point.status === "resolved" && point.resolvedAt && (
          <div className="text-xs text-slate-500">Xử lý xong: {formatPointDateTime(point.resolvedAt)}</div>
        )}
        {point.createdByName && (
          <div className="text-xs text-slate-500">Người thêm: {point.createdByName}</div>
        )}

        {point.note && (
          <p className="!mb-0 mt-2 whitespace-pre-line text-xs leading-5 text-slate-700">{point.note}</p>
        )}

        <div className="mt-2 text-[11px] font-mono text-slate-400">
          {Number(point.lat).toFixed(6)}, {Number(point.lng).toFixed(6)}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(point)}
            className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
          >
            Sửa / xoá điểm
          </button>
        )}
      </div>
    </Popup>
  );
};

const MapPointLayer = ({
  points = [],
  hotspots = [],
  showPoints = true,
  showHotspots = false,
  addMode = false,
  canEdit = false,
  onPickLocation,
  onEdit,
}) => (
  <>
    <AddPointCatcher active={addMode} onPick={onPickLocation} />

    {showHotspots && hotspots.map((hotspot, index) => (
      <Marker
        key={`hotspot-${index}-${addMode}`}
        position={[hotspot.lat, hotspot.lng]}
        icon={createHotspotIcon(hotspot.count)}
        interactive={!addMode}
        zIndexOffset={-500}
      >
        <Popup>
          <div className="min-w-[190px]">
            <h4 className="!m-0 text-sm font-black text-slate-900">Khu vực tập trung sự cố</h4>
            <div className="mt-1 text-xs font-semibold text-slate-600">
              {hotspot.count} sự cố · {hotspot.open} chưa xử lý xong
            </div>
            {hotspot.high > 0 && (
              <div className="text-xs font-bold text-rose-600">{hotspot.high} sự cố nghiêm trọng</div>
            )}
            <div className="mt-1 text-xs text-slate-500">
              Gần nhất: {formatPointDateTime(hotspot.lastAt)}
            </div>
          </div>
        </Popup>
      </Marker>
    ))}

    {showPoints && points.map((point) => (
      <Marker
        key={`${point._id}-${addMode}`}
        position={[point.lat, point.lng]}
        icon={createPointIcon(point)}
        interactive={!addMode}
        zIndexOffset={500}
      >
        <PointPopup point={point} canEdit={canEdit} onEdit={onEdit} />
      </Marker>
    ))}
  </>
);

export default MapPointLayer;
