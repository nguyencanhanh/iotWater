import React, { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
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
  FaDownload,
  FaLayerGroup,
  FaRobot,
  FaSearch,
  FaSyncAlt,
  FaTint,
} from "react-icons/fa";
import { dmaListGet, exportDailyReportPost, sensorReportAiAnalysisPost, sensorReportPost } from "../api";
import { useAuth } from "../context/authContext";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const palette = [
  "#0f766e",
  "#2563eb",
  "#f97316",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#be123c",
  "#9333ea",
  "#ea580c",
  "#0284c7",
  "#4d7c0f",
];

const flowPalette = [
  "#e11d48",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#22c55e",
  "#0ea5e9",
  "#a855f7",
];

const metricOptions = [
  { key: "flow", label: "Lưu lượng", unit: "m³/h" },
  { key: "pressure", label: "Áp suất", unit: "m" },
  { key: "pressureFlow", label: "Áp suất + Lưu lượng", unit: "" },
  { key: "meter", label: "Chỉ số đồng hồ", unit: "m³" },
];

const intervalOptions = [
  { value: 5, label: "5 phút" },
  { value: 15, label: "15 phút" },
  { value: 30, label: "30 phút" },
  { value: 60, label: "1 giờ" },
  { value: 180, label: "3 giờ" },
  { value: 360, label: "6 giờ" },
  { value: 1440, label: "1 ngày" },
];

const reportSettingsVersion = 3;

const getReportStorageKey = (userId) => `reportPageSettings_${userId}`;

const readSavedReportSettings = (userId) => {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(getReportStorageKey(userId)) || "{}");
  } catch (error) {
    return {};
  }
};

const toDateTimeLocal = (date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

const normalizeDurationHours = (value, fallback = 24) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  const clamped = Math.min(Math.max(number, 1), 24 * 62);
  return Number(clamped.toFixed(2));
};

const getHoursBetween = (startValue, endValue, fallback = 24) => {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return fallback;
  const hours = (end.getTime() - start.getTime()) / (60 * 60 * 1000);
  return normalizeDurationHours(Math.round(hours * 100) / 100, fallback);
};

const addHoursToDateTimeLocal = (value, hours) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setTime(date.getTime() + normalizeDurationHours(hours) * 60 * 60 * 1000);
  return toDateTimeLocal(date);
};

const getDefaultReportRange = (baseDate) => {
  const end = new Date(baseDate);
  end.setHours(6, 0, 0, 0);
  if (end > baseDate) end.setDate(end.getDate() - 1);

  const start = new Date(end);
  start.setDate(start.getDate() - 1);
  return {
    fromDate: toDateTimeLocal(start),
    toDate: toDateTimeLocal(end),
  };
};

const getLast24HoursRange = (baseDate = new Date()) => {
  const end = new Date(baseDate);
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return {
    fromDate: toDateTimeLocal(start),
    toDate: toDateTimeLocal(end),
  };
};

const getDatePart = (value) => String(value || "").slice(0, 10);

const getTimePart = (value) => String(value || "").slice(11, 16) || "00:00";

const dateStringToLocalDate = (value) => new Date(`${value}T00:00`);

const addDaysToDateString = (value, days) => {
  const date = dateStringToLocalDate(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return toDateTimeLocal(date).slice(0, 10);
};

const getDefaultReportName = (fromValue, toValue) => (
  `bao-cao-${getDatePart(fromValue)}-${getDatePart(toValue)}`
);

const sanitizeFileName = (name, fallback) => {
  const cleaned = String(name || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return cleaned || fallback;
};

const formatDateTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value, digits = 2) => (
  Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—"
);

const roundToTwo = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
};

const formatCsvNumber = (value) => {
  const rounded = roundToTwo(value);
  return rounded === null ? "" : rounded.toFixed(2);
};

const readBlobErrorMessage = async (error, fallback) => {
  const data = error.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      return parsed.error || fallback;
    } catch {
      return fallback;
    }
  }
  return error.response?.data?.error || fallback;
};

