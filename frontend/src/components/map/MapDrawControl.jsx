import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { FaChevronLeft, FaChevronRight, FaDrawPolygon, FaTimes, FaUndo, FaRedo, FaCheck, FaMagnet, FaPen, FaTrashAlt, FaDrawPolygon as FaShape, FaMapPin } from "react-icons/fa";
import { GiPipes } from "react-icons/gi";
import {
  PIPE_DIAMETERS,
  PIPE_MATERIALS,
  LAYER_GROUPS,
  SHAPE_COLORS,
  SHAPE_LAYERS,
  symbolMarkup,
  describeShape,
  formatArea,
  formatLength,
  layerOf,
  lineLength,
  pipeWeight,
  polygonArea,
} from "./shapeMeta";

const swatch = (layer, color) => (layer.kind === "point" ? (
  <span className="flex w-6 shrink-0 justify-center" dangerouslySetInnerHTML={{ __html: symbolMarkup(layer.key, 18) }} />
) : layer.kind === "pipe" ? (
  <span className="w-6 shrink-0 rounded-full" style={{ backgroundColor: color || layer.color, height: 4 }} />
) : (
  <span className="h-4 w-6 shrink-0 rounded-sm border-2" style={{ borderColor: color || layer.color, backgroundColor: `${color || layer.color}55` }} />
));

const layerTotal = (layer, items) => {
  if (!items.length) return "";
  if (layer.kind === "pipe") return formatLength(items.reduce((sum, shape) => sum + lineLength(shape.coordinates), 0));
  if (layer.kind === "zone") return formatArea(items.reduce((sum, shape) => sum + polygonArea(shape.coordinates), 0));
  return "";
};

