import { useState } from "react";
import PropTypes from "prop-types";
import { FaChevronLeft, FaChevronRight, FaDrawPolygon, FaTimes, FaUndo, FaCheck } from "react-icons/fa";
import { GiPipes } from "react-icons/gi";
import { PIPE_DIAMETERS, SHAPE_COLORS, describeShape, formatArea, formatLength, lineLength, pipeWeight, polygonArea } from "./shapeMeta";

const Toggle = ({ checked, onChange, children }) => (
  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-indigo-600" />
    {children}
  </label>
);

Toggle.propTypes = { checked: PropTypes.bool, onChange: PropTypes.func.isRequired, children: PropTypes.node };

// Bang ben phai: bat/tat vung + duong ong, bat dau ve, danh sach hinh da ve.
const MapDrawControl = ({ shapes, canEdit, showZones, showPipes, onToggleZones, onTogglePipes, onStartDraw, onFocus, drawingKind }) => {
  const [open, setOpen] = useState(false);
  const zones = shapes.filter((shape) => shape.kind === "zone");
  const pipes = shapes.filter((shape) => shape.kind === "pipe");
  const totalPipe = pipes.reduce((sum, shape) => sum + lineLength(shape.coordinates), 0);

  const list = (items) => items.map((shape) => (
    <button
      key={shape._id}
      type="button"
      onClick={() => onFocus(shape)}
      title="Bấm để xem trên bản đồ"
      className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-slate-100"
    >
      {shape.kind === "pipe" ? (
        <span className="w-5 shrink-0 rounded-full" style={{ backgroundColor: shape.color, height: pipeWeight(shape.diameter) }} />
      ) : (
        <span className="h-4 w-5 shrink-0 rounded-sm border-2" style={{ borderColor: shape.color, backgroundColor: `${shape.color}55` }} />
      )}
      <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">{shape.name || (shape.kind === "pipe" ? "Đường ống" : "Vùng")}</span>
      <span className="shrink-0 text-[11px] font-semibold text-slate-500">{describeShape(shape)}</span>
    </button>
  ));

  return (
    <div className={`transition-[width] duration-300 ${open ? "w-[330px] max-w-[calc(100vw-2rem)]" : "w-11"}`}>
      <div className={`relative w-full overflow-hidden rounded-lg bg-gray-50 shadow-lg transition-[padding] duration-300 ${open ? "p-4" : "p-1"}`}>
        <div className={`${open ? "mb-3" : ""} flex items-center gap-2`}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            title={open ? "Thu bảng vùng & đường ống" : "Mở bảng vùng & đường ống"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-indigo-600 text-white shadow hover:bg-indigo-700"
          >
            {open ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
          <h3 className={`${open ? "block" : "hidden"} truncate text-lg font-bold text-gray-800`}>Vùng &amp; đường ống</h3>
        </div>

        <div className={open ? "block space-y-3" : "hidden"}>
          <div className="space-y-2">
            <Toggle checked={showZones} onChange={onToggleZones}>Hiện vùng ({zones.length})</Toggle>
            <Toggle checked={showPipes} onChange={onTogglePipes}>
              Hiện đường ống ({pipes.length}{pipes.length ? ` · ${formatLength(totalPipe)}` : ""})
            </Toggle>
          </div>

          {canEdit && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={Boolean(drawingKind)}
                onClick={() => onStartDraw("zone")}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-2 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <FaDrawPolygon /> Vẽ vùng
              </button>
              <button
                type="button"
                disabled={Boolean(drawingKind)}
                onClick={() => onStartDraw("pipe")}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-2 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                <GiPipes /> Vẽ đường ống
              </button>
            </div>
          )}

          {Boolean(zones.length) && (
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Vùng</div>
              <div className="max-h-40 overflow-y-auto">{list(zones)}</div>
            </div>
          )}
          {Boolean(pipes.length) && (
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">Đường ống</div>
              <div className="max-h-40 overflow-y-auto">{list(pipes)}</div>
            </div>
          )}
          {!shapes.length && (
            <div className="text-xs font-semibold text-slate-400">Chưa có vùng hay đường ống nào. Bấm “Vẽ vùng” hoặc “Vẽ đường ống” để bắt đầu.</div>
          )}
        </div>
      </div>
    </div>
  );
};

MapDrawControl.propTypes = {
  shapes: PropTypes.array.isRequired,
  canEdit: PropTypes.bool,
  showZones: PropTypes.bool,
  showPipes: PropTypes.bool,
  onToggleZones: PropTypes.func.isRequired,
  onTogglePipes: PropTypes.func.isRequired,
  onStartDraw: PropTypes.func.isRequired,
  onFocus: PropTypes.func.isRequired,
  drawingKind: PropTypes.string,
};

// Thanh huong dan khi dang ve, nam tren dau ban do.
export const DrawToolbar = ({ drawing, onUndo, onFinish, onCancel }) => {
  const min = drawing.kind === "zone" ? 3 : 2;
  const measure = drawing.kind === "zone" ? formatArea(polygonArea(drawing.points)) : formatLength(lineLength(drawing.points));
  return (
    <div className="absolute left-1/2 top-3 z-[60] w-[min(94vw,40rem)] -translate-x-1/2 rounded-2xl border border-indigo-200 bg-white/95 p-3 shadow-xl backdrop-blur">
      <div className="text-sm font-black text-slate-900">
        {drawing.editing ? "Đang sửa hình" : drawing.kind === "zone" ? "Đang vẽ vùng" : "Đang vẽ đường ống"}
        <span className="ml-2 text-xs font-bold text-indigo-700">{drawing.points.length} điểm · {measure}</span>
      </div>
      <div className="mt-0.5 text-xs font-semibold text-slate-500">
        Bấm lên bản đồ để thêm điểm. Kéo chấm tròn để chỉnh, bấm vào chấm để xoá điểm đó.
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onUndo} disabled={!drawing.points.length} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
          <FaUndo /> Hoàn tác
        </button>
        <button type="button" onClick={onFinish} disabled={drawing.points.length < min} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40" title={`Cần ít nhất ${min} điểm`}>
          <FaCheck /> Xong
        </button>
        <button type="button" onClick={onCancel} className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50">
          <FaTimes /> Huỷ
        </button>
      </div>
    </div>
  );
};

