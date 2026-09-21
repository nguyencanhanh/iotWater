import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
  Decimation,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import {
  FaChartLine,
  FaCheck,
  FaClock,
  FaDatabase,
  FaLayerGroup,
  FaSearch,
  FaSyncAlt,
} from "react-icons/fa";
import {
  externalLoggerDataGet,
  externalLoggerPointsGet,
  externalLoggerProvidersGet,
  externalLoggerTokenRefreshPost,
} from "../api";

ChartJS.register(CategoryScale, Decimation, LinearScale, PointElement, LineElement, Tooltip, Legend);

const pressurePalette = [
  "#0f766e",
  "#0369a1",
  "#15803d",
  "#4338ca",
  "#0891b2",
  "#4d7c0f",
  "#1d4ed8",
  "#047857",
  "#6d28d9",
  "#155e75",
];

const flowPalette = [
  "#ea580c",
  "#dc2626",
  "#be123c",
  "#d97706",
  "#c026d3",
  "#e11d48",
  "#b45309",
  "#9333ea",
  "#f97316",
  "#b91c1c",
];

const intervalOptions = [
  { value: 1, label: "Dữ liệu gốc" },
  { value: 5, label: "5 phút" },
  { value: 15, label: "15 phút" },
  { value: 30, label: "30 phút" },
  { value: 60, label: "1 giờ" },
  { value: 180, label: "3 giờ" },
  { value: 360, label: "6 giờ" },
  { value: 1440, label: "1 ngày" },
];

const metricOptions = [
  { key: "pressure", label: "Áp suất", unit: "m" },
  { key: "flow", label: "Lưu lượng", unit: "m³/h" },
  { key: "pressureFlow", label: "Áp suất + Lưu lượng", unit: "" },
];

const settingsStorageKey = "externalLoggerPageSettings_v1";

const readSavedSettings = () => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(settingsStorageKey) || "{}");
  } catch {
    return {};
  }
};

const toDateTimeLocal = (date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

const getLast24Hours = () => {
  const end = new Date();
  return {
    fromDate: toDateTimeLocal(new Date(end.getTime() - 24 * 60 * 60 * 1000)),
    toDate: toDateTimeLocal(end),
  };
};

const normalizeDurationHours = (value, fallback = 24) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, 1), 24 * 62);
};

const addHours = (value, hours) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toDateTimeLocal(new Date(date.getTime() + normalizeDurationHours(hours) * 60 * 60 * 1000));
};

const hoursBetween = (fromDate, toDate) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const value = (to.getTime() - from.getTime()) / (60 * 60 * 1000);
  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(1)) : 24;
};

