import { useEffect, useState } from "react";
import { FaMapMarkerAlt, FaTimes, FaTrashAlt } from "react-icons/fa";
import {
  POINT_SEVERITIES,
  POINT_STATUSES,
  POINT_TYPES,
  toDateTimeLocal,
} from "./mapPointMeta";

const emptyPoint = {
  title: "",
  type: "leak",
  severity: "medium",
  status: "open",
  address: "",
  note: "",
  group: "",
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white";
const selectClass = `${inputClass} pr-8`;

const MapPointForm = ({ open, point, lat, lng, groups = [], saving, onClose, onSubmit, onDelete, onPickAgain }) => {
  const [form, setForm] = useState(emptyPoint);
  const [occurredAt, setOccurredAt] = useState(toDateTimeLocal());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm({ ...emptyPoint, ...(point || {}) });
    setOccurredAt(toDateTimeLocal(point?.occurredAt));
  }, [open, point]);

  if (!open) return null;

  const isEdit = Boolean(point?._id);
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      setError("Vui lòng nhập tên điểm");
      return;
    }
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      setError("Chưa có toạ độ cho điểm này");
      return;
    }
    setError("");
    onSubmit({
      ...form,
      title: form.title.trim(),
      lat: Number(lat),
      lng: Number(lng),
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="fixed left-1/2 top-1/2 z-[81] max-h-[92vh] w-[min(96vw,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h3 className="text-lg font-black text-slate-900">
            {isEdit ? "Sửa điểm sự cố" : "Thêm điểm sự cố"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-wide text-teal-700">Toạ độ</div>
              <div className="truncate text-sm font-bold text-teal-900">
                {Number.isFinite(Number(lat)) ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` : "Chưa chọn"}
              </div>
            </div>
            {onPickAgain && (
              <button
                type="button"
                onClick={onPickAgain}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-teal-700 hover:border-teal-400"
              >
                <FaMapMarkerAlt /> Chọn lại
              </button>
            )}
          </div>

          <Field label="Tên điểm *">
            <input
              value={form.title}
              onChange={update("title")}
              placeholder="VD: Vỡ ống DN110 trước số 25 Lê Lợi"
              className={inputClass}
              autoFocus
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Loại">
              <select value={form.type} onChange={update("type")} className={selectClass}>
                {POINT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Mức độ">
              <select value={form.severity} onChange={update("severity")} className={selectClass}>
                {POINT_SEVERITIES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Trạng thái">
              <select value={form.status} onChange={update("status")} className={selectClass}>
                {POINT_STATUSES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Thời điểm phát hiện">
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(event) => setOccurredAt(event.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Khu vực / nhóm">
            <input
              value={form.group}
              onChange={update("group")}
              list="map-point-groups"
              placeholder="VD: Bách Việt"
              className={inputClass}
            />
            <datalist id="map-point-groups">
              {groups.map((group) => <option key={group} value={group} />)}
            </datalist>
          </Field>

          <Field label="Địa chỉ">
            <input
              value={form.address}
              onChange={update("address")}
              placeholder="Số nhà, đường, phường…"
              className={inputClass}
            />
          </Field>

          <Field label="Ghi chú">
            <textarea
              value={form.note}
              onChange={update("note")}
              rows={3}
              placeholder="Mô tả hiện trạng, vật tư cần thiết, người xử lý…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white"
            />
          </Field>

          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          {isEdit ? (
            <button
              type="button"
              onClick={() => onDelete(point)}
              className="flex h-10 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-600 hover:bg-rose-50"
            >
              <FaTrashAlt /> Xoá
            </button>
          ) : <span />}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-xl bg-teal-600 px-5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-60"
            >
              {saving ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Thêm điểm"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
};

export default MapPointForm;
