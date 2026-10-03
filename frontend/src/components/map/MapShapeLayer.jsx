import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import L from "leaflet";
import { CircleMarker, Marker, Pane, Polygon, Polyline, useMap, useMapEvents } from "react-leaflet";
import { layerOf, pipeWeight, projectOnSegment, symbolMarkup } from "./shapeMeta";

// Ve / hien vung va duong ong nguoi dung tu ve, theo kieu CityWork: mau theo lop, so DN doc
// theo ong, bam chon ong (to do) de xem thuoc tinh, ve co bat diem + duong ke theo con tro.

const SELECTED_COLOR = "#ef4444";
const LABEL_MIN_ZOOM = 16;

const vertexIcon = (color, first) => L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:9999px;background:${first ? color : "#fff"};border:3px solid ${color};box-shadow:0 1px 3px rgba(0,0,0,.5);cursor:move"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Thiet bi: ky hieu theo lop; dang chon thi them vong do.
const deviceIcon = (shape, selected) => L.divIcon({
  className: "",
  html: `<div style="position:relative;width:22px;height:22px">${selected ? '<div style="position:absolute;inset:-6px;border:3px solid #ef4444;border-radius:9999px"></div>' : ""}${symbolMarkup(layerOf(shape).key, 22)}</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const shapeColor = (shape) => shape.color || layerOf(shape).color;
const round7 = (value) => Number(value.toFixed(7));

// Tim diem bat gan con tro nhat (toa do man hinh) trong cac hinh da ve.
const findSnap = (map, latlng, targets, snap) => {
  if (!snap.enabled) return null;
  const p = map.latLngToContainerPoint(latlng);
  // Dinh / dau mut trong tam bat luon duoc uu tien; chi khi khong co moi bat vao than ong.
  let bestPoint = null;
  let bestLine = null;
  const consider = (point, kind) => {
    const d = Math.hypot(point.x - p.x, point.y - p.y);
    if (d > snap.tolerance) return;
    if (kind === "line") {
      if (!bestLine || d < bestLine.d) bestLine = { point, d, kind };
    } else if (!bestPoint || d < bestPoint.d) bestPoint = { point, d, kind, source: point.source };
  };
  targets.forEach((coords) => {
    const pts = coords.map(([lat, lng]) => map.latLngToContainerPoint([lat, lng]));
    pts.forEach((point, index) => {
      const isEnd = index === 0 || index === pts.length - 1;
      const vertex = Object.assign(point.clone(), { source: coords[index] });
      if (isEnd && snap.ends) consider(vertex, "end");
      else if (!isEnd && snap.vertex) consider(vertex, "vertex");
      if (snap.line && index > 0) consider(projectOnSegment(p, pts[index - 1], point), "line");
    });
  });
  const best = bestPoint || bestLine;
  if (!best) return null;
  // Bat vao dinh: dung nguyen toa do cua dinh (khong doi qua toa do man hinh) de noi khit.
  const ll = map.containerPointToLatLng([best.point.x, best.point.y]);
  return { latlng: best.source || [round7(ll.lat), round7(ll.lng)], kind: best.kind };
};

// Bat su kien khi dang ve: bam them diem (co bat diem), di chuot ve duong ke, bam dup de xong.
const DrawCatcher = ({ drawing, targets, snap, onAdd, onFinish, onCursor }) => {
  const map = useMap();
  useEffect(() => {
    if (!drawing) return undefined;
    map.doubleClickZoom.disable();
    map.getContainer().style.cursor = "crosshair";
    return () => {
      map.doubleClickZoom.enable();
      map.getContainer().style.cursor = "";
    };
  }, [drawing, map]);
  useMapEvents({
    click: (event) => {
      if (!drawing) return;
      const hit = findSnap(map, event.latlng, targets, snap);
      onAdd(hit ? hit.latlng : [round7(event.latlng.lat), round7(event.latlng.lng)]);
    },
    mousemove: (event) => {
      if (!drawing) return;
      const hit = findSnap(map, event.latlng, targets, snap);
      onCursor(hit ? { latlng: hit.latlng, snapped: hit.kind } : { latlng: [event.latlng.lat, event.latlng.lng], snapped: null });
    },
    mouseout: () => drawing && onCursor(null),
    dblclick: () => drawing && onFinish(),
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

// So DN viet doc theo ong (nhu ban do CityWork), chi khi phong to.
const PipeLabels = ({ pipes }) => {
  const map = useMap();
  const [tick, setTick] = useState(0);
  useMapEvents({ zoomend: () => setTick((value) => value + 1), moveend: () => setTick((value) => value + 1) });
  const zoom = map.getZoom();
  const labels = useMemo(() => {
    if (zoom < LABEL_MIN_ZOOM) return [];
    const bounds = map.getBounds().pad(0.2);
    return pipes.filter((pipe) => pipe.diameter > 0).flatMap((pipe) => {
      const pts = pipe.coordinates.map(([lat, lng]) => map.latLngToContainerPoint([lat, lng]));
      // Moi doan du dai (>= 70px) co 1 nhan o giua, xoay theo huong doan.
      return pts.slice(1).map((b, index) => {
        const a = pts[index];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 70) return null;
        const mid = map.containerPointToLatLng([(a.x + b.x) / 2, (a.y + b.y) / 2]);
        if (!bounds.contains(mid)) return null;
        let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        return { key: `${pipe._id}-${index}`, position: mid, angle, text: pipe.diameter };
      }).filter(Boolean);
    });
  }, [map, pipes, zoom, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  return labels.map((label) => (
    <Marker
      key={label.key}
      position={label.position}
      interactive={false}
      pane="userPipeLabels"
      icon={L.divIcon({
        className: "",
        html: `<div class="iot-pipe-label" style="transform:translate(-50%,-50%) rotate(${label.angle}deg) translateY(-9px)">${label.text}</div>`,
        iconSize: [0, 0],
      })}
    />
  ));
};

const MapShapeLayer = ({
  shapes,
  hiddenLayers = [],
  drawing,
  editingId,
  busy,
  focus,
  preview,
  selectedId,
  snap,
  onAddVertex,
  onMoveVertex,
  onRemoveVertex,
  onFinish,
  onSelect,
}) => {
  const [cursor, setCursor] = useState(null);
  const visible = useMemo(
    () => shapes.filter((shape) => shape._id !== editingId && !hiddenLayers.includes(layerOf(shape).key)),
    [shapes, editingId, hiddenLayers]
  );
  const zones = visible.filter((shape) => shape.kind === "zone");
  const pipes = visible.filter((shape) => shape.kind === "pipe");
  const devices = visible.filter((shape) => shape.kind === "point");
  const interactive = !busy && !drawing;
  // Diem bat duoc: moi hinh dang hien (tru hinh dang sua).
  const targets = useMemo(() => visible.map((shape) => shape.coordinates), [visible]);

  useEffect(() => {
    if (!drawing) setCursor(null);
  }, [drawing]);

  const drawColor = drawing ? (drawing.color || layerOf(drawing).color) : "#000";
  const last = drawing?.points?.[drawing.points.length - 1];

  return (
    <>
      <DrawCatcher drawing={Boolean(drawing)} targets={targets} snap={snap} onAdd={onAddVertex} onFinish={onFinish} onCursor={setCursor} />
      <FocusShape shape={focus} />

      {/* Vung (350) nam duoi lop ong / dong ho co san (400); ong ve tay (450) nam tren; nhan DN (460). */}
      <Pane name="userZones" style={{ zIndex: 350 }}>
        {zones.map((shape) => (
          <Polygon
            key={`${shape._id}-${interactive}-${selectedId === shape._id}`}
            positions={shape.coordinates}
            eventHandlers={{ click: () => interactive && onSelect(shape) }}
            pathOptions={{
              color: selectedId === shape._id ? SELECTED_COLOR : shapeColor(shape),
              weight: selectedId === shape._id ? 3 : 2,
              fillColor: shapeColor(shape),
              fillOpacity: shape.opacity ?? 0.25,
              interactive,
            }}
          />
        ))}
      </Pane>
      <Pane name="userPipes" style={{ zIndex: 450 }}>
        {pipes.map((shape) => (
          <Polyline
            key={`${shape._id}-${interactive}-${selectedId === shape._id}`}
            positions={shape.coordinates}
            eventHandlers={{ click: () => interactive && onSelect(shape) }}
            pathOptions={{
              color: selectedId === shape._id ? SELECTED_COLOR : shapeColor(shape),
              weight: pipeWeight(shape.diameter) + (selectedId === shape._id ? 2 : 0),
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
              interactive,
            }}
          />
        ))}
      </Pane>
      <Pane name="userPipeLabels" style={{ zIndex: 460, pointerEvents: "none" }}>
        <PipeLabels pipes={pipes} />
      </Pane>
      {devices.map((shape) => (
        <Marker
          key={`${shape._id}-${interactive}-${selectedId === shape._id}`}
          position={shape.coordinates[0]}
          icon={deviceIcon(shape, selectedId === shape._id)}
          interactive={interactive}
          title={`${layerOf(shape).label}${shape.name ? `: ${shape.name}` : ""}`}
          zIndexOffset={-200}
          eventHandlers={{ click: () => interactive && onSelect(shape) }}
        />
      ))}

      {/* Hinh dang mo trong form (khong nhan bam). */}
      {preview && !drawing && preview.kind === "point" && (
        <Marker position={preview.coordinates[0]} icon={deviceIcon(preview, true)} interactive={false} />
      )}
      {preview && !drawing && preview.kind !== "point" && (preview.kind === "zone" ? (
        <Polygon positions={preview.coordinates} pathOptions={{ color: SELECTED_COLOR, weight: 3, fillColor: shapeColor(preview), fillOpacity: preview.opacity ?? 0.25, interactive: false }} />
      ) : (
        <Polyline positions={preview.coordinates} pathOptions={{ color: SELECTED_COLOR, weight: pipeWeight(preview.diameter) + 2, opacity: 0.95, interactive: false }} />
      ))}

      {drawing && drawing.points.length > 0 && (
        drawing.kind === "zone" ? (
          <Polygon positions={drawing.points} pathOptions={{ color: drawColor, weight: 2, dashArray: "6 4", fillColor: drawColor, fillOpacity: drawing.opacity ?? 0.25, interactive: false }} />
        ) : (
          <Polyline positions={drawing.points} pathOptions={{ color: drawColor, weight: pipeWeight(drawing.diameter), opacity: 0.9, interactive: false }} />
        )
      )}
      {/* Duong ke tu diem cuoi toi con tro (vung: ve them canh ve diem dau). */}
      {drawing && last && cursor && (
        <Polyline
          positions={drawing.kind === "zone" && drawing.points.length > 1 ? [last, cursor.latlng, drawing.points[0]] : [last, cursor.latlng]}
          pathOptions={{ color: drawColor, weight: 2, dashArray: "4 6", opacity: 0.9, interactive: false }}
        />
      )}
      {drawing && cursor?.snapped && (
        <CircleMarker
          center={cursor.latlng}
          radius={7}
          pathOptions={{ color: "#facc15", weight: 3, fillColor: "#fff", fillOpacity: 0.9, interactive: false }}
        />
      )}
      {drawing && drawing.points.map((point, index) => (
        <Marker
          // eslint-disable-next-line react/no-array-index-key
          key={`vertex-${index}`}
          position={point}
          draggable
          icon={vertexIcon(drawColor, index === 0)}
          title="Kéo để chỉnh vị trí · bấm để xoá điểm này"
          eventHandlers={{
            dragend: (event) => {
              const { lat, lng } = event.target.getLatLng();
              onMoveVertex(index, [round7(lat), round7(lng)]);
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
  hiddenLayers: PropTypes.array,
  drawing: PropTypes.object,
  editingId: PropTypes.string,
  busy: PropTypes.bool,
  focus: PropTypes.object,
  preview: PropTypes.object,
  selectedId: PropTypes.string,
  snap: PropTypes.object.isRequired,
  onAddVertex: PropTypes.func.isRequired,
  onMoveVertex: PropTypes.func.isRequired,
  onRemoveVertex: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default MapShapeLayer;
