import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { FaCog, FaCrosshairs, FaImages, FaMapMarkerAlt, FaPlus, FaTimes, FaTrashAlt } from "react-icons/fa";
import { POINT_STATUSES, toDateTimeLocal } from "./mapPointMeta";
import { LEAK_RATE_BUCKETS, getLeakColor } from "./leakRate";
import { formatCoordinate, parseCoordinateText } from "./coordinate";
import CatalogManager from "./CatalogManager";

const MapPicker = lazy(() => import("./MapPicker"));

const emptyPoint = {
  kind: "point",
  title: "",
  areaId: "",
  routeId: "",
  routeCustomers: "",
  heardCustomers: "0",
  typeGroupId: "",
  typeId: "",
  methodId: "",
  leakRate: LEAK_RATE_BUCKETS[0].key,
  status: "open",
  unresolvedReason: "",
  note: "",
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
const idOf = (value) => (value ? String(value) : "");

// Chon tu danh sach co san, hoac go ten moi roi bam "Them".
const PickOrAdd = ({ value, options, onChange, onCreate, placeholder, addPlaceholder, disabled, disabledHint }) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async () => {
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    const { item, error } = await onCreate(name);
    setBusy(false);
    if (error) return setMessage(error);
    if (item) {
      onChange(String(item._id));
      setDraft("");
      setAdding(false);
      setMessage("");
    }
    return undefined;
  };

  if (adding) {
    return (
      <div>
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
            disabled={busy || !draft.trim()}
            className="h-10 shrink-0 rounded-xl bg-teal-600 px-3 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "…" : "Thêm"}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setDraft(""); setMessage(""); }}
            className="h-10 w-10 shrink-0 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <FaTimes className="mx-auto" />
          </button>
        </div>
        {message && <div className="mt-1 text-xs font-bold text-rose-600">{message}</div>}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass} disabled={disabled}>
        <option value="">{disabled ? disabledHint : placeholder}</option>
        {options.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setAdding(true)}
        disabled={disabled}
        title="Thêm mới"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-teal-700 hover:border-teal-400 hover:bg-teal-50 disabled:opacity-40"
      >
        <FaPlus />
      </button>
    </div>
  );
};

const ManageLink = ({ hint, label, onClick }) => (
  <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-slate-400">
    <span>{hint}</span>
    <button type="button" onClick={onClick} className="flex items-center gap-1 font-bold text-teal-700 hover:underline">
      <FaCog /> {label}
    </button>
  </div>
);

const Section = ({ title, children }) => (
  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
    <div className="text-[11px] font-black uppercase tracking-wide text-teal-700">{title}</div>
    {children}
  </div>
);