// Bang ben phai, 2 tab nhu CityWork: "Lop ban do" (bat / tat theo nhom, danh sach) va "Chu giai".
const MapDrawControl = ({ shapes, canEdit, hiddenLayers, onToggleLayer, onStartDraw, onFocus, drawingKind }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("layers");
  const [openLayer, setOpenLayer] = useState("");

  // Bat dau ve thi thu bang lai de nhuong cho ban do (nhat la tren dien thoai).
  useEffect(() => {
    if (drawingKind) setOpen(false);
  }, [drawingKind]);

  const groupLayers = (group) => SHAPE_LAYERS.filter((layer) => layer.group === group.key);
  const groupChecked = (group) => groupLayers(group).every((layer) => !hiddenLayers.includes(layer.key));
  const toggleGroup = (group) => {
    const turnOn = !groupChecked(group);
    groupLayers(group).forEach((layer) => {
      if (hiddenLayers.includes(layer.key) === turnOn) onToggleLayer(layer.key);
    });
  };

  return (
    <div className={`transition-[width] duration-300 ${open ? "w-[340px] max-w-[calc(100vw-2rem)]" : "w-11"}`}>
      <div className={`relative w-full overflow-hidden rounded-lg bg-gray-50 shadow-lg transition-[padding] duration-300 ${open ? "p-4" : "p-1"}`}>
        <div className={`${open ? "mb-3" : ""} flex items-center gap-2`}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            title={open ? "Thu bảng mạng lưới cấp nước" : "Mở bảng mạng lưới cấp nước"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-indigo-600 text-white shadow hover:bg-indigo-700"
          >
            {open ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
          <h3 className={`${open ? "block" : "hidden"} truncate text-lg font-bold text-gray-800`}>Mạng lưới cấp nước</h3>
        </div>

        <div className={open ? "block space-y-3" : "hidden"}>
          {canEdit && (
            <div className="grid grid-cols-3 gap-1.5">
              <button type="button" disabled={Boolean(drawingKind)} onClick={() => onStartDraw("pipe")} className="flex items-center justify-center gap-1 rounded-xl bg-sky-700 px-1.5 py-2 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-50">
                <GiPipes /> Vẽ ống
              </button>
              <button type="button" disabled={Boolean(drawingKind)} onClick={() => onStartDraw("point")} className="flex items-center justify-center gap-1 rounded-xl bg-amber-600 px-1.5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                <FaMapPin /> Thiết bị
              </button>
              <button type="button" disabled={Boolean(drawingKind)} onClick={() => onStartDraw("zone")} className="flex items-center justify-center gap-1 rounded-xl bg-indigo-600 px-1.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                <FaDrawPolygon /> Vẽ vùng
              </button>
            </div>
          )}

          <div className="flex border-b border-slate-200">
            {[["layers", "Lớp bản đồ"], ["legend", "Chú giải"]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-bold ${tab === key ? "border-teal-600 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "layers" ? (
            <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
              {LAYER_GROUPS.map((group) => (
                <div key={group.key}>
                  <label className="flex cursor-pointer items-center gap-2 py-0.5 text-sm font-black text-slate-800">
                    <input type="checkbox" checked={groupChecked(group)} onChange={() => toggleGroup(group)} className="h-4 w-4 accent-indigo-600" aria-label={`Hiện nhóm ${group.label}`} />
                    {group.label}
                  </label>
                  <div className="ml-4 border-l border-slate-200 pl-2">
                    {groupLayers(group).map((layer) => {
                      const items = shapes.filter((shape) => layerOf(shape).key === layer.key);
                      return (
                        <div key={layer.key}>
                          <div className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-slate-100">
                            <input
                              type="checkbox"
                              checked={!hiddenLayers.includes(layer.key)}
                              onChange={() => onToggleLayer(layer.key)}
                              aria-label={`Hiện ${layer.label}`}
                              className="h-4 w-4 accent-indigo-600"
                            />
                            {swatch(layer)}
                            <button
                              type="button"
                              onClick={() => setOpenLayer(openLayer === layer.key ? "" : layer.key)}
                              className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-slate-700"
                              title="Bấm để xem danh sách"
                            >
                              {layer.label} <span className="text-slate-400">({items.length})</span>
                            </button>
                            <span className="shrink-0 text-[11px] font-semibold text-slate-500">{layerTotal(layer, items)}</span>
                          </div>
                          {openLayer === layer.key && (
                            <div className="mb-1 ml-6 max-h-40 overflow-y-auto border-l border-slate-200 pl-2">
                              {items.map((shape) => (
                                <button
                                  key={shape._id}
                                  type="button"
                                  onClick={() => onFocus(shape)}
                                  className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-slate-100"
                                >
                                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">{shape.name || "(chưa đặt tên)"}</span>
                                  <span className="shrink-0 text-[11px] text-slate-500">{describeShape(shape)}</span>
                                </button>
                              ))}
                              {!items.length && <div className="py-1 text-xs text-slate-400">Chưa có</div>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {canEdit && (
                <div className="rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-800">
                  Bấm vào một ký hiệu để vẽ / đặt đối tượng đó lên bản đồ.
                </div>
              )}
              {SHAPE_LAYERS.map((layer) => (
                <div key={layer.key}>
                  <div className="text-xs font-black text-slate-800">{layer.label}</div>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={Boolean(drawingKind)}
                      onClick={() => onStartDraw(layer.kind, layer.key)}
                      title={`${layer.kind === "point" ? "Đặt" : "Vẽ"} ${layer.label} lên bản đồ`}
                      className="ml-3 flex w-[calc(100%-0.75rem)] items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm font-semibold text-rose-600 hover:bg-amber-100 disabled:opacity-50"
                    >
                      {swatch(layer)} <span className="flex-1">{layer.label}</span>
                      <span className="text-[11px] font-bold text-amber-700">{layer.kind === "point" ? "+ Đặt" : "+ Vẽ"}</span>
                    </button>
                  ) : (
                    <div className="ml-3 flex items-center gap-2 py-0.5 text-sm font-semibold text-rose-600">
                      {swatch(layer)} {layer.label}
                    </div>
                  )}
                </div>
              ))}
              <div className="text-[11px] font-semibold text-slate-500">Số trên đường ống là đường kính (DN, mm). Nét càng dày ống càng to.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

MapDrawControl.propTypes = {
  shapes: PropTypes.array.isRequired,
  canEdit: PropTypes.bool,
  hiddenLayers: PropTypes.array.isRequired,
  onToggleLayer: PropTypes.func.isRequired,
  onStartDraw: PropTypes.func.isRequired,
  onFocus: PropTypes.func.isRequired,
  drawingKind: PropTypes.string,
};

// Thanh cong cu khi dang ve (tren dau ban do): lop, bat diem, hoan tac / lam lai, xong / huy.
export const DrawToolbar = ({ drawing, snap, onSnapChange, onLayerChange, onRepeatChange, onUndo, onRedo, onFinish, onCancel }) => {
  const min = { zone: 3, pipe: 2, point: 1 }[drawing.kind];
  const canFinish = drawing.points.length >= min;
  const [snapOpen, setSnapOpen] = useState(false);
  const measure = drawing.kind === "zone" ? formatArea(polygonArea(drawing.points)) : drawing.kind === "pipe" ? formatLength(lineLength(drawing.points)) : "";

  // Phim tat: Ctrl+Z / Ctrl+Y, Enter xong, Esc huy.
  useEffect(() => {
    const onKey = (event) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey) { event.preventDefault(); onUndo(); }
      else if ((event.ctrlKey || event.metaKey) && (key === "y" || (key === "z" && event.shiftKey))) { event.preventDefault(); onRedo(); }
      else if (key === "enter" && canFinish) { event.preventDefault(); onFinish(); }
      else if (key === "escape") { event.preventDefault(); onCancel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canFinish, onUndo, onRedo, onFinish, onCancel]);

  const layers = SHAPE_LAYERS.filter((layer) => layer.kind === drawing.kind);
  const tool = "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold disabled:opacity-40";

  return (
    <div className="absolute left-1/2 top-3 z-[60] w-[min(96vw,46rem)] -translate-x-1/2 rounded-2xl border border-indigo-200 bg-white/95 p-3 shadow-xl backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-slate-900">{drawing.editing ? (drawing.kind === "point" ? "Đổi vị trí" : "Sửa hình") : { zone: "Vẽ vùng", pipe: "Vẽ đường ống", point: "Đặt thiết bị" }[drawing.kind]}</span>
        {layers.length > 1 && drawing.kind !== "point" && (
          <select
            value={layerOf(drawing).key}
            onChange={(event) => onLayerChange(event.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold"
            title="Lớp đang vẽ"
          >
            {layers.map((layer) => <option key={layer.key} value={layer.key}>{layer.label}</option>)}
          </select>
        )}
        {drawing.kind !== "point" && <span className="text-xs font-bold text-indigo-700">{drawing.points.length} điểm · {measure}</span>}
        <span className={`ml-auto rounded-md px-2 py-0.5 text-[11px] font-bold ${snap.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
          {snap.enabled ? "Đang bắt điểm" : "Không bắt điểm"}
        </span>
      </div>
      {drawing.kind === "point" && !drawing.editing && (
        <div className="mt-2 flex flex-wrap gap-1">
          {layers.map((layer) => (
            <button
              key={layer.key}
              type="button"
              onClick={() => onLayerChange(layer.key)}
              aria-pressed={layerOf(drawing).key === layer.key}
              title={layer.label}
              className={`flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[11px] font-bold ${layerOf(drawing).key === layer.key ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200" : "border-slate-200 bg-white text-slate-600 hover:border-amber-300"}`}
            >
              <span dangerouslySetInnerHTML={{ __html: symbolMarkup(layer.key, 16) }} />
              {layer.label}
            </button>
          ))}
        </div>
      )}
      <div className="mt-1 text-xs font-semibold text-slate-500">
        {drawing.kind === "point" ? "Bấm vào vị trí đặt thiết bị (gần ống sẽ tự bắt vào ống)." : <>Bấm bản đồ để thêm điểm (gần đỉnh / đầu ống / thân ống khác sẽ tự bắt vào). Bấm đúp hoặc Enter để xong, Esc huỷ. Kéo chấm để chỉnh, bấm chấm để xoá.</>}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {drawing.kind === "point" && !drawing.editing && (
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700" title="Lưu xong tiếp tục đặt thiết bị cùng loại">
            <input type="checkbox" checked={Boolean(drawing.repeat)} onChange={(event) => onRepeatChange(event.target.checked)} className="h-4 w-4 accent-amber-600" />
            Đặt liên tiếp
          </label>
        )}
        {drawing.kind !== "point" && (
        <button type="button" onClick={onUndo} disabled={!drawing.points.length} className={`${tool} border border-slate-200 text-slate-700 hover:bg-slate-50`} title="Hoàn tác (Ctrl+Z)">
          <FaUndo /> Hoàn tác
        </button>)}
        {drawing.kind !== "point" && (
        <button type="button" onClick={onRedo} disabled={!drawing.future?.length} className={`${tool} border border-slate-200 text-slate-700 hover:bg-slate-50`} title="Làm lại (Ctrl+Y)">
          <FaRedo /> Làm lại
        </button>)}
        <div className="relative">
          <button type="button" onClick={() => setSnapOpen((prev) => !prev)} className={`${tool} border ${snap.enabled ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600"}`} title="Thiết lập bắt điểm">
            <FaMagnet /> Bắt điểm
          </button>
          {snapOpen && (
            <div className="absolute left-0 top-9 z-10 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {[
                ["enabled", "Bật bắt điểm"],
                ["vertex", "Trên các đỉnh của đường"],
                ["line", "Trên toàn bộ đường"],
                ["ends", "Trên hai điểm đầu - cuối"],
              ].map(([key, label]) => (
                <label key={key} className={`flex cursor-pointer items-center gap-2 py-1 text-xs font-bold ${key !== "enabled" && !snap.enabled ? "text-slate-400" : "text-slate-700"}`}>
                  <input
                    type="checkbox"
                    checked={Boolean(snap[key])}
                    disabled={key !== "enabled" && !snap.enabled}
                    onChange={(event) => onSnapChange({ ...snap, [key]: event.target.checked })}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
        {drawing.kind !== "point" && (
        <button type="button" onClick={onFinish} disabled={!canFinish} className={`${tool} bg-indigo-600 text-white hover:bg-indigo-700`} title={`Cần ít nhất ${min} điểm (Enter)`}>
          <FaCheck /> Xong
        </button>)}
        <button type="button" onClick={onCancel} className={`${tool} border border-rose-200 text-rose-600 hover:bg-rose-50`} title="Huỷ (Esc)">
          <FaTimes /> Huỷ
        </button>
      </div>
    </div>
  );
};

DrawToolbar.propTypes = {
  drawing: PropTypes.object.isRequired,
  snap: PropTypes.object.isRequired,
  onSnapChange: PropTypes.func.isRequired,
  onLayerChange: PropTypes.func.isRequired,
  onRepeatChange: PropTypes.func,
  onUndo: PropTypes.func.isRequired,
  onRedo: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

// Bang thuoc tinh ben trai khi bam chon 1 ong / vung (giong tab "Thuoc tinh" cua CityWork).
export const ShapeInfoPanel = ({ shape, canEdit, onEdit, onRedraw, onDelete, onClose }) => {
  const layer = layerOf(shape);
  const rows = shape.kind === "pipe"
    ? [
      ["Tên ống", shape.name], ["Lớp", layer.label], ["Tuyến", shape.route],
      ["Đường kính (mm)", shape.diameter || ""], ["Chiều dài (m)", Math.round(lineLength(shape.coordinates)).toLocaleString("vi-VN")],
      ["Chất liệu", shape.material], ["Đơn vị quản lý", shape.manager], ["Đơn vị thi công", shape.contractor],
      ["Vùng cấp nước", shape.supplyZone], ["Ghi chú", shape.note], ["Người vẽ", shape.createdByName],
    ]
    : shape.kind === "point"
      ? [["Tên / số hiệu", shape.name], ["Lớp", layer.label], ["Cỡ (DN)", shape.diameter || ""], ["Tuyến", shape.route],
        ["Đơn vị quản lý", shape.manager], ["Toạ độ", shape.coordinates[0].map((value) => value.toFixed(6)).join(", ")], ["Ghi chú", shape.note], ["Người tạo", shape.createdByName]]
      : [["Tên vùng", shape.name], ["Lớp", layer.label], ["Diện tích", formatArea(polygonArea(shape.coordinates))], ["Ghi chú", shape.note], ["Người vẽ", shape.createdByName]];
  const action = "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold";
  return (
    <div className="absolute bottom-3 left-3 top-16 z-[55] flex w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl bg-white shadow-xl">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        {swatch(layer, shape.color)}
        <div className="min-w-0 flex-1 truncate text-sm font-black text-sky-800">{layer.label}</div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Đóng"><FaTimes /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-slate-100">
                <td className="w-[42%] px-3 py-1.5 align-top text-xs font-semibold text-slate-500">{label}:</td>
                <td className="whitespace-pre-line px-2 py-1.5 font-bold text-sky-800">{value || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-slate-200 p-2">
        {canEdit && <button type="button" onClick={onEdit} className={`${action} bg-indigo-600 text-white hover:bg-indigo-700`}><FaPen /> Sửa</button>}
        {canEdit && <button type="button" onClick={onRedraw} className={`${action} border border-indigo-200 text-indigo-700 hover:bg-indigo-50`}><FaShape /> {shape.kind === "point" ? "Đổi vị trí" : "Sửa hình"}</button>}
        {canEdit && <button type="button" onClick={onDelete} className={`${action} border border-rose-200 text-rose-600 hover:bg-rose-50`}><FaTrashAlt /> Xoá</button>}
        <button type="button" onClick={onClose} className={`${action} border border-slate-200 text-slate-600 hover:bg-slate-50`}>Đóng</button>
      </div>
    </div>
  );
};

ShapeInfoPanel.propTypes = {
  shape: PropTypes.object.isRequired,
  canEdit: PropTypes.bool,
  onEdit: PropTypes.func.isRequired,
  onRedraw: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

const fieldLabel = "mb-1 block text-xs font-black uppercase tracking-wide text-slate-500";
const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white";

const TextField = ({ label, value, onChange, placeholder, list }) => (
  <label className="block">
    <span className={fieldLabel}>{label}</span>
    <input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} list={list} className={inputClass} />
  </label>
);

TextField.propTypes = { label: PropTypes.string, value: PropTypes.string, onChange: PropTypes.func, placeholder: PropTypes.string, list: PropTypes.string };

// Form thuoc tinh sau khi ve xong hoac khi bam "Sua".
export const ShapeForm = ({ draft, saving, error, suggestions, onChange, onSave, onRedraw, onDelete, onCancel }) => {
  const isPipe = draft.kind === "pipe";
  const isPoint = draft.kind === "point";
  const layer = layerOf(draft);
  const color = draft.color || layer.color;
  const kindName = { pipe: "đường ống", zone: "vùng", point: "thiết bị" }[draft.kind];
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-slate-900/50" onClick={onCancel} />
      <form
        onSubmit={(event) => { event.preventDefault(); onSave(); }}
        className="fixed left-1/2 top-1/2 z-[81] max-h-[92vh] w-[min(94vw,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
      >
        <h3 className="text-lg font-black text-slate-900">{draft._id ? "Sửa" : "Lưu"} {kindName}</h3>
        <div className="mt-0.5 text-xs font-semibold text-slate-500">
          {isPoint
            ? `Toạ độ ${draft.coordinates[0].map((value) => value.toFixed(6)).join(", ")}`
            : `${draft.coordinates.length} điểm · ${isPipe ? `chiều dài ${formatLength(lineLength(draft.coordinates))}` : `diện tích ${formatArea(polygonArea(draft.coordinates))}`}`}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={fieldLabel}>Lớp</span>
            <select value={layer.key} onChange={(event) => onChange({ layer: event.target.value, color: "" })} className={inputClass}>
              {SHAPE_LAYERS.filter((item) => item.kind === draft.kind).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2">
            <TextField
              label={isPipe ? "Tên ống" : isPoint ? "Tên / số hiệu" : "Tên vùng"}
              value={draft.name}
              onChange={(name) => onChange({ name })}
              placeholder={isPipe ? "VD: D200 ÚC LÊ LỢI" : isPoint ? "VD: Van chặn V12 Lê Lợi" : "VD: Vùng cấp nước Bách Việt"}
            />
          </div>
          {isPoint && (
            <>
              <label className="block">
                <span className={fieldLabel}>Cỡ (DN, mm)</span>
                <select value={draft.diameter || 0} onChange={(event) => onChange({ diameter: Number(event.target.value) })} className={inputClass}>
                  <option value={0}>Không rõ</option>
                  {PIPE_DIAMETERS.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <TextField label="Tuyến" value={draft.route} onChange={(route) => onChange({ route })} list="shape-routes" />
              <div className="sm:col-span-2">
                <TextField label="Đơn vị quản lý" value={draft.manager} onChange={(manager) => onChange({ manager })} list="shape-managers" />
              </div>
              <datalist id="shape-routes">{suggestions.routes.map((item) => <option key={item} value={item} />)}</datalist>
              <datalist id="shape-managers">{suggestions.managers.map((item) => <option key={item} value={item} />)}</datalist>
            </>
          )}
          {isPipe && (
            <>
              <label className="block">
                <span className={fieldLabel}>Đường kính (mm)</span>
                <select value={draft.diameter} onChange={(event) => onChange({ diameter: Number(event.target.value) })} className={inputClass}>
                  <option value={0}>Không rõ</option>
                  {PIPE_DIAMETERS.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={fieldLabel}>Chất liệu</span>
                <select value={draft.material || ""} onChange={(event) => onChange({ material: event.target.value })} className={inputClass}>
                  <option value="">—</option>
                  {PIPE_MATERIALS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <TextField label="Tuyến" value={draft.route} onChange={(route) => onChange({ route })} list="shape-routes" />
              <TextField label="Vùng cấp nước" value={draft.supplyZone} onChange={(supplyZone) => onChange({ supplyZone })} list="shape-zones" />
              <TextField label="Đơn vị quản lý" value={draft.manager} onChange={(manager) => onChange({ manager })} list="shape-managers" />
              <TextField label="Đơn vị thi công" value={draft.contractor} onChange={(contractor) => onChange({ contractor })} list="shape-managers" />
              <datalist id="shape-routes">{suggestions.routes.map((item) => <option key={item} value={item} />)}</datalist>
              <datalist id="shape-zones">{suggestions.zones.map((item) => <option key={item} value={item} />)}</datalist>
              <datalist id="shape-managers">{suggestions.managers.map((item) => <option key={item} value={item} />)}</datalist>
            </>
          )}
        </div>

        <div className={`mt-3 ${isPoint ? "hidden" : ""}`}>
          <span className={fieldLabel}>Màu {draft.color ? "" : "(theo lớp)"}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ color: "" })}
              className={`h-8 rounded-full border-2 px-2 text-[11px] font-bold ${!draft.color ? "border-slate-900" : "border-slate-200"}`}
              style={{ color: layer.color }}
            >
              Theo lớp
            </button>
            {SHAPE_COLORS.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`Màu ${item}`}
                aria-pressed={draft.color === item}
                onClick={() => onChange({ color: item })}
                className={`h-8 w-8 rounded-full border-2 ${draft.color === item ? "border-slate-900 ring-2 ring-slate-300" : "border-white shadow"}`}
                style={{ backgroundColor: item }}
              />
            ))}
            <input type="color" value={color} onChange={(event) => onChange({ color: event.target.value })} title="Chọn màu khác" className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white" />
          </div>
          {isPipe && (
            <span className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
              Nét vẽ: <span className="w-16 rounded-full" style={{ backgroundColor: color, height: pipeWeight(draft.diameter) }} />
            </span>
          )}
        </div>

        {draft.kind === "zone" && (
          <label className="mt-3 block">
            <span className={fieldLabel}>Độ mờ: {Math.round((draft.opacity ?? 0.25) * 100)}%</span>
            <input type="range" min="0.05" max="0.6" step="0.05" value={draft.opacity ?? 0.25} onChange={(event) => onChange({ opacity: Number(event.target.value) })} className="w-full accent-indigo-600" />
          </label>
        )}

        <label className="mt-3 block">
          <span className={fieldLabel}>Ghi chú</span>
          <textarea value={draft.note || ""} onChange={(event) => onChange({ note: event.target.value })} rows={2} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white" />
        </label>

        {error && <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</div>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={onRedraw} className="h-10 rounded-xl border border-indigo-200 px-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50">{isPoint ? "Đổi vị trí" : "Sửa hình"}</button>
            {draft._id && <button type="button" onClick={onDelete} className="h-10 rounded-xl border border-rose-200 px-3 text-sm font-bold text-rose-600 hover:bg-rose-50">Xoá</button>}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">Huỷ</button>
            <button type="submit" disabled={saving} className="h-10 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? "Đang lưu…" : "Lưu"}</button>
          </div>
        </div>
      </form>
    </>
  );
};

ShapeForm.propTypes = {
  draft: PropTypes.object.isRequired,
  saving: PropTypes.bool,
  error: PropTypes.string,
  suggestions: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onRedraw: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default MapDrawControl;
