import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { FaCheck, FaCog, FaCrosshairs, FaImages, FaMapMarkerAlt, FaPen, FaPlus, FaTimes, FaTrashAlt } from "react-icons/fa";
import { POINT_STATUSES, toDateTimeLocal } from "./mapPointMeta";
import { LEAK_RATE_BUCKETS } from "./leakRate";
import { formatCoordinate, parseCoordinateText } from "./coordinate";

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

// Danh sach loai su co de doi ten / xoa. Loai dang duoc diem nao dung thi server
// tu choi xoa, loi hien ngay ben duoi danh sach.
const TypeManager = ({ types, onRename, onDelete, onClose }) => {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");

  const startEdit = (type) => {
    setEditingId(String(type._id));
    setDraft(type.name);
    setMessage("");
  };

  const saveEdit = async (type) => {
    const name = draft.trim();
    if (!name || name === type.name) {
      setEditingId(null);
      return;
    }
    setBusyId(String(type._id));
    const error = await onRename(type._id, name);
    setBusyId(null);
    if (error) setMessage(error);
    else setEditingId(null);
  };

  const remove = async (type) => {
    if (!window.confirm(`Xoá loại sự cố "${type.name}"?`)) return;
    setBusyId(String(type._id));
    setMessage("");
    const error = await onDelete(type._id);
    setBusyId(null);
    if (error) setMessage(error);
  };

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Quản lý loại sự cố</span>
        <button type="button" onClick={onClose} className="text-xs font-bold text-teal-700 hover:underline">
          Xong
        </button>
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto">
        {types.map((type) => {
          const id = String(type._id);
          const editing = editingId === id;
          const busy = busyId === id;
          return (
            <div key={id} className="flex items-center gap-1.5 rounded-lg px-1 py-1 hover:bg-slate-50">
              {editing ? (
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); saveEdit(type); }
                    if (event.key === "Escape") setEditingId(null);
                  }}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-teal-400 px-2 text-sm font-semibold outline-none"
                  autoFocus
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{type.name}</span>
              )}

              {editing ? (
                <button
                  type="button"
                  onClick={() => saveEdit(type)}
                  disabled={busy}
                  title="Lưu tên"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  <FaCheck />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(type)}
                  title="Đổi tên"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200"
                >
                  <FaPen className="text-xs" />
                </button>
              )}
              <button
                type="button"
                onClick={() => remove(type)}
                disabled={busy}
                title="Xoá loại"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50"
              >
                <FaTrashAlt className="text-xs" />
              </button>
            </div>
          );
        })}
        {!types.length && (
          <div className="px-1 py-2 text-xs font-semibold text-slate-400">Chưa có loại nào</div>
        )}
      </div>

      {message && (
        <div className="mt-1.5 rounded-lg border border-rose-100 bg-rose-50 px-2 py-1.5 text-xs font-bold text-rose-700">
          {message}
        </div>
      )}
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
  onRenameType,
  onDeleteType,
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
  const [manageTypes, setManageTypes] = useState(false);
  const [coordText, setCoordText] = useState("");
  const [coordError, setCoordError] = useState("");
  const [locating, setLocating] = useState(false);
  const fileRef = useRef(null);

  // O toa do luon hien dung gia tri hien tai khi doi bang ban do / vi tri may.
  useEffect(() => {
    setCoordText(formatCoordinate(lat, lng));
    setCoordError("");
  }, [lat, lng]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setPickerOpen(false);
    setManageTypes(false);
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

  // Nhan ca toa do go tay lan link Google Maps dan vao.
  const applyCoordText = () => {
    if (!coordText.trim()) return null;
    const parsed = parseCoordinateText(coordText);
    if (!parsed) {
      setCoordError("Không đọc được toạ độ. Ví dụ: 21.273100, 106.194600 hoặc dán link Google Maps");
      return null;
    }
    setCoordError("");
    onCoordinateChange(parsed);
    return parsed;
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setCoordError("Thiết bị không hỗ trợ định vị");
      return;
    }
    setLocating(true);
    setCoordError("");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setLocating(false);
        onCoordinateChange({
          lat: Number(result.coords.latitude.toFixed(6)),
          lng: Number(result.coords.longitude.toFixed(6)),
        });
      },
      () => {
        setLocating(false);
        setCoordError("Không lấy được vị trí. Hãy bật định vị và cho phép trình duyệt truy cập vị trí.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.title.trim()) return setError("Vui lòng nhập tên sự cố");

    // Nguoi dung go toa do nhung chua bam Enter thi van lay gia tri vua go.
    let finalLat = Number(lat);
    let finalLng = Number(lng);
    if (coordText.trim() && coordText !== formatCoordinate(lat, lng)) {
      const typed = applyCoordText();
      if (!typed) return undefined;
      finalLat = typed.lat;
      finalLng = typed.lng;
    }
    if (!Number.isFinite(finalLat) || !Number.isFinite(finalLng)) return setError("Chưa có toạ độ cho sự cố này");

    setError("");
    onSubmit({
      ...form,
      title: form.title.trim(),
      lat: finalLat,
      lng: finalLng,
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
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-3">
            <div className="mb-1.5 text-xs font-black uppercase tracking-wide text-teal-700">Toạ độ *</div>
            <input
              value={coordText}
              onChange={(event) => { setCoordText(event.target.value); setCoordError(""); }}
              onBlur={() => { if (coordText !== formatCoordinate(lat, lng)) applyCoordText(); }}
              onKeyDown={(event) => {
                if (event.key === "Enter") { event.preventDefault(); applyCoordText(); }
              }}
              placeholder="Gõ 21.273100, 106.194600 hoặc dán link Google Maps"
              className="h-10 w-full rounded-lg border border-teal-200 bg-white px-3 font-mono text-sm font-bold text-teal-900 outline-none focus:border-teal-500"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-white px-2 py-2 text-xs font-bold text-teal-700 hover:border-teal-400"
              >
                <FaMapMarkerAlt /> Chọn trên bản đồ
              </button>
              <button
                type="button"
                onClick={useMyLocation}
                disabled={locating}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-white px-2 py-2 text-xs font-bold text-teal-700 hover:border-teal-400 disabled:opacity-60"
              >
                <FaCrosshairs /> {locating ? "Đang lấy vị trí…" : "Vị trí của tôi"}
              </button>
            </div>
            {coordError && <div className="mt-1.5 text-xs font-bold text-rose-600">{coordError}</div>}
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

          <div>
            <Field label="Loại sự cố">
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
            {manageTypes ? (
              <TypeManager
                types={types}
                onRename={onRenameType}
                onDelete={async (id) => {
                  const failure = await onDeleteType(id);
                  if (!failure && String(form.typeId) === String(id)) {
                    setForm((prev) => ({ ...prev, typeId: "" }));
                  }
                  return failure;
                }}
                onClose={() => setManageTypes(false)}
              />
            ) : (
              <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>Bấm + để thêm loại mới</span>
                <button
                  type="button"
                  onClick={() => setManageTypes(true)}
                  className="flex items-center gap-1 font-bold text-teal-700 hover:underline"
                >
                  <FaCog /> Sửa / xoá loại
                </button>
              </div>
            )}
          </div>

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