const formatDateTime = (value) => new Date(value).toLocaleString("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const formatNumber = (value) => Number.isFinite(Number(value))
  ? Number(value).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : "—";

const getStats = (records, channelKey) => {
  const values = records
    .map((record) => Number(record.values?.[channelKey]))
    .filter(Number.isFinite);
  if (!values.length) return { min: null, avg: null, max: null, count: 0, latest: null };
  return {
    min: Math.min(...values),
    avg: values.reduce((sum, value) => sum + value, 0) / values.length,
    max: Math.max(...values),
    count: values.length,
    latest: values[values.length - 1],
  };
};

const ExternalLoggers = () => {
  const savedSettings = useMemo(readSavedSettings, []);
  const initialRange = useMemo(() => {
    const last24Hours = getLast24Hours();
    if (savedSettings.pinLast24Hours) return last24Hours;
    return {
      fromDate: savedSettings.fromDate || last24Hours.fromDate,
      toDate: savedSettings.toDate || last24Hours.toDate,
    };
  }, [savedSettings]);
  const [fromDate, setFromDate] = useState(initialRange.fromDate);
  const [toDate, setToDate] = useState(initialRange.toDate);
  const [durationHours, setDurationHours] = useState(
    savedSettings.pinLast24Hours ? 24 : normalizeDurationHours(savedSettings.durationHours, 24)
  );
  const [pinLast24Hours, setPinLast24Hours] = useState(savedSettings.pinLast24Hours === true);
  const [intervalMinutes, setIntervalMinutes] = useState(
    intervalOptions.some((option) => option.value === Number(savedSettings.intervalMinutes))
      ? Number(savedSettings.intervalMinutes)
      : 60
  );
  const [providers, setProviders] = useState([]);
  const [providerId, setProviderId] = useState(savedSettings.providerId || "");
  const [points, setPoints] = useState([]);
  const [selectedNumbersByProvider, setSelectedNumbersByProvider] = useState(
    savedSettings.selectedNumbersByProvider && typeof savedSettings.selectedNumbersByProvider === "object"
      ? savedSettings.selectedNumbersByProvider
      : {}
  );
  const [loggerData, setLoggerData] = useState({});
  const [channelKey, setChannelKey] = useState(
    metricOptions.some((option) => option.key === savedSettings.channelKey) ? savedSettings.channelKey : "flow"
  );
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [loadingMorePoints, setLoadingMorePoints] = useState(false);
  const [pointsPage, setPointsPage] = useState(1);
  const [pointsTotal, setPointsTotal] = useState(0);
  const [hasMorePoints, setHasMorePoints] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [refreshingProvider, setRefreshingProvider] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const token = localStorage.getItem("token");
  const selectedNumbers = useMemo(
    () => selectedNumbersByProvider[providerId] || [],
    [providerId, selectedNumbersByProvider]
  );

  const setSelectedNumbers = (updater) => {
    setSelectedNumbersByProvider((current) => {
      const currentSelection = current[providerId] || [];
      const nextSelection = typeof updater === "function" ? updater(currentSelection) : updater;
      return { ...current, [providerId]: nextSelection };
    });
  };

  const selectedProvider = providers.find((provider) => provider.id === providerId);
  const selectedProviderConfigured = selectedProvider?.configured;
  const selectedProviderName = selectedProvider?.name;
  const selectedProviderPaginated = selectedProvider?.paginated === true;
  const selectedProviderPageSize = selectedProvider?.pageSize || 20;
  const selectedProviderManualAuthRefresh = selectedProvider?.manualAuthRefresh === true;
  const remoteSearch = selectedProviderPaginated ? search.trim() : "";

  useEffect(() => {
    let canceled = false;
    const loadProviders = async () => {
      try {
        const response = await externalLoggerProvidersGet(token);
        if (canceled || !response.data.success) return;
        const nextProviders = response.data.providers || [];
        setProviders(nextProviders);
        setProviderId((current) => (
          nextProviders.some((provider) => provider.id === current) ? current : nextProviders[0]?.id || ""
        ));
      } catch (error) {
        if (!canceled) setErrorMessage(error.response?.data?.error || "Không tải được danh sách đơn vị cung cấp");
      }
    };
    loadProviders();
    return () => { canceled = true; };
  }, [token]);

  useEffect(() => {
    setSearch("");
    setGroupFilter("");
  }, [providerId]);

  useEffect(() => {
    setPoints([]);
    setPointsPage(1);
    setPointsTotal(0);
    setHasMorePoints(false);
    setLoggerData({});
    if (!providerId) return undefined;
    if (selectedProviderName && !selectedProviderConfigured) {
      setErrorMessage(`Nguồn ${selectedProviderName} chưa được cấu hình trên máy chủ.`);
      return undefined;
    }

    let canceled = false;
    const timer = setTimeout(async () => {
      setLoadingPoints(true);
      setErrorMessage("");
      try {
        const response = await externalLoggerPointsGet(token, providerId, {
          page: 1,
          pageSize: selectedProviderPageSize,
          search: remoteSearch,
        });
        if (!canceled && response.data.success) {
          setPoints(response.data.points || []);
          setPointsPage(response.data.pagination?.page || 1);
          setPointsTotal(response.data.pagination?.total || response.data.points?.length || 0);
          setHasMorePoints(response.data.pagination?.hasMore === true);
        }
      } catch (error) {
        if (!canceled) setErrorMessage(error.response?.data?.error || "Không tải được danh sách logger ngoài");
      } finally {
        if (!canceled) setLoadingPoints(false);
      }
    }, selectedProviderPaginated ? 300 : 0);
    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [providerId, reloadKey, remoteSearch, selectedProviderConfigured, selectedProviderName, selectedProviderPageSize, selectedProviderPaginated, token]);

  useEffect(() => {
    localStorage.setItem(settingsStorageKey, JSON.stringify({
      fromDate,
      toDate,
      durationHours: normalizeDurationHours(durationHours, 24),
      pinLast24Hours,
      intervalMinutes,
      providerId,
      selectedNumbersByProvider,
      channelKey,
    }));
  }, [channelKey, durationHours, fromDate, intervalMinutes, pinLast24Hours, providerId, selectedNumbersByProvider, toDate]);

  useEffect(() => {
    if (!providerId || !selectedNumbers.length) {
      setLoggerData({});
      setLoadingData(false);
      return undefined;
    }

    let canceled = false;
    const timer = setTimeout(async () => {
      setLoadingData(true);
      setErrorMessage("");
      const results = await Promise.allSettled(selectedNumbers.map((number) => (
        externalLoggerDataGet(token, providerId, number, { fromDate, toDate, intervalMinutes })
      )));
      if (canceled) return;

      const nextData = {};
      const failedMessages = [];
      results.forEach((result, index) => {
        const number = selectedNumbers[index];
        if (result.status === "fulfilled" && result.value.data.success) {
          nextData[number] = result.value.data;
        } else {
          failedMessages.push(result.reason?.response?.data?.error || `Không tải được logger ${number}`);
        }
      });
      setLoggerData(nextData);
      if (failedMessages.length) setErrorMessage([...new Set(failedMessages)].join(" "));
      setLoadingData(false);
    }, 350);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [fromDate, intervalMinutes, providerId, reloadKey, selectedNumbers, toDate, token]);

  const groups = useMemo(() => [...new Set(points.map((point) => point.group || "Không có"))]
    .sort((a, b) => a.localeCompare(b, "vi")), [points]);

  const filteredPoints = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return points.filter((point) => {
      const matchesSearch = !keyword
        || point.number.toLowerCase().includes(keyword)
        || point.name.toLowerCase().includes(keyword)
        || point.group.toLowerCase().includes(keyword);
      return matchesSearch && (!groupFilter || point.group === groupFilter);
    });
  }, [groupFilter, points, search]);

  const selectedChannel = metricOptions.find((channel) => channel.key === channelKey) || metricOptions[0];
  const isCombined = channelKey === "pressureFlow";
  const pointByNumber = useMemo(() => Object.fromEntries(points.map((point) => [point.number, point])), [points]);

  const chartData = useMemo(() => {
    const timestamps = [...new Set(Object.values(loggerData).flatMap((data) => (
      (data.records || []).map((record) => record.timestamp)
    )))].sort((a, b) => new Date(a) - new Date(b));

    return {
      labels: timestamps.map(formatDateTime),
      datasets: selectedNumbers.flatMap((number, index) => {
        const data = loggerData[number];
        if (!data) return [];
        const point = pointByNumber[number];
        const buildDataset = (metricKey) => {
          const metric = metricOptions.find((item) => item.key === metricKey);
          const metricPalette = metricKey === "flow" ? flowPalette : pressurePalette;
          const color = metricPalette[index % metricPalette.length];
          const valuesByTime = new Map((data.records || []).map((record) => [record.timestamp, record.values?.[metricKey]]));
          return {
            label: `${number} ${point?.name || data.name || "Logger"}${isCombined ? ` - ${metric.label}` : ""}`,
            data: timestamps.map((timestamp) => {
              const value = Number(valuesByTime.get(timestamp));
              return Number.isFinite(value) ? value : null;
            }),
            borderColor: color,
            backgroundColor: `${color}22`,
            borderWidth: metricKey === "flow" && isCombined ? 2.5 : 2,
            borderDash: metricKey === "flow" && isCombined ? [7, 5] : undefined,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.28,
            spanGaps: true,
            yAxisID: isCombined ? metricKey : "y",
            unit: metric.unit,
          };
        };
        return isCombined
          ? [buildDataset("pressure"), buildDataset("flow")]
          : [buildDataset(channelKey)];
      }),
    };
  }, [channelKey, isCombined, loggerData, pointByNumber, selectedNumbers]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        borderColor: "rgba(226, 232, 240, 0.35)",
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatNumber(context.parsed.y)} ${context.dataset.unit || ""}`,
        },
      },
      decimation: { enabled: chartData.labels.length > 1200, algorithm: "lttb", samples: 700 },
    },
    scales: isCombined
      ? {
        x: {
          border: { display: false },
          grid: { color: "#e9eef5", drawTicks: false },
          ticks: { maxTicksLimit: 6, color: "#94a3b8", font: { weight: "700" } },
        },
        pressure: {
          position: "left",
          border: { display: false },
          grid: { color: "#e9eef5", drawTicks: false },
          ticks: { color: "#64748b", font: { weight: "800" } },
        },
        flow: {
          position: "right",
          min: 0,
          border: { display: false },
          grid: { drawOnChartArea: false },
          ticks: { color: "#64748b", font: { weight: "800" } },
        },
      }
      : {
        x: {
          border: { display: false },
          grid: { color: "#e9eef5", drawTicks: false },
          ticks: { maxTicksLimit: 6, color: "#94a3b8", font: { weight: "700" } },
        },
        y: {
          min: channelKey === "flow" ? 0 : undefined,
          border: { display: false },
          grid: { color: "#e9eef5", drawTicks: false },
          ticks: { color: "#64748b", font: { weight: "800" } },
        },
      },
  }), [channelKey, chartData.labels.length, isCombined]);

  const handleFromDateChange = (value) => {
    setFromDate(value);
    const nextToDate = addHours(value, durationHours);
    if (nextToDate) setToDate(nextToDate);
  };

  const handleDurationChange = (value) => {
    setDurationHours(value);
    if (String(value).trim()) setToDate(addHours(fromDate, value));
  };

  const applyLast24Hours = () => {
    const range = getLast24Hours();
    setFromDate(range.fromDate);
    setToDate(range.toDate);
    setDurationHours(24);
  };

  const refreshPageData = async () => {
    if (refreshingProvider) return;
    if (pinLast24Hours) applyLast24Hours();
    setRefreshingProvider(true);
    setErrorMessage("");
    try {
      if (selectedProviderManualAuthRefresh) {
        await externalLoggerTokenRefreshPost(token, providerId);
      }
      setReloadKey((value) => value + 1);
    } catch (error) {
      setErrorMessage(error.response?.data?.error || "Không đăng nhập lại được nguồn logger ngoài");
    } finally {
      setRefreshingProvider(false);
    }
  };

  const togglePoint = (number) => {
    setSelectedNumbers((current) => current.includes(number)
      ? current.filter((item) => item !== number)
      : [...current, number]);
  };

  const loadMorePoints = async () => {
    if (!selectedProviderPaginated || !hasMorePoints || loadingMorePoints || loadingPoints) return;
    const nextPage = pointsPage + 1;
    setLoadingMorePoints(true);
    try {
      const response = await externalLoggerPointsGet(token, providerId, {
        page: nextPage,
        pageSize: selectedProviderPageSize,
        search: remoteSearch,
      });
      if (response.data.success) {
        setPoints((current) => {
          const pointMap = new Map(current.map((point) => [point.number, point]));
          (response.data.points || []).forEach((point) => pointMap.set(point.number, point));
          return [...pointMap.values()];
        });
        setPointsPage(response.data.pagination?.page || nextPage);
        setPointsTotal(response.data.pagination?.total || pointsTotal);
        setHasMorePoints(response.data.pagination?.hasMore === true);
      }
    } catch (error) {
      setErrorMessage(error.response?.data?.error || "Không tải được trang logger tiếp theo");
    } finally {
      setLoadingMorePoints(false);
    }
  };

  const handlePointListScroll = (event) => {
    const element = event.currentTarget;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 120) loadMorePoints();
  };

  return (
    <div className="min-h-full bg-[#f4f7f2] p-4 text-slate-900 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-5">
          <div className="rounded-[24px] border border-white bg-white/90 p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_110px_160px_170px_130px_52px]">
              <label className="text-sm font-bold text-slate-600">
                Từ thời điểm
                <input
                  type="datetime-local"
                  value={fromDate}
                  disabled={pinLast24Hours}
                  onChange={(event) => handleFromDateChange(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <label className="text-sm font-bold text-slate-600">
                Đến thời điểm
                <input
                  type="datetime-local"
                  value={toDate}
                  disabled={pinLast24Hours}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setDurationHours(hoursBetween(fromDate, event.target.value));
                  }}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <label className="text-sm font-bold text-slate-600">
                Số giờ lấy dữ liệu
                <input
                  type="number"
                  min="1"
                  max={24 * 62}
                  step="0.5"
                  value={durationHours}
                  disabled={pinLast24Hours}
                  onChange={(event) => handleDurationChange(event.target.value)}
                  onBlur={() => setDurationHours(normalizeDurationHours(durationHours))}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <label className="text-sm font-bold text-slate-600">
                Dữ liệu
                <select
                  value={channelKey}
                  onChange={(event) => setChannelKey(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  {metricOptions.map((channel) => <option key={channel.key} value={channel.key}>{channel.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-600">
                Thời gian hiển thị
                <select
                  value={intervalMinutes}
                  onChange={(event) => setIntervalMinutes(Number(event.target.value))}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  {intervalOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className={`mt-6 inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black transition ${pinLast24Hours ? "border-teal-300 bg-teal-600 text-white" : "border-teal-200 bg-teal-50 text-teal-700"}`}>
                <input
                  type="checkbox"
                  checked={pinLast24Hours}
                  onChange={(event) => {
                    setPinLast24Hours(event.target.checked);
                    if (event.target.checked) applyLast24Hours();
                  }}
                  className="h-4 w-4 accent-teal-600"
                />
                <FaClock /> Ghim 24h
              </label>
              <button
                type="button"
                title={selectedProviderManualAuthRefresh ? "Đăng nhập lại và tải dữ liệu" : "Tải lại dữ liệu"}
                onClick={refreshPageData}
                disabled={loadingData || loadingPoints || refreshingProvider || !providerId}
                className="mt-6 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaSyncAlt className={loadingData || refreshingProvider ? "animate-spin" : ""} />
              </button>
            </div>
            {loadingData && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700">
                <FaSyncAlt className="animate-spin" /> Đang tải dữ liệu logger ngoài...
              </div>
            )}
            {errorMessage && (
              <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {errorMessage}
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex flex-col gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-900">Biểu đồ {selectedChannel?.label || "dữ liệu"}</h2>
                <div className="mt-1 text-sm font-semibold text-slate-500">
                  {chartData.labels.length ? `${chartData.labels.length} mốc dữ liệu · ${chartData.datasets.length} logger` : "Chưa có dữ liệu biểu đồ"}
                </div>
              </div>
              {chartData.datasets.length > 0 && (
                <div className="flex max-h-20 flex-wrap gap-x-5 gap-y-2 overflow-y-auto">
                  {chartData.datasets.map((dataset) => (
                    <div key={dataset.label} className="inline-flex min-w-0 items-center gap-2 text-sm font-extrabold text-slate-500">
                      <span
                        className="h-0 w-8 shrink-0 border-t-[3px]"
                        style={{ borderColor: dataset.borderColor, borderStyle: dataset.borderDash ? "dashed" : "solid" }}
                      />
                      <span className="max-w-[260px] truncate">{dataset.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-inner">
              <div className="relative h-[430px] overflow-hidden rounded-[18px] bg-white p-1">
                {chartData.labels.length ? (
                  <Line data={chartData} options={chartOptions} />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                    <FaChartLine className="mb-4 text-5xl text-teal-200" />
                    <div className="text-lg font-black text-slate-600">Chưa có dữ liệu</div>
                    <div className="mt-1 max-w-md text-sm">Chọn một hoặc nhiều logger ở danh sách bên phải để hiển thị biểu đồ.</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[24px] border border-white bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="font-black text-slate-900">Tổng hợp từng logger</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Logger</th>
                    <th className="px-4 py-3">Đơn vị</th>
                    <th className="px-4 py-3">Min</th>
                    <th className="px-4 py-3">Avg</th>
                    <th className="px-4 py-3">Max</th>
                    <th className="px-4 py-3">Mới nhất</th>
                    <th className="px-4 py-3">Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedNumbers.length ? selectedNumbers.map((number) => {
                    const data = loggerData[number];
                    const pressureStats = getStats(data?.records || [], "pressure");
                    const flowStats = getStats(data?.records || [], "flow");
                    const stats = channelKey === "pressure" ? pressureStats : flowStats;
                    const renderValue = (key, showUnit = false) => isCombined ? (
                      <div className="space-y-1 leading-tight">
                        <div><span className="font-bold text-teal-700">Áp:</span> {formatNumber(pressureStats[key])}{showUnit ? " m" : ""}</div>
                        <div><span className="font-bold text-blue-700">Lưu lượng:</span> {formatNumber(flowStats[key])}{showUnit ? " m³/h" : ""}</div>
                      </div>
                    ) : `${formatNumber(stats[key])}${showUnit ? ` ${selectedChannel?.unit}` : ""}`;
                    return (
                      <tr key={number} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-bold text-slate-900">{number} - {pointByNumber[number]?.name || data?.name || "Logger"}</td>
                        <td className="px-4 py-3 text-slate-600">{selectedProvider?.name || "—"}</td>
                        <td className="px-4 py-3">{renderValue("min")}</td>
                        <td className="px-4 py-3">{renderValue("avg")}</td>
                        <td className="px-4 py-3">{renderValue("max")}</td>
                        <td className="px-4 py-3">{renderValue("latest", true)}</td>
                        <td className="px-4 py-3">{isCombined ? `Áp: ${pressureStats.count} · Lưu lượng: ${flowStats.count}` : stats.count}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">Chưa chọn logger</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-16 xl:self-start">
          <div className="rounded-[26px] border border-white bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <span className="rounded-lg bg-teal-600 p-2 text-white"><FaLayerGroup /></span>
                Nguồn dữ liệu
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedNumbers([]);
                  setLoggerData({});
                }}
                className="text-xs font-bold text-rose-500 hover:text-rose-700"
              >
                Bỏ chọn
              </button>
            </div>

            <label className="mb-3 block text-sm font-bold text-slate-600">
              Đơn vị cung cấp
              <div className="relative mt-1">
                <FaDatabase className="pointer-events-none absolute left-3 top-3.5 text-teal-600" />
                <select
                  value={providerId}
                  onChange={(event) => setProviderId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-bold outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name}</option>
                  ))}
                </select>
              </div>
            </label>

            <div className="mb-3 grid gap-2">
              <div className="relative">
                <FaSearch className="absolute left-3 top-3 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm mã, tên logger, nhóm..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
                />
              </div>
              <select
                value={groupFilter}
                onChange={(event) => setGroupFilter(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-teal-500 focus:bg-white focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Tất cả nhóm</option>
                {groups.map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
            </div>

            {selectedProviderPaginated && pointsTotal > 0 && (
              <div className="mb-2 text-right text-xs font-bold text-slate-400">
                Đã tải {points.length}/{pointsTotal} logger
              </div>
            )}

            <div
              className="max-h-[620px] space-y-2 overflow-y-auto pr-1"
              onScroll={handlePointListScroll}
            >
              {loadingPoints ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                  <FaSyncAlt className="animate-spin" /> Đang tải danh sách...
                </div>
              ) : filteredPoints.length ? <>
                {filteredPoints.map((point) => {
                const checked = selectedNumbers.includes(point.number);
                const disconnected = point.connected !== true || String(point.status).toUpperCase() !== "SUCCESS";
                return (
                  <button
                    type="button"
                    key={point.number}
                    onClick={() => togglePoint(point.number)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      disconnected
                        ? checked ? "border-rose-500 bg-rose-100" : "border-rose-300 bg-rose-50 hover:border-rose-400 hover:bg-rose-100"
                        : checked ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        checked
                          ? disconnected ? "border-rose-600 bg-rose-600 text-white" : "border-teal-600 bg-teal-600 text-white"
                          : disconnected ? "border-rose-300 bg-white text-transparent" : "border-slate-300 bg-white text-transparent"
                      }`}>
                        <FaCheck className="text-xs" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`mb-1 inline-flex max-w-full rounded-lg px-2 py-0.5 text-xs font-black text-white ${disconnected ? "bg-rose-600" : "bg-blue-700"}`}>{point.number}</span>
                        <span className={`block truncate font-bold ${disconnected ? "text-rose-800" : "text-slate-900"}`}>{point.name}</span>
                        {disconnected && (
                          <span className="mt-1 inline-flex rounded-md bg-rose-600 px-2 py-0.5 text-xs font-black text-white">
                            Mất kết nối
                          </span>
                        )}
                        <span className={`block truncate text-xs font-semibold ${disconnected ? "mt-1 text-rose-600" : "text-slate-500"}`}>Nhóm: {point.group || "Không có"}</span>
                        {point.address && <span className="mt-1 block truncate text-xs text-slate-400">{point.address}</span>}
                      </span>
                    </div>
                  </button>
                );
                })}
                {loadingMorePoints && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm font-bold text-teal-700">
                    <FaSyncAlt className="animate-spin" /> Đang tải thêm...
                  </div>
                )}
              </> : (
                <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                  Chưa có logger từ nguồn này.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ExternalLoggers;
