import { useCallback, useEffect, useMemo, useState } from "react";
import { FaFileExcel, FaSearch, FaTimes } from "react-icons/fa";
import { mapPointExportPost, mapPointReportGet, mapPointsGet } from "../../api/index";
import { getLeakColor, getLeakLabel } from "./leakRate";
import { formatPointDateTime, getStatusMeta, toDateInput } from "./mapPointMeta";

const getToken = () => localStorage.getItem("token");

const startOfMonth = () => {
  const now = new Date();
  return toDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
};

const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 outline-none focus:border-teal-500 focus:bg-white";

const formatNumber = (value) => Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });

const IncidentReportPanel = ({ open, user, groups = [], types = [], onClose }) => {
  const [tab, setTab] = useState("search");
  const [fromDate, setFromDate] = useState(startOfMonth());
  const [toDate, setToDate] = useState(toDateInput());
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [status, setStatus] = useState("all");
  const [typeId, setTypeId] = useState("all");

  const [rows, setRows] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  // Ngay ket thuc lay tron den 23:59:59 de khong hut mat su co trong ngay cuoi.
  const params = useMemo(() => ({
    user,
    fromDate: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : "",
    toDate: toDate ? new Date(`${toDate}T23:59:59`).toISOString() : "",
    group: selectedGroups.length ? selectedGroups.join(",") : "all",
    status,
    typeId,
  }), [user, fromDate, toDate, selectedGroups, status, typeId]);

  const search = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "search") {
        const res = await mapPointsGet(getToken(), params);
        setRows(res.data?.points || []);
      } else {
        const res = await mapPointReportGet(getToken(), params);
        setReport(res.data || null);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Không tra cứu được");
    } finally {
      setLoading(false);
    }
  }, [tab, params]);

  useEffect(() => {
    if (open) search();
  }, [open, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const toggleGroup = (name) => setSelectedGroups((prev) => (
    prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
  ));

  const exportExcel = async () => {
    setExporting(true);
    setError("");
    try {
      const res = await mapPointExportPost(getToken(), params);
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `su-co-${fromDate}-den-${toDate}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Không xuất được file Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[85] bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[86] flex h-[min(92vh,52rem)] w-[min(96vw,72rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="flex gap-1">
            {[["search", "Tra cứu sự cố"], ["report", "Báo cáo"]].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-xl px-4 py-2 text-sm font-black ${
                  tab === key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <FaTimes />
          </button>
        </div>

        <div className="space-y-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Từ ngày</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Đến ngày</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Trạng thái</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                <option value="all">Tất cả</option>
                <option value="open">Chưa xử lý</option>
                <option value="resolved">Đã xử lý</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase text-slate-500">Loại sự cố</span>
              <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className={inputClass}>
                <option value="all">Tất cả</option>
                {types.map((item) => (
                  <option key={item._id} value={item._id}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-500">Khu vực</span>
              <button
                type="button"
                onClick={() => setSelectedGroups([])}
                className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                  selectedGroups.length === 0 ? "bg-teal-600 text-white" : "bg-white text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tất cả
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {groups.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleGroup(name)}
                  className={`rounded-md border px-2 py-1 text-[11px] font-bold ${
                    selectedGroups.includes(name)
                      ? "border-teal-500 bg-teal-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-teal-300"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={search}
              disabled={loading}
              className="flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <FaSearch /> {loading ? "Đang tra cứu…" : "Tra cứu"}
            </button>
            {tab === "search" && (
              <button
                type="button"
                onClick={exportExcel}
                disabled={exporting || !rows.length}
                className="flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <FaFileExcel /> {exporting ? "Đang xuất…" : "Xuất Excel"}
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "search" ? (
            <>
              <div className="mb-2 text-sm font-bold text-slate-600">Tìm thấy {rows.length} sự cố</div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      {["Tên sự cố", "Thời gian phát hiện", "Trạng thái", "Loại sự cố", "Mức độ", "Khu vực", "Toạ độ"].map((head) => (
                        <th key={head} className="whitespace-nowrap px-3 py-2 font-bold">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const statusMeta = getStatusMeta(row.status);
                      return (
                        <tr key={row._id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-bold text-slate-900">{row.title}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatPointDateTime(row.occurredAt)}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-md border px-2 py-0.5 text-[11px] font-black ${statusMeta.badge}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{row.typeName || "Chưa phân loại"}</td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <span className="rounded-md px-2 py-0.5 text-[11px] font-black text-white" style={{ backgroundColor: getLeakColor(row.leakRate) }}>
                              {getLeakLabel(row.leakRate)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700">{row.group || "Không có"}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-500">
                            {Number(row.lat).toFixed(6)}, {Number(row.lng).toFixed(6)}
                          </td>
                        </tr>
                      );
                    })}
                    {!rows.length && (
                      <tr><td colSpan={7} className="px-3 py-6 text-center font-semibold text-slate-400">Không có sự cố nào trong khoảng này</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : report ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-black uppercase text-slate-500">Tổng số điểm vỡ</div>
                  <div className="mt-1 text-2xl font-black text-slate-900">{report.summary.total}</div>
                </div>
                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4">
                  <div className="text-[11px] font-black uppercase text-rose-600">Chưa xử lý</div>
                  <div className="mt-1 text-2xl font-black text-rose-700">{report.summary.open}</div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-[11px] font-black uppercase text-emerald-600">Đã xử lý</div>
                  <div className="mt-1 text-2xl font-black text-emerald-700">{report.summary.resolved}</div>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <div className="text-[11px] font-black uppercase text-amber-700">Thất thoát đã triệt tiêu</div>
                  <div className="mt-1 text-2xl font-black text-amber-800">
                    {formatNumber(report.summary.eliminatedLeakRate)} <span className="text-sm">l/h</span>
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-amber-700">
                    Tổng phát hiện: {formatNumber(report.summary.estimatedLeakRate)} l/h
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                Lưu lượng là số ước tính từ bậc &quot;Mức độ&quot; của từng điểm, không phải số đo thực tế.
              </div>

              {report.byType.map((group) => (
                <section key={String(group.typeId) + group.typeName} className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                    <h4 className="text-base font-black text-slate-900">
                      {group.typeName}: <span className="text-teal-700">{group.count}</span>
                    </h4>
                    {group.count > 0 && (
                      <span className="text-xs font-bold text-slate-500">
                        Đã xử lý {group.resolved}/{group.count} · ước tính {formatNumber(group.estimatedLeak)} l/h
                      </span>
                    )}
                  </div>

                  {group.count === 0 ? (
                    <div className="px-4 py-3 text-sm font-semibold text-slate-400">Không có sự cố</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-2">Tên</th>
                            <th className="px-4 py-2">Vị trí</th>
                            <th className="px-4 py-2">Mức độ</th>
                            <th className="px-4 py-2">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.points.map((row) => (
                            <tr key={row._id} className="border-t border-slate-100">
                              <td className="px-4 py-2 font-bold text-slate-900">{row.title}</td>
                              <td className="px-4 py-2 text-slate-600">
                                {row.group}
                                <span className="ml-2 font-mono text-[11px] text-slate-400">
                                  {Number(row.lat).toFixed(5)}, {Number(row.lng).toFixed(5)}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-2">
                                <span className="rounded-md px-2 py-0.5 text-[11px] font-black text-white" style={{ backgroundColor: getLeakColor(row.leakRate) }}>
                                  {row.leakRateLabel}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-slate-600">
                                {row.statusLabel}
                                {row.status === "resolved" && row.resolvedAtText && (
                                  <span className="ml-1 text-[11px] text-slate-400">({row.resolvedAtText})</span>
                                )}
                                {row.status === "open" && row.unresolvedReason && (
                                  <span className="ml-1 text-[11px] text-rose-500">({row.unresolvedReason})</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center font-semibold text-slate-400">Bấm &quot;Tra cứu&quot; để xem báo cáo</div>
          )}
        </div>
      </div>
    </>
  );
};

export default IncidentReportPanel;
