import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { FaImages, FaMapMarkerAlt, FaPlus, FaTimes, FaTrashAlt } from "react-icons/fa";
import { POINT_STATUSES, toDateTimeLocal } from "./mapPointMeta";
import { LEAK_RATE_BUCKETS } from "./leakRate";

const MapPicker = lazy(() => import("./MapPicker"));

const emptyPoint = {
  title: "",
  typeId: "",
  leakRate: LEAK_RATE_BUCKETS[0].key,
  status: "open",
  unresolvedReason: "",
  note: "",
  group: "",
};

const Field = ({ label, children, hint }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] font-semibold text-slate-400">{hint}</span>}
  </label>
);

const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white";
const selectClass = `${inputClass} pr-8`;

// Chon tu danh sach co san, hoac go ten moi roi bam "Thêm" - giong cach them nhom logger.
const PickOrAdd = ({ value, options, onChange, onCreate, placeholder, addPlaceholder, creating }) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = async () => {
    const name = draft.trim();
    if (!name) return;
    const created = await onCreate(name);
    if (created) {
      onChange(created);
      setDraft("");
      setAdding(false);
    }
  };

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); submit(); }
            if (event.key === "Escape") { setAdding(false); setDraft(""); }
          }}
          placeholder={addPlaceholder}
          className={inputClass}
          autoFocus
        />
        <button
          type="button"
          onClick={submit}
          disabled={creating || !draft.trim()}
          className="h-10 shrink-0 rounded-xl bg-teal-600 px-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {creating ? "…" : "Thêm"}
        </button>
        <button
          type="button"
          onClick={() => { setAdding(false); setDraft(""); }}
          className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <FaTimes className="mx-auto" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="">{placeholder}</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setAdding(true)}
        title="Thêm mới"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-teal-700 hover:border-teal-400 hover:bg-teal-50"
      >
        <FaPlus />
      </button>
    </div>
  );
};

const MapPointForm = ({
  open,
  point,
  lat,
  lng,
  groups = [],
  types = [],
  saving,
  creatingType,
  onClose,
  onSubmit,
  onDelete,
  onCreateType,
  onCoordinateChange,
  onUploadImages,
  onDeleteImage,
  imageUrl,
}) => {
  const [form, setForm] = useState(emptyPoint);
  const [occurredAt, setOccurredAt] = useState(toDateTimeLocal());
  const [resolvedAt, setResolvedAt] = useState(toDateTimeLocal());
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError("");
    setPickerOpen(false);
    setForm({
      ...emptyPoint,
      ...(point || {}),
      typeId: point?.typeId ? String(point.typeId) : "",
    });
    setOccurredAt(toDateTimeLocal(point?.occurredAt));
    setResolvedAt(toDateTimeLocal(point?.resolvedAt));
  }, [open, point]);

  if (!open) return null;

  const isEdit = Boolean(point?._id);
  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const hasCoordinate = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return setError("Vui lòng nhập tên sự cố");
    if (!hasCoordinate) return setError("Chưa có toạ độ cho sự cố này");

    setError("");
    onSubmit({
      ...form,
      title: form.title.trim(),
      lat: Number(lat),
      lng: Number(lng),
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
      resolvedAt: form.status === "resolved"
        ? (resolvedAt ? new Date(resolvedAt).toISOString() : new Date().toISOString())
        : null,
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="fixed left-1/2 top-1/2 z-[81] max-h-[92vh] w-[min(96vw,36rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <h3 className="text-lg font-black text-slate-900">
            {isEdit ? "Sửa sự cố" : "Thêm sự cố rò rỉ"}
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
              <div className="truncate font-mono text-sm font-bold text-teal-900">
                {hasCoordinate ? `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}` : "Chưa chọn"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-teal-700 hover:border-teal-400"
            >
              <FaMapMarkerAlt /> {hasCoordinate ? "Đổi toạ độ" : "Chọn toạ độ"}
            </button>
          </div>

          <Field label="Tên sự cố *">
            <input
              value={form.title}
              onChange={update("title")}
              placeholder="VD: Vỡ ống DN110 trước số 25 Lê Lợi"
              className={inputClass}
              autoFocus
            />
          </Field>

          <Field label="Loại sự cố" hint="Chưa có loại phù hợp thì bấm dấu + để tự thêm">
            <PickOrAdd
              value={form.typeId}
              options={types.map((item) => ({ value: String(item._id), label: item.name }))}
              onChange={(value) => setForm((prev) => ({ ...prev, typeId: value }))}
              onCreate={onCreateType}
              creating={creatingType}
              placeholder="— Chọn loại sự cố —"
              addPlaceholder="VD: Nứt gãy cút ren 20"
            />
          </Field>

          <Field label="Mức độ (lưu lượng rò rỉ ước tính)">
            <select value={form.leakRate} onChange={update("leakRate")} className={selectClass}>
              {LEAK_RATE_BUCKETS.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Khu vực / nhóm">
            <PickOrAdd
              value={form.group}
              options={groups.map((name) => ({ value: name, label: name }))}
              onChange={(value) => setForm((prev) => ({ ...prev, group: value }))}
              onCreate={async (name) => name}
              placeholder="— Chọn khu vực —"
              addPlaceholder="VD: Bách Việt"
            />
          </Field>

          <Field label="Thời điểm phát hiện">
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="Trạng thái">
            <select value={form.status} onChange={update("status")} className={selectClass}>
              {POINT_STATUSES.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </Field>

          {form.status === "resolved" ? (
            <Field label="Thời gian xử lý xong">
              <input
                type="datetime-local"
                value={resolvedAt}
                onChange={(event) => setResolvedAt(event.target.value)}
                className={inputClass}
              />
            </Field>
          ) : (
            <Field label="Lý do chưa xử lý">
              <input
                value={form.unresolvedReason}
                onChange={update("unresolvedReason")}
                placeholder="VD: Chờ vật tư DN110, chờ cắt nước"
                className={inputClass}
              />
            </Field>
          )}

          <Field label="Ghi chú / địa chỉ">
            <textarea
              value={form.note}
              onChange={update("note")}
              rows={3}
              placeholder="Địa chỉ, mô tả hiện trạng, vật tư cần thiết, người xử lý…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white"
            />
          </Field>

          <div>
            <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
              Hình ảnh hiện trường
            </span>

            {!isEdit ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
                Lưu sự cố trước, sau đó mở lại để thêm ảnh khi đã đào lên.
              </div>
            ) : (
              <div className="space-y-2">
                {Boolean(point.images?.length) && (
                  <div className="flex flex-wrap gap-2">
                    {point.images.map((name) => (
                      <div key={name} className="relative">
                        <a href={imageUrl(point._id, name)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={imageUrl(point._id, name)}
                            alt="Ảnh sự cố"
                            className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                          />
                        </a>
                        <button
                          type="button"
                          onClick={() => onDeleteImage(point, name)}
                          title="Xoá ảnh"
                          className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-rose-600 text-[10px] text-white shadow hover:bg-rose-700"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = [...(event.target.files || [])];
                    if (files.length) onUploadImages(point, files);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                >
                  <FaImages /> Thêm ảnh
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
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
              {saving ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Thêm sự cố"}
            </button>
          </div>
        </div>
      </form>

      <Suspense fallback={null}>
        <MapPicker
          open={pickerOpen}
          initialLat={lat}
          initialLng={lng}
          title="Chọn toạ độ sự cố"
          onCancel={() => setPickerOpen(false)}
          onConfirm={(coordinate) => {
            onCoordinateChange(coordinate);
            setPickerOpen(false);
          }}
        />
      </Suspense>
    </>
  );
};

export default MapPointForm;
