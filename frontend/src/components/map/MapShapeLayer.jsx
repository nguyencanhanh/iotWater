import { useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import L from "leaflet";
import { Marker, Pane, Polygon, Polyline, Popup, useMap, useMapEvents } from "react-leaflet";
import { describeShape, pipeWeight } from "./shapeMeta";

const vertexIcon = (color, first) => L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:${first ? color : "#fff"};border:3px solid ${color};box-shadow:0 1px 3px rgba(0,0,0,.5);cursor:move"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Khi dang ve: bam ban do them diem, tat phong to khi bam dup de khong nham.
const DrawCatcher = ({ active, onAdd }) => {
  const map = useMap();
  useEffect(() => {
    if (!active) return undefined;
    map.doubleClickZoom.disable();
    map.getContainer().style.cursor = "crosshair";
    return () => {
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = "";
    };
  }, [active, map]);
  useMapEvents({
    click: (event) => {
      if (active) onAdd([Number(event.latlng.lat.toFixed(7)), Number(event.latlng.lng.toFixed(7))]);
    },
  });
  return null;
};

// Bay toi hinh duoc chon trong danh sach.
const FocusShape = ({ shape }) => {
  const map = useMap();
  useEffect(() => {
    if (!shape?.coordinates?.length) return;
    map.fitBounds(L.latLngBounds(shape.coordinates), { padding: [60, 60], maxZoom: 18 });
  }, [map, shape]);
  return null;
};

// Popup luon o tang popup mac dinh: neu de theo tang cua vung (350) thi bi chinh vung de len.
const ShapePopup = ({ shape, canEdit, onEdit, onDelete }) => (
  <Popup pane="popupPane">
    <div className="min-w-[200px]">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: shape.color }} />
        <h4 className="!m-0 text-sm font-black text-slate-900">
          {shape.name || (shape.kind === "pipe" ? "Đường ống" : "Vùng")}
        </h4>
      </div>
      <div className="mt-1 text-xs font-semibold text-slate-600">
        {shape.kind === "pipe" ? "Đường ống nước sạch" : "Phân vùng"} · {describeShape(shape)}
      </div>
      {shape.note && <p className="!mb-0 mt-1 whitespace-pre-line text-xs text-slate-700">{shape.note}</p>}
      {canEdit && (
        <div className="mt-2 flex gap-1.5">
          <button type="button" onClick={() => onEdit(shape)} className="rounded-lg bg-teal-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-700">
            Sửa
          </button>
          <button type="button" onClick={() => onDelete(shape)} className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50">
            Xoá
          </button>
        </div>
      )}
    </div>
  </Popup>
);

const MapShapeLayer = ({
  shapes,
  showZones,
  showPipes,
  drawing,
  editingId,
  busy,
  canEdit,
  focus,
  preview,
  onAddVertex,
  onMoveVertex,
  onRemoveVertex,
  onEdit,
  onDelete,
}) => {
  const visible = useMemo(
    () => shapes.filter((shape) => shape._id !== editingId && (shape.kind === "pipe" ? showPipes : showZones)),
    [shapes, editingId, showPipes, showZones]
  );
  const interactive = !busy && !drawing;

  return (
    <>
      <DrawCatcher active={Boolean(drawing)} onAdd={onAddVertex} />
      <FocusShape shape={focus} />

      {/* Tang ve: vung (350) nam DUOI lop ong / dong ho co san (overlayPane 400) de khong che
          cho bam cua chung; duong ong ve tay (450) nam TREN de bam trung ong cua minh. */}
      <Pane name="userZones" style={{ zIndex: 350 }}>
      {visible.filter((shape) => shape.kind === "zone").map((shape) => (
        <Polygon
          key={`${shape._id}-${interactive}`}
          positions={shape.coordinates}
          pathOptions={{ color: shape.color, weight: 2, fillColor: shape.color, fillOpacity: shape.opacity ?? 0.25, interactive }}
        >
          {interactive && <ShapePopup shape={shape} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />}
        </Polygon>
      ))}
      </Pane>
      <Pane name="userPipes" style={{ zIndex: 450 }}>
      {visible.filter((shape) => shape.kind === "pipe").map((shape) => (
        <Polyline
          key={`${shape._id}-${interactive}`}
          positions={shape.coordinates}
          pathOptions={{ color: shape.color, weight: pipeWeight(shape.diameter), opacity: 0.95, lineCap: "round", interactive }}
        >
          {interactive && <ShapePopup shape={shape} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />}
        </Polyline>
      ))}
      </Pane>

      {/* Hinh dang cho luu / sua trong form (khong nhan bam). */}
      {preview && !drawing && (preview.kind === "zone" ? (
        <Polygon positions={preview.coordinates} pathOptions={{ color: preview.color, weight: 2, fillColor: preview.color, fillOpacity: preview.opacity ?? 0.25, interactive: false }} />
      ) : (
        <Polyline positions={preview.coordinates} pathOptions={{ color: preview.color, weight: pipeWeight(preview.diameter), opacity: 0.95, interactive: false }} />
      ))}
      {drawing && drawing.points.length > 0 && (
        drawing.kind === "zone" ? (
          <Polygon
            positions={drawing.points}
            pathOptions={{ color: drawing.color, weight: 2, dashArray: "6 4", fillColor: drawing.color, fillOpacity: drawing.opacity ?? 0.25, interactive: false }}
          />
        ) : (
          <Polyline
            positions={drawing.points}
            pathOptions={{ color: drawing.color, weight: pipeWeight(drawing.diameter), opacity: 0.85, dashArray: "8 6", interactive: false }}
          />
        )
      )}
      {drawing && drawing.points.map((point, index) => (
        <Marker
          // eslint-disable-next-line react/no-array-index-key
          key={`vertex-${index}`}
          position={point}
          draggable
          icon={vertexIcon(drawing.color, index === 0)}
          title="Kéo để chỉnh vị trí · bấm để xoá điểm này"
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = event.target.getLatLng();
              onMoveVertex(index, [Number(lat.toFixed(7)), Number(lng.toFixed(7))]);
            },
            // Marker khong lan su kien click xuong ban do nen khong bi them diem moi.
            click: () => onRemoveVertex(index),
          }}
        />
      ))}
    </>
  );
};

MapShapeLayer.propTypes = {
  shapes: PropTypes.array.isRequired,
  showZones: PropTypes.bool,
  showPipes: PropTypes.bool,
  drawing: PropTypes.object,
  editingId: PropTypes.string,
  busy: PropTypes.bool,
  canEdit: PropTypes.bool,
  focus: PropTypes.object,
  preview: PropTypes.object,
  onAddVertex: PropTypes.func.isRequired,
  onMoveVertex: PropTypes.func.isRequired,
  onRemoveVertex: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

export default MapShapeLayer;