DrawToolbar.propTypes = {
  drawing: PropTypes.object.isRequired,
  onUndo: PropTypes.func.isRequired,
  onFinish: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

const fieldLabel = "mb-1 block text-xs font-black uppercase tracking-wide text-slate-500";
const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white";

// Dat ten / mau / do mo (vung) hoac co ong (duong ong) sau khi ve xong, hoac khi sua.
export const ShapeForm = ({ draft, saving, error, onChange, onSave, onRedraw, onDelete, onCancel }) => {
  const isPipe = draft.kind === "pipe";
  return (
    <>
      <div className="fixed inset-0 z-[80] bg-slate-900/50" onClick={onCancel} />
      <form
        onSubmit={(event) => { event.preventDefault(); onSave(); }}
        className="fixed left-1/2 top-1/2 z-[81] max-h-[92vh] w-[min(94vw,28rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
      >
        <h3 className="text-lg font-black text-slate-900">
          {draft._id ? "Sửa" : "Lưu"} {isPipe ? "đường ống" : "vùng"}
        </h3>
        <div className="mt-0.5 text-xs font-semibold text-slate-500">
          {draft.coordinates.length} điểm · {isPipe ? formatLength(lineLength(draft.coordinates)) : formatArea(polygonArea(draft.coordinates))}
        </div>

        <label className="mt-3 block">
          <span className={fieldLabel}>Tên</span>
          <input
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder={isPipe ? "VD: Ống HDPE D110 Lê Lợi" : "VD: Vùng DMA Bách Việt"}
            className={inputClass}
            autoFocus
          />
        </label>

        <div className="mt-3">
          <span className={fieldLabel}>Màu</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {SHAPE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Màu ${color}`}
                aria-pressed={draft.color === color}
                onClick={() => onChange({ color })}
                className={`h-8 w-8 rounded-full border-2 ${draft.color === color ? "border-slate-900 ring-2 ring-slate-300" : "border-white shadow"}`}
                style={{ backgroundColor: color }}
              />
            ))}
            <input
              type="color"
              value={draft.color}
              onChange={(event) => onChange({ color: event.target.value })}
              title="Chọn màu khác"
              className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white"
            />
          </div>
        </div>

        {isPipe ? (
          <label className="mt-3 block">
            <span className={fieldLabel}>Cỡ ống (DN, mm)</span>
            <select value={draft.diameter} onChange={(event) => onChange({ diameter: Number(event.target.value) })} className={inputClass}>
              <option value={0}>Không rõ</option>
              {PIPE_DIAMETERS.map((size) => <option key={size} value={size}>DN{size}</option>)}
            </select>
            <span className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-400">
              Nét vẽ trên bản đồ:
              <span className="w-16 rounded-full" style={{ backgroundColor: draft.color, height: pipeWeight(draft.diameter) }} />
            </span>
          </label>
        ) : (
          <label className="mt-3 block">
            <span className={fieldLabel}>Độ mờ: {Math.round((draft.opacity ?? 0.25) * 100)}%</span>
            <input
              type="range"
              min="0.05"
              max="0.6"
              step="0.05"
              value={draft.opacity ?? 0.25}
              onChange={(event) => onChange({ opacity: Number(event.target.value) })}
              className="w-full accent-indigo-600"
            />
          </label>
        )}

        <label className="mt-3 block">
          <span className={fieldLabel}>Ghi chú</span>
          <textarea
            value={draft.note}
            onChange={(event) => onChange({ note: event.target.value })}
            rows={2}
            placeholder={isPipe ? "Vật liệu, năm lắp đặt…" : "Mô tả vùng…"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white"
          />
        </label>

        {error && <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</div>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={onRedraw} className="h-10 rounded-xl border border-indigo-200 px-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50">
              Sửa hình
            </button>
            {draft._id && (
              <button type="button" onClick={onDelete} className="h-10 rounded-xl border border-rose-200 px-3 text-sm font-bold text-rose-600 hover:bg-rose-50">
                Xoá
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">Huỷ</button>
            <button type="submit" disabled={saving} className="h-10 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
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
  onChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onRedraw: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default MapDrawControl;
