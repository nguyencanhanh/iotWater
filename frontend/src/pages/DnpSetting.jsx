import React, { useEffect, useMemo, useState } from "react";
import { FaCheck, FaSave, FaSearch, FaTint } from "react-icons/fa";
import { dnpConfigGet, dnpConfigPut } from "../api";
import { useAuth } from "../context/authContext";

const DnpSetting = ({ embedded = false }) => {
  const { user, info = [] } = useAuth();
  const currentUser = Number.isFinite(Number(user?.user)) ? Number(user.user) : 0;
  const [loggerIds, setLoggerIds] = useState([]);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const groups = useMemo(
    () => [...new Set(info.map((sensor) => sensor.group || "Không có"))].sort((a, b) => a.localeCompare(b, "vi")),
    [info]
  );

  const filteredSensors = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return info.filter((sensor) => {
      const matchesSearch = !keyword
        || String(sensor.id).includes(keyword)
        || (sensor.name || "").toLowerCase().includes(keyword)
        || (sensor.group || "").toLowerCase().includes(keyword);
      const matchesGroup = !groupFilter || (sensor.group || "Không có") === groupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [groupFilter, info, search]);

  const selectedSet = useMemo(() => new Set(loggerIds.map(Number)), [loggerIds]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await dnpConfigGet(localStorage.getItem("token"), currentUser);
      if (res.data.success) {
        setLoggerIds((res.data.config?.loggerIds || []).map(Number).filter(Number.isFinite));
      }
    } catch (error) {
      setMessage(error.response?.data?.error || "Không tải được cấu hình DNP");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [currentUser]);

  const toggleLogger = (id) => {
    setLoggerIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  };

  const selectVisible = () => {
    setLoggerIds((prev) => [...new Set([...prev, ...filteredSensors.map((sensor) => Number(sensor.id))].filter(Number.isFinite))]);
  };

  const clearVisible = () => {
    const visibleIds = new Set(filteredSensors.map((sensor) => Number(sensor.id)));
    setLoggerIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await dnpConfigPut(localStorage.getItem("token"), {
        user: currentUser,
        name: "DNP",
        loggerIds,
      });
      if (res.data.success) {
        setLoggerIds((res.data.config?.loggerIds || []).map(Number).filter(Number.isFinite));
        setMessage("Đã lưu cấu hình logger DNP");
      }
    } catch (error) {
      setMessage(error.response?.data?.error || "Không lưu được cấu hình DNP");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={embedded ? "text-slate-900" : "min-h-full bg-[#f4f7f2] p-4 text-slate-900 md:p-6"}>
      <div className={embedded ? "space-y-5" : "mx-auto max-w-6xl space-y-5"}>
        <div className="rounded-[26px] border border-white bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
                <span className="rounded-xl bg-teal-600 p-2 text-white"><FaTint /></span>
                Cài đặt logger DNP
              </h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Chọn các logger sẽ được dùng để tính sheet bình quân lấy nước DNP trong báo cáo Excel.
              </p>
            </div>
            <button
              onClick={saveConfig}
              disabled={saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaSave /> {saving ? "Đang lưu..." : "Lưu cấu hình"}
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
            <div className="relative">
              <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm ID, tên logger, nhóm..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Tất cả nhóm</option>
              {groups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
            <button onClick={selectVisible} className="h-11 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white hover:bg-teal-700">
              Chọn trang này
            </button>
            <button onClick={clearVisible} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Bỏ trang này
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold text-slate-600">
            <span className="rounded-xl bg-blue-50 px-3 py-2 text-blue-700">Đã chọn: {loggerIds.length}</span>
            <span className="rounded-xl bg-slate-50 px-3 py-2">Đang hiển thị: {filteredSensors.length}</span>
            {loading && <span className="text-teal-700">Đang tải cấu hình...</span>}
            {message && <span className="text-teal-700">{message}</span>}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredSensors.map((sensor) => {
            const id = Number(sensor.id);
            const checked = selectedSet.has(id);
            return (
              <button
                key={id}
                onClick={() => toggleLogger(id)}
                className={`rounded-2xl border p-4 text-left transition ${checked ? "border-teal-400 bg-teal-50" : "border-white bg-white hover:border-teal-200 hover:bg-slate-50"}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${checked ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                    <FaCheck className="text-xs" />
                  </span>
                  <span className="min-w-0">
                    <span className="mb-1 inline-flex rounded-lg bg-blue-700 px-2 py-0.5 text-xs font-black text-white">{id}</span>
                    <span className="block truncate font-bold text-slate-900">{sensor.name || `Logger ${id}`}</span>
                    <span className="text-xs font-semibold text-slate-500">Nhóm: {sensor.group || "Không có"}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DnpSetting;
