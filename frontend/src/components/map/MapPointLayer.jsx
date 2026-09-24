import { Marker, Popup, Tooltip, useMapEvents } from "react-leaflet";
import {
  createHotspotIcon,
  createPointIcon,
  formatPointDateTime,
  getLeakColor,
  getLeakLabel,
  getStatusMeta,
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

const PointPopup = ({ point, canEdit, onEdit, imageUrl }) => {
  const status = getStatusMeta(point.status);

  return (
    <Popup>
      <div className="min-w-[240px]">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-black text-white"
            style={{ backgroundColor: getLeakColor(point.leakRate) }}
          >
            {getLeakLabel(point.leakRate)}
          </span>
          <span className={`rounded-md border px-2 py-0.5 text-[11px] font-black ${status.badge}`}>
            {status.label}
          </span>
          {point.typeName && (
            <span className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {point.typeName}
            </span>
          )}
        </div>

        <h4 className="!m-0 text-sm font-black text-slate-900">{point.title}</h4>

        {point.group && <div className="mt-1 text-xs font-semibold text-slate-500">Khu vực: {point.group}</div>}

        <div className="mt-1 text-xs text-slate-500">Phát hiện: {formatPointDateTime(point.occurredAt)}</div>
        {point.status === "resolved" ? (
          point.resolvedAt && (
            <div className="text-xs font-semibold text-emerald-700">
              Xử lý xong: {formatPointDateTime(point.resolvedAt)}
            </div>
          )
        ) : point.unresolvedReason ? (
          <div className="text-xs font-semibold text-rose-700">Lý do chưa xử lý: {point.unresolvedReason}</div>
        ) : null}
        {point.createdByName && (
          <div className="text-xs text-slate-500">Người thêm: {point.createdByName}</div>
        )}

        {point.note && (
          <p className="!mb-0 mt-2 whitespace-pre-line text-xs leading-5 text-slate-700">{point.note}</p>
        )}

        {Boolean(point.images?.length) && imageUrl && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {point.images.slice(0, 4).map((name) => (
              <a key={name} href={imageUrl(point._id, name)} target="_blank" rel="noopener noreferrer">
                <img
                  src={imageUrl(point._id, name)}
                  alt="Ảnh sự cố"
                  className="h-14 w-14 rounded border border-slate-200 object-cover"
                />
              </a>
            ))}
            {point.images.length > 4 && (
              <span className="self-center text-[11px] font-bold text-slate-500">
                +{point.images.length - 4}
              </span>
            )}
          </div>
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

// Bang nho noi tren dau diem, cung kieu bang so lieu tren dau logger.
const PointLabel = ({ point }) => {
  const status = getStatusMeta(point.status);
  return (
    <Tooltip permanent direction="top" className="iot-point-label">
      <div className="min-w-[150px] rounded-md border-2 bg-white p-1 shadow" style={{ borderColor: status.color }}>
        <h3 className="max-w-[200px] truncate font-semibold">{point.title}</h3>
        <table className="w-full">
          <tbody>
            <tr>
              <td className="border border-gray-300 text-left text-gray-600">Mức độ</td>
              <td className="border border-gray-300 text-center font-bold" style={{ color: getLeakColor(point.leakRate) }}>
                {getLeakLabel(point.leakRate)}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 text-left text-gray-600">Trạng thái</td>
              <td className="border border-gray-300 text-center font-bold" style={{ color: status.color }}>{status.label}</td>
            </tr>
            {point.typeName && (
              <tr>
                <td className="border border-gray-300 text-left text-gray-600">Loại</td>
                <td className="border border-gray-300 text-center text-gray-600">{point.typeName}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Tooltip>
  );
};

const MapPointLayer = ({
  points = [],
  hotspots = [],
  showPoints = true,
  showHotspots = false,
  showLabels = false,
  addMode = false,
  canEdit = false,
  onPickLocation,
  onEdit,
  imageUrl,
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
        {showLabels && <PointLabel point={point} />}
        <PointPopup point={point} canEdit={canEdit} onEdit={onEdit} imageUrl={imageUrl} />
      </Marker>
    ))}
  </>
);

export default MapPointLayer;