const getDmaLoggerIds = (dma, allDmas) => {
  if (!dma) return [];
  const childDmas = allDmas.filter((item) => String(item.parentDmaId || "") === String(dma._id));
  const ownIds = [
    ...(dma.inletLoggerIds || []),
    ...(dma.consumeLoggerIds || []),
    ...(dma.sensorLinks || []).flatMap((link) => [link.parentId, link.childId]),
  ];
  return [...new Set([...ownIds, ...childDmas.flatMap((child) => getDmaLoggerIds(child, allDmas))].map(Number).filter(Number.isFinite))];
};

const SummaryCard = ({ label, value, tone }) => {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    teal: "bg-teal-50 text-teal-700 border-teal-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  }[tone] || "bg-gray-50 text-gray-700 border-gray-100";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
      <div className="text-xs font-bold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
};

const Report = () => {
  const { user, info = [] } = useAuth();
  const currentUser = Number.isFinite(Number(user?.user)) ? Number(user.user) : 0;
  const savedSettings = useMemo(() => readSavedReportSettings(currentUser), [currentUser]);
  const now = useMemo(() => new Date(), []);
  const defaultRange = useMemo(() => getDefaultReportRange(now), [now]);
  const last24HoursRange = useMemo(() => getLast24HoursRange(now), [now]);
  const shouldUseDefaultRange = savedSettings.reportSettingsVersion !== reportSettingsVersion;
  const savedPinLast24Hours = !shouldUseDefaultRange && savedSettings.pinLast24Hours === true;
  const initialFromDate = savedPinLast24Hours
    ? last24HoursRange.fromDate
    : shouldUseDefaultRange ? defaultRange.fromDate : (savedSettings.fromDate || defaultRange.fromDate);
  const initialDurationHours = shouldUseDefaultRange
    ? 24
    : savedPinLast24Hours
      ? 24
      : normalizeDurationHours(savedSettings.durationHours ?? getHoursBetween(initialFromDate, savedSettings.toDate || defaultRange.toDate));
  const initialToDate = savedPinLast24Hours
    ? last24HoursRange.toDate
    : shouldUseDefaultRange
    ? defaultRange.toDate
    : (savedSettings.toDate || addHoursToDateTimeLocal(initialFromDate, initialDurationHours));
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [durationHours, setDurationHours] = useState(initialDurationHours);
  const [pinLast24Hours, setPinLast24Hours] = useState(savedPinLast24Hours);
  const [metric, setMetric] = useState(metricOptions.some((item) => item.key === savedSettings.metric) ? savedSettings.metric : "flow");
  const [intervalMinutes, setIntervalMinutes] = useState(
    intervalOptions.some((item) => item.value === Number(savedSettings.intervalMinutes))
      ? Number(savedSettings.intervalMinutes)
      : 60
  );
  const [sourceMode, setSourceMode] = useState(["logger", "dma"].includes(savedSettings.sourceMode) ? savedSettings.sourceMode : "logger");
  const [selectedLoggerIds, setSelectedLoggerIds] = useState(
    Array.isArray(savedSettings.selectedLoggerIds)
      ? savedSettings.selectedLoggerIds.map(Number).filter(Number.isFinite)
      : []
  );
  const [selectedDmaIds, setSelectedDmaIds] = useState(
    Array.isArray(savedSettings.selectedDmaIds)
      ? savedSettings.selectedDmaIds.map(String)
      : []
  );
  const [dmas, setDmas] = useState([]);
  const [search, setSearch] = useState(savedSettings.search || "");
  const [groupFilter, setGroupFilter] = useState(savedSettings.groupFilter || "");
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiError, setAiError] = useState("");
  const [aiUsage, setAiUsage] = useState(null);
  const [exportExcelSelected, setExportExcelSelected] = useState(savedSettings.exportExcelSelected ?? true);
  const [exportCsvSelected, setExportCsvSelected] = useState(savedSettings.exportCsvSelected ?? false);
  const [exportDnpSelected, setExportDnpSelected] = useState(savedSettings.exportDnpSelected ?? false);
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const [reportName, setReportName] = useState(
    savedSettings.reportName || getDefaultReportName(initialFromDate, addHoursToDateTimeLocal(initialFromDate, initialDurationHours))
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchDmas = async () => {
      try {
        const res = await dmaListGet(localStorage.getItem("token"), currentUser);
        if (res.data.success) setDmas(res.data.dmas || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchDmas();
  }, [currentUser]);

  const sensorById = useMemo(
    () => Object.fromEntries(info.map((sensor) => [Number(sensor.id), sensor])),
    [info]
  );

  const groups = useMemo(
    () => [...new Set(info.map((sensor) => sensor.group || "Không có"))].sort((a, b) => a.localeCompare(b, "vi")),
    [info]
  );

  const selectedDmaLoggerIds = useMemo(() => {
    const ids = selectedDmaIds.flatMap((dmaId) => getDmaLoggerIds(dmas.find((dma) => dma._id === dmaId), dmas));
    return [...new Set(ids)];
  }, [dmas, selectedDmaIds]);

  const activeLoggerIds = sourceMode === "dma" ? selectedDmaLoggerIds : selectedLoggerIds;
  const activeLoggerKey = activeLoggerIds.join(",");

  useEffect(() => {
    setAiAnalysis("");
    setAiError("");
  }, [activeLoggerKey, fromDate, intervalMinutes, metric, sourceMode, toDate]);

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

  const selectedSensors = activeLoggerIds.map((id) => sensorById[id]).filter(Boolean);
  const reportSeries = reportData?.series || [];
  const dataPointCount = reportSeries.reduce((sum, item) => sum + (item.stats?.count || 0), 0);
  const noDataCount = reportSeries.filter((item) => !item.stats?.count).length;
  const totalVolume = reportSeries.reduce((sum, item) => sum + Number(item.stats?.volume || 0), 0);
  const selectedMetric = metricOptions.find((item) => item.key === metric) || metricOptions[0];

  useEffect(() => {
    localStorage.setItem(
      getReportStorageKey(currentUser),
      JSON.stringify({
        reportSettingsVersion,
        fromDate,
        toDate,
        durationHours: normalizeDurationHours(durationHours),
        pinLast24Hours,
        metric,
        intervalMinutes,
        exportExcelSelected,
        exportCsvSelected,
        exportDnpSelected,
        reportName,
        sourceMode,
        selectedLoggerIds,
        selectedDmaIds,
        search,
        groupFilter,
      })
    );
  }, [currentUser, durationHours, exportCsvSelected, exportDnpSelected, exportExcelSelected, fromDate, groupFilter, intervalMinutes, metric, pinLast24Hours, reportName, search, selectedDmaIds, selectedLoggerIds, sourceMode, toDate]);

  const toggleLogger = (id) => {
    setSelectedLoggerIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  };

  const toggleDma = (id) => {
    setSelectedDmaIds((prev) => (
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    ));
  };

  const setSourceTab = (mode) => {
    setSourceMode(mode);
    if (mode === "logger") {
      setSelectedDmaIds([]);
    }
  };

  const handleFromDateChange = (value) => {
    setFromDate(value);
    const nextToDate = addHoursToDateTimeLocal(value, durationHours);
    if (nextToDate) setToDate(nextToDate);
  };

  const handleToDateChange = (value) => {
    setToDate(value);
    setDurationHours(getHoursBetween(fromDate, value, normalizeDurationHours(durationHours)));
  };

  const handleDurationHoursChange = (value) => {
    setDurationHours(value);
    if (String(value).trim() === "") return;
    const nextToDate = addHoursToDateTimeLocal(fromDate, value);
    if (nextToDate) setToDate(nextToDate);
  };

  const handleDurationHoursBlur = () => {
    const normalizedHours = normalizeDurationHours(durationHours, getHoursBetween(fromDate, toDate));
    setDurationHours(normalizedHours);
    const nextToDate = addHoursToDateTimeLocal(fromDate, normalizedHours);
    if (nextToDate) setToDate(nextToDate);
  };

  const applyLast24HoursRange = () => {
    const range = getLast24HoursRange();

    setFromDate(range.fromDate);
    setToDate(range.toDate);
    setDurationHours(24);
    setReportName((prev) => (
      prev ? prev : getDefaultReportName(range.fromDate, range.toDate)
    ));
  };

  const handleLast24HoursPinChange = (checked) => {
    setPinLast24Hours(checked);
    if (checked) applyLast24HoursRange();
  };

  useEffect(() => {
    if (!activeLoggerIds.length) {
      setReportData(null);
      setErrorMessage("");
      setLoading(false);
      return;
    }

    let canceled = false;
    const loggerIds = [...activeLoggerIds];
    const timer = setTimeout(async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const payload = {
          loggerIds,
          fromDate,
          toDate,
          intervalMinutes,
          user: currentUser,
        };

        if (metric === "pressureFlow") {
          const [pressureRes, flowRes] = await Promise.all([
            sensorReportPost(localStorage.getItem("token"), { ...payload, metric: "pressure" }),
            sensorReportPost(localStorage.getItem("token"), { ...payload, metric: "flow" }),
          ]);
          if (!canceled && pressureRes.data.success && flowRes.data.success) {
            const pressureById = Object.fromEntries((pressureRes.data.series || []).map((item) => [item.id, item]));
            const series = (flowRes.data.series || []).map((flowItem) => {
              const pressureItem = pressureById[flowItem.id] || {};
              return {
                ...flowItem,
                values: flowItem.values,
                flowValues: flowItem.values || [],
                pressureValues: pressureItem.values || (flowItem.values || []).map(() => null),
                flowStats: flowItem.stats || {},
                pressureStats: pressureItem.stats || {},
              };
            });
            setReportData({
              ...flowRes.data,
              series,
              combined: true,
              metric: {
                key: "pressureFlow",
                label: "Áp suất + Lưu lượng",
                unit: "",
              },
            });
          }
          return;
        }

        const res = await sensorReportPost(localStorage.getItem("token"), { ...payload, metric });
        if (!canceled && res.data.success) setReportData(res.data);
      } catch (error) {
        if (!canceled) {
          const message = error.response?.data?.error || "Không tải được dữ liệu báo cáo";
          setErrorMessage(message);
          setReportData(null);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    }, 350);

    return () => {
      canceled = true;
      clearTimeout(timer);
    };
  }, [activeLoggerKey, currentUser, fromDate, intervalMinutes, metric, toDate]);

  const isCombinedReport = reportData?.metric?.key === "pressureFlow";

  const exportCsv = (fileBaseName) => {
    if (!reportData?.labels?.length) {
      throw new Error("Chưa có dữ liệu biểu đồ để xuất CSV");
    }
    const header = isCombinedReport
      ? ["Thời gian", ...reportSeries.flatMap((item) => [
        `${item.id} - ${item.name} - Áp suất (m)`,
        `${item.id} - ${item.name} - Lưu lượng (m³/h)`,
      ])]
      : ["Thời gian", ...reportSeries.map((item) => `${item.id} - ${item.name}`)];
    const rows = reportData.labels.map((label, index) => [
      new Date(label).toLocaleString("vi-VN"),
      ...(isCombinedReport
        ? reportSeries.flatMap((item) => [
          formatCsvNumber(item.pressureValues?.[index]),
          formatCsvNumber(item.flowValues?.[index]),
        ])
        : reportSeries.map((item) => formatCsvNumber(item.values[index]))),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileBaseName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadDailyExcel = async (fileBaseName) => {
    if (!activeLoggerIds.length) {
      throw new Error("Hãy chọn logger hoặc DMA trước khi xuất Excel ngày");
    }

    try {
      const fromValue = new Date(fromDate);
      const toValue = new Date(toDate);
      const nowValue = new Date();
      const reportFromDay = getDatePart(fromDate);
      const reportToDay = addDaysToDateString(getDatePart(toDate), -1);
      const yesterdayKey = addDaysToDateString(getDatePart(toDateTimeLocal(nowValue)), -1);

      if (Number.isNaN(fromValue.getTime()) || Number.isNaN(toValue.getTime()) || fromValue >= toValue) {
        throw new Error("Khoảng thời gian xuất báo cáo không hợp lệ");
      }
      if (toValue > nowValue) {
        throw new Error("Đến thời điểm không được vượt quá thời điểm hiện tại");
      }
      if (!reportToDay || dateStringToLocalDate(reportFromDay) > dateStringToLocalDate(reportToDay)) {
        throw new Error("Khoảng xuất Excel phải đủ ít nhất 1 ngày báo cáo");
      }
      if (dateStringToLocalDate(reportToDay) > dateStringToLocalDate(yesterdayKey)) {
        throw new Error("Chỉ xuất báo cáo đến ngày hôm qua trở về vì hôm nay chưa đủ dữ liệu");
      }

      const res = await exportDailyReportPost(localStorage.getItem("token"), {
        loggerIds: activeLoggerIds,
        fromDate: reportFromDay,
        toDate: reportToDay,
        startHour: getTimePart(fromDate),
        endHour: getTimePart(toDate),
        includeDnpReport: exportDnpSelected,
        user: currentUser,
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileBaseName}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (!error.response) {
        throw error;
      }
      const message = await readBlobErrorMessage(error, "Không xuất được báo cáo Excel ngày");
      throw new Error(message);
    }
  };

  const exportReport = async () => {
    setErrorMessage("");
    setExportLoading(true);
    try {
      if (!exportExcelSelected && !exportCsvSelected) {
        throw new Error("Hãy tick ít nhất một định dạng muốn xuất");
      }
      const fileBaseName = sanitizeFileName(reportName, getDefaultReportName(fromDate, toDate));
      if (exportCsvSelected) exportCsv(fileBaseName);
      if (exportExcelSelected) await downloadDailyExcel(fileBaseName);
      setReportName(fileBaseName);
      setIsExportPanelOpen(false);
    } catch (error) {
      setErrorMessage(error.message || "Không xuất được báo cáo");
    } finally {
      setExportLoading(false);
    }
  };

  const analyzeReportWithAi = async () => {
    setAiError("");
    if (!reportData?.labels?.length || !reportSeries.length) {
      setAiError("Chưa có dữ liệu biểu đồ để AI phân tích");
      return;
    }

    setAiLoading(true);
    try {
      const res = await sensorReportAiAnalysisPost(localStorage.getItem("token"), {
        reportData: {
          labels: reportData.labels,
          metric: reportData.metric || selectedMetric,
          series: reportSeries,
        },
        context: {
          fromDate,
          toDate,
          intervalMinutes,
          sourceMode,
          loggerCount: activeLoggerIds.length,
        },
      });
      if (res.data.success) {
        setAiAnalysis(res.data.analysis || "");
        setAiUsage(res.data.aiUsage || null);
      }
    } catch (error) {
      setAiUsage(error.response?.data?.aiUsage || null);
      setAiError(error.response?.data?.error || "Không phân tích được báo cáo bằng AI");
    } finally {
      setAiLoading(false);
    }
  };

  const openExportPanel = () => {
    setErrorMessage("");
    setReportName((prev) => sanitizeFileName(prev, getDefaultReportName(fromDate, toDate)));
    setIsExportPanelOpen((prev) => !prev);
  };

  const chartData = {
    labels: reportData?.labels?.map(formatDateTime) || [],
    datasets: isCombinedReport
      ? reportSeries.flatMap((item, index) => {
        const pressureColor = palette[index % palette.length];
        const flowColor = flowPalette[index % flowPalette.length];
        return [
          {
            label: `${item.id} ${item.name} - Áp suất`,
            data: (item.pressureValues || []).map(roundToTwo),
            borderColor: pressureColor,
            backgroundColor: `${pressureColor}22`,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.28,
            spanGaps: true,
            yAxisID: "pressure",
            unit: "m",
          },
          {
            label: `${item.id} ${item.name} - Lưu lượng`,
            data: (item.flowValues || []).map(roundToTwo),
            borderColor: flowColor,
            backgroundColor: `${flowColor}18`,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.28,
            spanGaps: true,
            yAxisID: "flow",
            unit: "m³/h",
          },
        ];
      })
      : reportSeries.map((item, index) => ({
        label: `${item.id} ${item.name}`,
        data: item.values.map(roundToTwo),
        borderColor: palette[index % palette.length],
        backgroundColor: `${palette[index % palette.length]}22`,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.28,
        spanGaps: true,
      })),
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y ?? "—"} ${ctx.dataset.unit || reportData?.metric?.unit || selectedMetric.unit}`,
        },
      },
    },
    scales: isCombinedReport
      ? {
        x: {
          grid: { color: "rgba(15, 23, 42, 0.06)" },
          ticks: { maxTicksLimit: 10, color: "#64748b" },
        },
        pressure: {
          position: "left",
          title: { display: true, text: "Áp suất (m)" },
          grid: { color: "rgba(15, 23, 42, 0.08)" },
          ticks: { color: "#0f766e" },
        },
        flow: {
          position: "right",
          title: { display: true, text: "Lưu lượng (m³/h)" },
          grid: { drawOnChartArea: false },
          ticks: { color: "#2563eb" },
        },
      }
      : {
        x: {
          grid: { color: "rgba(15, 23, 42, 0.06)" },
          ticks: { maxTicksLimit: 10, color: "#64748b" },
        },
        y: {
          title: { display: true, text: `${reportData?.metric?.label || selectedMetric.label} (${reportData?.metric?.unit || selectedMetric.unit})` },
          grid: { color: "rgba(15, 23, 42, 0.08)" },
          ticks: { color: "#475569" },
        },
      },
  };

  const renderStatCell = (item, key) => {
    if (!isCombinedReport) return formatNumber(item.stats?.[key]);
    return (
      <div className="space-y-1 leading-tight">
        <div><span className="font-bold text-teal-700">Áp:</span> {formatNumber(item.pressureStats?.[key])} m</div>
        <div><span className="font-bold text-blue-700">Lưu lượng:</span> {formatNumber(item.flowStats?.[key])} m³/h</div>
      </div>
    );
  };

  return (
    <div className="min-h-full bg-[#f4f7f2] p-4 text-slate-900 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-5">
          <div className="rounded-[24px] border border-white bg-white/90 p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_110px_150px_170px_130px_auto]">
              <label className="text-sm font-bold text-slate-600">
                Từ thời điểm
                <input
                  type="datetime-local"
                  value={fromDate}
                  disabled={pinLast24Hours}
                  onChange={(e) => handleFromDateChange(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <label className="text-sm font-bold text-slate-600">
                Đến thời điểm
                <input
                  type="datetime-local"
                  value={toDate}
                  disabled={pinLast24Hours}
                  onChange={(e) => handleToDateChange(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
                  onBlur={handleDurationHoursBlur}
                  onChange={(e) => handleDurationHoursChange(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </label>
              <label className="text-sm font-bold text-slate-600">
                Dữ liệu
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  {metricOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-600">
                Thời gian hiển thị
                <select
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                >
                  {intervalOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label
                className={`mt-6 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-sm font-black transition ${
                  pinLast24Hours
                    ? "border-teal-300 bg-teal-600 text-white shadow-sm"
                    : "border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-300 hover:bg-teal-100"
                }`}
                title="Ghim biểu đồ 24 giờ gần nhất tính từ hiện tại khi mở lại trang"
              >
                <input
                  type="checkbox"
                  checked={pinLast24Hours}
                  onChange={(e) => handleLast24HoursPinChange(e.target.checked)}
                  className="h-4 w-4 accent-teal-600"
                />
                <FaClock /> Ghim 24h
              </label>
              <div className="relative mt-6">
                <button
                  onClick={openExportPanel}
                  disabled={exportLoading}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaDownload /> {exportLoading ? "Đang xuất..." : "Xuất báo cáo"}
                </button>
                {isExportPanelOpen && (
                  <div className="absolute right-0 top-12 z-30 w-80 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-2xl">
                    <label className="block text-sm font-bold text-slate-600">
                      Tên báo cáo
                      <input
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                        placeholder="Nhập tên báo cáo"
                        className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-slate-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      />
                    </label>

                    <div className="mt-3 flex h-11 items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={exportExcelSelected}
                          onChange={(e) => {
                            setExportExcelSelected(e.target.checked);
                            if (!e.target.checked) setExportDnpSelected(false);
                          }}
                          className="h-4 w-4 accent-blue-600"
                        />
                        Excel
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={exportCsvSelected}
                          onChange={(e) => setExportCsvSelected(e.target.checked)}
                          className="h-4 w-4 accent-amber-500"
                        />
                        CSV
                      </label>
                      <label className={`flex items-center gap-2 ${exportExcelSelected ? "" : "opacity-50"}`}>
                        <input
                          type="checkbox"
                          checked={exportDnpSelected}
                          disabled={!exportExcelSelected}
                          onChange={(e) => setExportDnpSelected(e.target.checked)}
                          className="h-4 w-4 accent-teal-600"
                        />
                        Sheet DNP
                      </label>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                      <button
                        onClick={() => setIsExportPanelOpen(false)}
                        className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-600 hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={exportReport}
                        disabled={exportLoading || (!exportExcelSelected && !exportCsvSelected)}
                        className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {exportLoading ? "Đang xuất..." : "Xuất"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {loading && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-teal-50 px-4 py-2 text-sm font-bold text-teal-700">
                <FaSyncAlt className="animate-spin" /> Đang tự tải biểu đồ theo lựa chọn...
              </div>
            )}
            {errorMessage && (
              <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {errorMessage}
              </div>
            )}
          </div>

          {/* <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard label="Logger được chọn" value={activeLoggerIds.length} tone="blue" />
            <SummaryCard label="Điểm dữ liệu" value={dataPointCount} tone="teal" />
            <SummaryCard label="Không có dữ liệu" value={noDataCount} tone="rose" />
            <SummaryCard label="Tổng sản lượng" value={`${totalVolume.toFixed(2)} m³`} tone="amber" />
          </div> */}

          <div className="rounded-[28px] border border-white bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">Biểu đồ báo cáo</h2>
              </div>
              <button
                onClick={analyzeReportWithAi}
                disabled={aiLoading || !reportData?.labels?.length || !reportSeries.length || aiUsage?.remaining === 0}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaRobot /> {aiLoading ? "AI đang phân tích..." : "Phân tích AI"}
              </button>
            </div>
            {aiUsage && (
              <div className="-mt-2 mb-3 text-right text-xs font-bold text-slate-500">
                Còn {aiUsage.remaining}/{aiUsage.limit} lượt AI hôm nay
              </div>
            )}

            <div className="h-[430px] rounded-[22px] bg-gradient-to-b from-slate-50 to-white p-3">
              {reportData?.labels?.length ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <FaChartLine className="mb-4 text-5xl text-teal-200" />
                  <div className="text-lg font-black text-slate-600">Chưa có dữ liệu báo cáo</div>
                  <div className="mt-1 max-w-md text-sm">Chọn logger hoặc DMA, biểu đồ sẽ tự hiển thị khi có dữ liệu.</div>
                </div>
              )}
            </div>

            {(aiAnalysis || aiError || aiLoading) && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-black text-slate-800">
                  <FaRobot className="text-teal-600" />
                  Phân tích AI
                </div>
                {aiLoading && (
                  <div className="text-sm font-semibold text-slate-500">AI đang đọc dữ liệu biểu đồ và tạo nhận xét...</div>
                )}
                {aiError && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                    {aiError}
                  </div>
                )}
                {aiAnalysis && (
                  <div className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-700">
                    {aiAnalysis}
                  </div>
                )}
              </div>
            )}
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
                    <th className="px-4 py-3">Nhóm</th>
                    <th className="px-4 py-3">Min</th>
                    <th className="px-4 py-3">Avg</th>
                    <th className="px-4 py-3">Max</th>
                    <th className="px-4 py-3">Sản lượng</th>
                    <th className="px-4 py-3">Điểm</th>
                  </tr>
                </thead>
                <tbody>
                  {reportSeries.length ? reportSeries.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-bold text-slate-900">{item.id} - {item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.group}</td>
                      <td className="px-4 py-3">{renderStatCell(item, "min")}</td>
                      <td className="px-4 py-3">{renderStatCell(item, "avg")}</td>
                      <td className="px-4 py-3">{renderStatCell(item, "max")}</td>
                      <td className="px-4 py-3">{Number(item.stats?.volume || 0).toFixed(2)} m³</td>
                      <td className="px-4 py-3">{item.stats?.count || 0}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Chưa có dữ liệu báo cáo</td>
                    </tr>
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
                onClick={() => {
                  setSelectedLoggerIds([]);
                  setSelectedDmaIds([]);
                  setReportData(null);
                }}
                className="text-xs font-bold text-rose-500 hover:text-rose-700"
              >
                Bỏ chọn
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 rounded-2xl bg-slate-100 p-1 text-xs font-black">
              <button
                onClick={() => setSourceTab("logger")}
                className={`rounded-xl px-2 py-2 ${sourceMode === "logger" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}
              >
                Logger
              </button>
              <button
                onClick={() => setSourceTab("dma")}
                className={`rounded-xl px-2 py-2 ${sourceMode === "dma" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}
              >
                DMA
              </button>
            </div>

            {sourceMode === "logger" ? (
              <>
                <div className="mb-3 grid gap-2">
                  <div className="relative">
                    <FaSearch className="absolute left-3 top-3 text-slate-400" />
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
                </div>
                <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
                  {filteredSensors.map((sensor) => {
                    const id = Number(sensor.id);
                    const checked = selectedLoggerIds.includes(id);
                    return (
                      <button
                        key={id}
                        onClick={() => toggleLogger(id)}
                        className={`w-full rounded-2xl border p-3 text-left transition ${checked ? "border-teal-400 bg-teal-50" : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"}`}
                      >
                        <div className="flex items-start gap-3">
                          <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-teal-600 bg-teal-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>
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
              </>
            ) : (
              <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {dmas.length ? dmas.map((dma) => {
                  const checked = selectedDmaIds.includes(dma._id);
                  const ids = getDmaLoggerIds(dma, dmas);
                  return (
                    <button
                      key={dma._id}
                      onClick={() => toggleDma(dma._id)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${checked ? "border-cyan-400 bg-cyan-50" : "border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50"}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${checked ? "border-cyan-600 bg-cyan-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>
                          <FaCheck className="text-xs" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-black text-slate-900">{dma.name}</span>
                          <span className="mt-1 block text-xs font-semibold text-slate-500">{ids.length} logger trong DMA/cây con</span>
                          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-1 text-xs font-bold text-cyan-700">
                            <FaTint /> {dma.group || "Chưa gán nhóm"}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                }) : (
                  <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                    Chưa có bộ DMA nào để chọn.
                  </div>
                )}
              </div>
            )}
          </div>

        </aside>
      </div>
    </div>
  );
};

export default Report;
