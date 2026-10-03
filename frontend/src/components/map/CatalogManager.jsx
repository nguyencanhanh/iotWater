import { useState } from "react";
import PropTypes from "prop-types";
import { FaCheck, FaPen, FaPlus, FaTrashAlt } from "react-icons/fa";
import { POINT_ICONS, iconPreviewMarkup } from "./pointIcons";

const smallInput = "h-8 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold outline-none focus:border-teal-500";
const iconButton = "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg disabled:opacity-50";

// Mot dong: ten (sua tai cho), nut sua / xoa, phan rieng (bieu tuong, so khach hang...).
const Row = ({ item, indent, extra, onRename, onRemove }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const name = draft.trim();
    if (!name || name === item.name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    const failed = await onRename(item, name);
    setBusy(false);
    if (!failed) setEditing(false);
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 rounded-lg py-1 pr-1 hover:bg-slate-50 ${indent ? "pl-5" : "pl-1"}`}>
      {editing ? (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); save(); }
            if (event.key === "Escape") { setDraft(item.name); setEditing(false); }
          }}
          className={`${smallInput} flex-1 border-teal-400`}
          autoFocus
        />
      ) : (
        <span className={`min-w-0 flex-1 truncate text-sm ${indent ? "font-semibold text-slate-700" : "font-black text-slate-900"}`}>
          {indent ? "• " : ""}{item.name}
        </span>
      )}
      {extra}
      {editing ? (
        <button type="button" onClick={save} disabled={busy} title="Lưu tên" className={`${iconButton} bg-teal-600 text-white hover:bg-teal-700`}>
          <FaCheck />
        </button>
      ) : (
        <button type="button" onClick={() => { setDraft(item.name); setEditing(true); }} title="Đổi tên" className={`${iconButton} text-slate-500 hover:bg-slate-200`}>
          <FaPen className="text-xs" />
        </button>
      )}
      <button type="button" onClick={() => onRemove(item)} disabled={busy} title="Xoá" className={`${iconButton} text-rose-600 hover:bg-rose-50`}>
        <FaTrashAlt className="text-xs" />
      </button>
    </div>
  );
};

Row.propTypes = {
  item: PropTypes.object.isRequired,
  indent: PropTypes.bool,
  extra: PropTypes.node,
  onRename: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};

const AddLine = ({ placeholder, onAdd, indent }) => {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const name = draft.trim();
    if (!name) return;
    setBusy(true);
    const failed = await onAdd(name);
    setBusy(false);
    if (!failed) setDraft("");
  };
  return (
    <div className={`flex gap-1.5 py-1 pr-1 ${indent ? "pl-5" : "pl-1"}`}>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }}
        placeholder={placeholder}
        className={`${smallInput} flex-1`}
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy || !draft.trim()}
        className="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-teal-600 px-2.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        <FaPlus /> Thêm
      </button>
    </div>
  );
};

AddLine.propTypes = { placeholder: PropTypes.string, onAdd: PropTypes.func.isRequired, indent: PropTypes.bool };

// Chon bieu tuong cho loai bac 2 (hien tren ban do, to mau theo muc do).
export const IconPicker = ({ value, onChange, color = "#0f766e" }) => (
  <div className="flex flex-wrap gap-1">
    {POINT_ICONS.map((icon) => (
      <button
        key={icon.key}
        type="button"
        title={icon.label}
        aria-label={icon.label}
        aria-pressed={value === icon.key}
        onClick={() => onChange(icon.key)}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border ${value === icon.key ? "border-teal-600 bg-teal-50 ring-2 ring-teal-200" : "border-slate-200 bg-white hover:border-teal-300"}`}
        dangerouslySetInnerHTML={{ __html: iconPreviewMarkup(icon.key, color, 22) }}
      />
    ))}
  </div>
);

IconPicker.propTypes = { value: PropTypes.string, onChange: PropTypes.func.isRequired, color: PropTypes.string };