const MapPointForm = ({
  open,
  point,
  initialKind = "point",
  lat,
  lng,
  typeCatalog,
  groupCatalog,
  methodCatalog,
  saving,
  onClose,
  onSubmit,
  onDelete,
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
  const [manage, setManage] = useState("");
  const [coordText, setCoordText] = useState("");
  const [coordError, setCoordError] = useState("");
  const [locating, setLocating] = useState(false);
  const fileRef = useRef(null);

  const types = typeCatalog.items;
  const groups = groupCatalog.items;
  const methods = methodCatalog.items;
  const typeParents = types.filter((item) => !item.parentId);
  const areas = groups.filter((item) => !item.parentId);
  const routesOf = (areaId) => groups.filter((item) => idOf(item.parentId) === idOf(areaId));
  const typesOf = (groupId) => types.filter((item) => idOf(item.parentId) === idOf(groupId));
  const findGroup = (id) => groups.find((item) => idOf(item._id) === idOf(id));

  // O toa do luon hien dung gia tri hien tai khi doi bang ban do / vi tri may.
  useEffect(() => {
    setCoordText(formatCoordinate(lat, lng));
    setCoordError("");
  }, [lat, lng]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setPickerOpen(false);
    setManage("");
    const typeId = idOf(point?.typeId);
    const type = types.find((item) => idOf(item._id) === typeId);
    setForm({
      ...emptyPoint,
      ...(point || {}),
      kind: point?.kind || initialKind,
      typeId,
      typeGroupId: idOf(point?.typeGroupId || type?.parentId),
      areaId: idOf(point?.areaId),
      routeId: idOf(point?.routeId),
      methodId: idOf(point?.methodId),
      routeCustomers: point?.routeId ? String(point.routeCustomers ?? "") : "",
      heardCustomers: String(point?.heardCustomers ?? 0),
    });
    setOccurredAt(toDateTimeLocal(point?.occurredAt));
    setResolvedAt(toDateTimeLocal(point?.resolvedAt));
  }, [open, point, initialKind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const isEdit = Boolean(point?._id);
  const noFind = form.kind === "no_find";
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const update = (key) => (event) => set({ [key]: event.target.value });
  const route = findGroup(form.routeId);

  const chooseArea = (areaId) => set({ areaId, routeId: "", routeCustomers: "" });
  // Chon tuyen -> dien san so khach hang gan nhat cua tuyen.
  const chooseRoute = (routeId) => set({ routeId, routeCustomers: routeId ? String(findGroup(routeId)?.customers ?? 0) : "" });
  const chooseTypeGroup = (typeGroupId) => set({ typeGroupId, typeId: "" });

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
    const common = {
      kind: form.kind,
      title: form.title.trim(),
      areaId: form.areaId || null,
      routeId: form.routeId || null,
      routeCustomers: form.routeId ? form.routeCustomers : undefined,
      heardCustomers: Number(form.heardCustomers) || 0,
      methodId: form.methodId || null,
      note: form.note,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
    };

    if (noFind) {
      if (!form.routeId) return setError("Chọn tuyến đã nghe");
      setError("");
      return onSubmit(common);
    }

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
    return onSubmit({
      ...common,
      lat: finalLat,
      lng: finalLng,
      typeId: form.typeId || null,
      leakRate: form.leakRate,
      status: form.status,
      unresolvedReason: form.unresolvedReason,
      resolvedAt: form.status === "resolved"
        ? (resolvedAt ? new Date(resolvedAt).toISOString() : new Date().toISOString())
        : null,
    });
  };

  const heading = isEdit
    ? (noFind ? "Sửa lượt nghe không tìm thấy điểm" : "Sửa sự cố")
    : (noFind ? "Thêm lượt nghe không tìm thấy điểm" : "Thêm sự cố rò rỉ");

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="fixed left-1/2 top-1/2 z-[81] max-h-[92vh] w-[min(96vw,38rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-slate-50 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <h3 className="text-lg font-black text-slate-900">{heading}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 ${noFind ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
            <input
              type="checkbox"
              checked={noFind}
              onChange={(event) => set({ kind: event.target.checked ? "no_find" : "point" })}
              className="mt-0.5 h-4 w-4 accent-amber-600"
            />
            <span>
              <span className="block text-sm font-black text-slate-800">Tuyến đã nghe nhưng không tìm thấy điểm</span>
              <span className="block text-xs font-semibold text-slate-500">
                Chỉ ghi tuyến, thời điểm, ghi chú. Không hiện trên bản đồ, chỉ tính vào bản tin / báo cáo.
              </span>
            </span>
          </label>

          {!noFind && (
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
          )}

          <Field label={noFind ? "Tên (không bắt buộc, mặc định là tên tuyến)" : "Tên sự cố *"}>
            <input
              value={form.title}
              onChange={update("title")}
              placeholder={noFind ? "VD: Nghe tuyến cổng bệnh viện" : "VD: Vỡ ống DN110 trước số 25 Lê Lợi"}
              className={inputClass}
              autoFocus
            />
          </Field>

          <Section title="Khu vực / nhóm">
            <div>
              <Field label="Bậc 1 – Khu vực">
                <PickOrAdd
                  value={form.areaId}
                  options={areas.map((item) => ({ value: idOf(item._id), label: item.name }))}
                  onChange={chooseArea}
                  onCreate={(name) => groupCatalog.create(name, null)}
                  placeholder="— Chọn khu vực —"
                  addPlaceholder="VD: TQL HVT"
                />
              </Field>
            </div>

            <div>
              <Field label={noFind ? "Bậc 2 – Tuyến đã nghe *" : "Bậc 2 – Tuyến"}>
                <PickOrAdd
                  value={form.routeId}
                  options={routesOf(form.areaId).map((item) => ({ value: idOf(item._id), label: item.name }))}
                  onChange={chooseRoute}
                  onCreate={(name) => groupCatalog.create(name, form.areaId)}
                  placeholder="— Chọn tuyến —"
                  addPlaceholder="VD: SN 620 Lê Lợi"
                  disabled={!form.areaId}
                  disabledHint="— Chọn khu vực trước —"
                />
              </Field>
              {manage === "group" ? (
                <CatalogManager
                  title="Quản lý khu vực / tuyến"
                  kind="group"
                  catalog={groupCatalog}
                  parentLabel="khu vực"
                  childLabel="tuyến"
                  onClose={() => setManage("")}
                />
              ) : (
                <ManageLink hint="Bấm + để thêm khu vực / tuyến mới" label="Sửa / xoá khu vực, tuyến" onClick={() => setManage("group")} />
              )}
            </div>

            {route && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Số khách hàng của tuyến" hint="Giữ số gần nhất cho lần sau">
                  <input type="number" min="0" value={form.routeCustomers} onChange={update("routeCustomers")} className={inputClass} />
                </Field>
                <Field label="Số khách hàng đã nghe" hint="Để 0 = nghe cả tuyến">
                  <input type="number" min="0" value={form.heardCustomers} onChange={update("heardCustomers")} className={inputClass} />
                </Field>
              </div>
            )}

            <div>
              <Field label="Loại hình phát hiện">
                <PickOrAdd
                  value={form.methodId}
                  options={methods.map((item) => ({ value: idOf(item._id), label: item.name }))}
                  onChange={(methodId) => set({ methodId })}
                  onCreate={(name) => methodCatalog.create(name, null)}
                  placeholder="— Chọn loại hình —"
                  addPlaceholder="VD: Nghe đêm"
                />
              </Field>
              {manage === "method" ? (
                <CatalogManager
                  title="Quản lý loại hình phát hiện"
                  kind="method"
                  catalog={methodCatalog}
                  parentLabel="loại hình"
                  onClose={() => setManage("")}
                />
              ) : (
                <ManageLink hint="VD: Nghe, Nghe đêm, Nghe phối hợp với tổ" label="Sửa / xoá loại hình" onClick={() => setManage("method")} />
              )}
            </div>
          </Section>

          {!noFind && (
            <Section title="Loại sự cố">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Bậc 1 – Nhóm loại">
                  <PickOrAdd
                    value={form.typeGroupId}
                    options={typeParents.map((item) => ({ value: idOf(item._id), label: item.name }))}
                    onChange={chooseTypeGroup}
                    onCreate={(name) => typeCatalog.create(name, null)}
                    placeholder="— Chọn nhóm —"
                    addPlaceholder="VD: Phụ kiện PN 10"
                  />
                </Field>
                <Field label="Bậc 2 – Loại sự cố">
                  <PickOrAdd
                    value={form.typeId}
                    options={typesOf(form.typeGroupId).map((item) => ({ value: idOf(item._id), label: item.name }))}
                    onChange={(typeId) => set({ typeId })}
                    onCreate={(name) => typeCatalog.create(name, form.typeGroupId, { icon: "drop" })}
                    placeholder="— Chọn loại —"
                    addPlaceholder="VD: Cút ren ngoài 20"
                    disabled={!form.typeGroupId}
                    disabledHint="— Chọn nhóm trước —"
                  />
                </Field>
              </div>
              {manage === "type" ? (
                <CatalogManager
                  title="Quản lý loại sự cố (bấm biểu tượng để đổi hình trên bản đồ)"
                  kind="type"
                  catalog={typeCatalog}
                  parentLabel="nhóm loại"
                  childLabel="loại"
                  onClose={() => setManage("")}
                />
              ) : (
                <ManageLink hint="Mỗi loại bậc 2 có biểu tượng riêng trên bản đồ" label="Sửa / xoá loại, đổi biểu tượng" onClick={() => setManage("type")} />
              )}

              <Field label="Mức độ (lưu lượng rò rỉ ước tính)">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 shrink-0 rounded-full ring-2 ring-white shadow" style={{ backgroundColor: getLeakColor(form.leakRate) }} />
                  <select value={form.leakRate} onChange={update("leakRate")} className={selectClass}>
                    {LEAK_RATE_BUCKETS.map((item) => (
                      <option key={item.key} value={item.key}>{item.label}</option>
                    ))}
                  </select>
                </div>
              </Field>
            </Section>
          )}

          <Field label="Thời điểm phát hiện">
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className={inputClass}
            />
          </Field>

          {!noFind && (
            <>
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
            </>
          )}

          <Field label="Ghi chú">
            <textarea
              value={form.note}
              onChange={update("note")}
              rows={3}
              placeholder={noFind ? "VD: Sáng nay thông tuyến HVT cổng bệnh viện…" : "Địa chỉ, mô tả hiện trạng, vật tư cần thiết, người xử lý…"}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500"
            />
          </Field>

          {!noFind && (
            <div>
              <span className="mb-1 block text-xs font-black uppercase tracking-wide text-slate-500">
                Hình ảnh hiện trường
              </span>

              {!isEdit ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-xs font-semibold text-slate-500">
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
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-teal-300 hover:bg-teal-50"
                  >
                    <FaImages /> Thêm ảnh
                  </button>
                </div>
              )}
            </div>
          )}

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
              {saving ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : noFind ? "Lưu lượt nghe" : "Thêm sự cố"}
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
