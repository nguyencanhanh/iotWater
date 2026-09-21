import { useState } from "react";
import { FaCheck, FaCopy, FaFileCsv } from "react-icons/fa";
import { copyToClipboard, downloadCsv } from "./format";

// Cac manh giao dien dung lai trong moi the ket qua, de ca trang giu chung mot ngon ngu thiet ke.

const TONES = {
  teal: "border-teal-200 bg-teal-50 text-teal-900",
  blue: "border-blue-200 bg-blue-50 text-blue-900",
  amber: "border-amber-200 bg-amber-50 text-amber-900",
  rose: "border-rose-200 bg-rose-50 text-rose-900",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
  slate: "border-slate-200 bg-slate-50 text-slate-900",
};

export const StatTile = ({ label, value, hint, tone = "slate" }) => (
  <div className={`rounded-xl border px-3 py-2.5 ${TONES[tone] || TONES.slate}`}>
    <div className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-70">{label}</div>
    <div className="mt-1 truncate text-lg font-black tabular-nums leading-tight">{value}</div>
    {hint && <div className="mt-0.5 truncate text-[11px] font-semibold opacity-70">{hint}</div>}
  </div>
);

export const Chip = ({ children, tone = "slate" }) => (
  <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${TONES[tone] || TONES.slate}`}>
    {children}
  </span>
);

export const ResultCard = ({ eyebrow, title, subtitle, actions, children }) => (
  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">{eyebrow}</div>
        )}
        <h3 className="mt-0.5 truncate text-base font-black text-slate-900">{title}</h3>
        {subtitle && <div className="mt-0.5 text-xs font-semibold text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
    </div>
    <div className="space-y-3 p-4">{children}</div>
  </div>
);

export const CardButton = ({ children, onClick, tone = "ghost", title }) => {
  const toneClass = tone === "primary"
    ? "bg-teal-600 text-white hover:bg-teal-700"
    : "border border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700";
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${toneClass}`}
    >
      {children}
    </button>
  );
};

export const CsvButton = ({ fileName, headers, rows, label = "CSV" }) => (
  <CardButton onClick={() => downloadCsv({ fileName, headers, rows })} title="Tải bảng này ra file CSV mở bằng Excel">
    <FaFileCsv /> {label}
  </CardButton>
);

export const CopyButton = ({ text, label = "Chép" }) => {
  const [done, setDone] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  };

  return (
    <CardButton onClick={handleCopy} title="Chép nội dung">
      {done ? <FaCheck className="text-emerald-600" /> : <FaCopy />} {done ? "Đã chép" : label}
    </CardButton>
  );
};

// Bang so lieu: dau bang dinh, so can phai, cuon ngang tren man hinh hep.
export const DataTable = ({ columns, rows, emptyText = "Không có dữ liệu", maxHeight = "20rem" }) => {
  if (!rows?.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs font-bold text-slate-400">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-3 py-2 font-black ${column.align === "right" ? "text-right" : ""}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.key ?? rowIndex} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-2 ${column.align === "right" ? "text-right tabular-nums" : ""} ${column.strong ? "font-bold text-slate-900" : "text-slate-700"}`}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const EmptyNote = ({ children }) => (
  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs font-bold text-slate-400">
    {children}
  </div>
);