// Quan ly danh muc 1 hoac 2 bac. kind = "type" (loai su co: bieu tuong), "group" (khu vuc /
// tuyen: so khach hang) hoac "method" (1 bac).
const CatalogManager = ({ title, kind, catalog, parentLabel, childLabel, onClose }) => {
  const [message, setMessage] = useState("");
  const [iconFor, setIconFor] = useState(null);
  const twoLevels = kind !== "method";
  const parents = twoLevels ? catalog.items.filter((item) => !item.parentId) : catalog.items;
  const childrenOf = (parent) => catalog.items.filter((item) => String(item.parentId) === String(parent._id));

  const run = async (job) => {
    setMessage("");
    const failed = await job();
    if (failed) setMessage(failed);
    return failed;
  };

  const rename = (item, name) => run(() => catalog.update(item._id, { name }));
  const remove = (item) => {
    if (!window.confirm(`Xoá "${item.name}"?`)) return Promise.resolve("cancel");
    return run(() => catalog.remove(item._id));
  };
  const add = (name, parentId) => run(async () => {
    const result = await catalog.create(name, parentId, kind === "type" && parentId ? { icon: "drop" } : {});
    return result.error || null;
  });

  const childExtra = (child) => {
    const move = (
      <select
        value={String(child.parentId)}
        onChange={(event) => run(() => catalog.update(child._id, { parentId: event.target.value }))}
        title={`Chuyển sang ${parentLabel} khác`}
        className="h-8 max-w-[8.5rem] rounded-lg border border-slate-200 bg-white px-1 text-xs font-semibold"
      >
        {parents.map((parent) => <option key={parent._id} value={String(parent._id)}>{parent.name}</option>)}
      </select>
    );
    if (kind === "type") {
      return (
        <>
          <button
            type="button"
            title="Chọn biểu tượng trên bản đồ"
            onClick={() => setIconFor(iconFor === child._id ? null : child._id)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white hover:border-teal-300"
            dangerouslySetInnerHTML={{ __html: iconPreviewMarkup(child.icon || "drop", "#0f766e", 22) }}
          />
          {move}
        </>
      );
    }
    return (
      <>
        <label className="flex items-center gap-1 text-[11px] font-bold text-slate-500" title="Số khách hàng của tuyến (giữ số gần nhất)">
          KH
          <input
            type="number"
            min="0"
            defaultValue={child.customers || 0}
            onBlur={(event) => {
              const value = Number(event.target.value);
              if (Number.isFinite(value) && value !== Number(child.customers || 0)) run(() => catalog.update(child._id, { customers: value }));
            }}
            className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-1.5 text-right text-sm font-semibold"
          />
        </label>
        {move}
      </>
    );
  };

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-white p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">{title}</span>
        <button type="button" onClick={onClose} className="text-xs font-bold text-teal-700 hover:underline">Xong</button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {parents.map((parent) => (
          <div key={parent._id} className={twoLevels ? "border-b border-slate-100 pb-1" : ""}>
            <Row item={parent} onRename={rename} onRemove={remove} />
            {twoLevels && childrenOf(parent).map((child) => (
              <div key={child._id}>
                <Row item={child} indent extra={childExtra(child)} onRename={rename} onRemove={remove} />
                {iconFor === child._id && (
                  <div className="pb-1 pl-5">
                    <IconPicker
                      value={child.icon || "drop"}
                      onChange={(icon) => { setIconFor(null); run(() => catalog.update(child._id, { icon })); }}
                    />
                  </div>
                )}
              </div>
            ))}
            {twoLevels && <AddLine indent placeholder={`Thêm ${childLabel} vào "${parent.name}"`} onAdd={(name) => add(name, parent._id)} />}
          </div>
        ))}
        {!parents.length && <div className="px-1 py-2 text-xs font-semibold text-slate-400">Chưa có {parentLabel} nào</div>}
      </div>

      <div className="mt-1 border-t border-slate-200 pt-1">
        <AddLine placeholder={`Thêm ${parentLabel} mới`} onAdd={(name) => add(name, null)} />
      </div>

      {message && message !== "cancel" && (
        <div className="mt-1.5 rounded-lg border border-rose-100 bg-rose-50 px-2 py-1.5 text-xs font-bold text-rose-700">{message}</div>
      )}
    </div>
  );
};

CatalogManager.propTypes = {
  title: PropTypes.string.isRequired,
  kind: PropTypes.oneOf(["type", "group", "method"]).isRequired,
  catalog: PropTypes.object.isRequired,
  parentLabel: PropTypes.string.isRequired,
  childLabel: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};

export default CatalogManager;
