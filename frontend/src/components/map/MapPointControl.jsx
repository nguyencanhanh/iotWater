import { useState } from "react";
import {
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaChevronUp,
  FaFire,
  FaPlus,
  FaSyncAlt,
  FaTimes,
} from "react-icons/fa";
import { FaFileAlt } from "react-icons/fa";
import { POINT_STATUSES } from "./mapPointMeta";
import { LEAK_RATE_BUCKETS, getLeakColor } from "./leakRate";

const Toggle = ({ checked, onChange, children }) => (
  <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 accent-teal-600"
    />
    {children}
  </label>
);

const MapPointControl = ({
  stats,
  loading,
  error,
  canEdit,
  showPoints,
  onTogglePoints,
  showHotspots,
  onToggleHotspots,
  addMode,
  onToggleAddMode,
  typeFilter,
  onTypeFilter,
  statusFilter,
  onStatusFilter,
  onReload,
  types = [],
  onOpenReport,
}) => {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pending = Number(stats?.open || 0) + Number(stats?.inProgress || 0);

  // Thu gon ve ben phai giong bang "Trang thai cam bien" va "Tin nhan thong bao".
  return (
    <div className={`transition-[width] duration-300 ${open ? "w-[330px] max-w-[calc(100vw-2rem)]" : "w-11"}`}>
      <div className={`relative w-full overflow-hidden rounded-lg bg-gray-50 shadow-lg transition-[padding] duration-300 ${open ? "p-4" : "p-1"}`}>
        <div className={`${open ? "mb-3" : ""} flex items-center gap-2`}>
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            title={open ? "Thu bảng điểm sự cố" : "Mở bảng điểm sự cố"}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded bg-rose-600 text-white shadow hover:bg-rose-700"
          >
            {open ? <FaChevronRight /> : <FaChevronLeft />}
            {/* Thu gon roi van phai thay con bao nhieu su co chua xong. */}
            {!open && pending > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-rose-600 shadow">
                {pending > 99 ? "99+" : pending}
              </span>
            )}
          </button>

          <div className={`${open ? "flex" : "hidden"} min-w-0 flex-1 items-center justify-between gap-2`}>
            <h3 className="truncate text-lg font-bold text-gray-800">Điểm sự cố</h3>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={onReload}
                title="Tải lại"
                className="flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-200"
              >
                <FaSyncAlt className={loading ? "animate-spin" : ""} />
              </button>
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                title={expanded ? "Ẩn bộ lọc" : "Hiện bộ lọc"}
                className="flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-200"
              >
                {expanded ? <FaChevronUp /> : <FaChevronDown />}
              </button>
            </div>
          </div>
        </div>

        <div className={open ? "block" : "hidden"}>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded-lg bg-slate-100 px-1 py-1.5">
              <div className="text-base font-black leading-none text-slate-800">{stats.total}</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase text-slate-600">Tổng</div>
            </div>
            <div className="rounded-lg bg-rose-50 px-1 py-1.5">
              <div className="text-base font-black leading-none text-rose-700">{stats.open}</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase text-rose-600">Chưa xử lý</div>
            </div>
            <div className="rounded-lg bg-emerald-50 px-1 py-1.5">
              <div className="text-base font-black leading-none text-emerald-700">{stats.resolved}</div>
              <div className="mt-0.5 text-[10px] font-bold uppercase text-emerald-600">Đã xử lý</div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <Toggle checked={showPoints} onChange={onTogglePoints}>
              Hiện điểm trên bản đồ
            </Toggle>
            <Toggle checked={showHotspots} onChange={onToggleHotspots}>
              <span className="flex items-center gap-1.5">
                <FaFire className="text-orange-500" /> Khu vực tập trung sự cố
              </span>
            </Toggle>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => onToggleAddMode(!addMode)}
              className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                addMode
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "bg-teal-600 text-white hover:bg-teal-700"
              }`}
            >
              {addMode ? <><FaTimes /> Huỷ thêm điểm</> : <><FaPlus /> Thêm điểm mới</>}
            </button>
          )}

          {addMode && (
            <div className="mt-2 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-2 text-xs font-bold text-teal-800">
              Bấm vào vị trí trên bản đồ để đặt điểm.
            </div>
          )}

          <button
            type="button"
            onClick={onOpenReport}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-teal-400 hover:bg-teal-50"
          >
            <FaFileAlt /> Tra cứu &amp; báo cáo
          </button>

          {expanded && (
            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Loại</span>
                <select
                  value={typeFilter}
                  onChange={(event) => onTypeFilter(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold outline-none focus:border-teal-500"
                >
                  <option value="all">Tất cả</option>
                  {types.map((item) => (
                    <option key={item._id} value={item._id}>{item.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">Trạng thái</span>
                <select
                  value={statusFilter}
                  onChange={(event) => onStatusFilter(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold outline-none focus:border-teal-500"
                >
                  <option value="all">Tất cả</option>
                  {POINT_STATUSES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>

              <div className="pt-1">
                <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Màu chấm theo mức độ rò rỉ
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 2, 4, 10, 20].map((index) => LEAK_RATE_BUCKETS[index]).map((item) => (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getLeakColor(item.key) }} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapPointControl;
