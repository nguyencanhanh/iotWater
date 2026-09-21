import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  FaDownload,
  FaLayerGroup,
  FaRobot,
  FaSearch,
  FaSyncAlt,
  FaTint,
} from "react-icons/fa";
import { dmaListGet, exportDailyReportPost, sensorReportAiAnalysisPost, sensorReportAiAnalysisStream, sensorReportPost } from "../api";
import AiReportDocument from "../components/ai/AiReportDocument";
import { useAuth } from "../context/authContext";

ChartJS.register(CategoryScale, Decimation, LinearScale, PointElement, LineElement, Tooltip, Legend);

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

const formatSelectedDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const time = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const day = date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }).replace("/", "-");
  return `${time} ${day}`;
};

const isWholeHourLabel = (label) => {
  const match = String(label || "").match(/(?:^|\D)(\d{1,2}):(\d{2})(?:\D|$)/);
  return Boolean(match) && Number(match[2]) === 0;
};

const onlyWholeHourTicks = (scale) => {
  const wholeHourTicks = scale.ticks.filter((tick) => isWholeHourLabel(scale.getLabelForValue(tick.value)));
  if (wholeHourTicks.length) scale.ticks = wholeHourTicks;
};

const getWholeHourIndexSet = (labels = []) => {
  const indexes = new Set();
  labels.forEach((label, index) => {
    if (isWholeHourLabel(label)) indexes.add(index);
  });
  return indexes;
};

const filterTicksByIndexSet = (scale, indexSet) => {
  const wholeHourTicks = scale.ticks.filter((tick) => indexSet.has(Number(tick.value)));
  if (wholeHourTicks.length) scale.ticks = wholeHourTicks;
};

const formatNumber = (value, digits = 2) => (
  Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—"
);

const formatChartValue = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const compactDatasetLabel = (label) => {
  const parts = String(label || "").split(" - ");
  return parts.length > 1 ? parts[parts.length - 1] : String(label || "");
};

const getChartPointX = (chart, index) => {
  if (!chart || index === null || index === undefined) return null;
  const pointFromDataset = chart.data.datasets
    .map((_dataset, datasetIndex) => chart.getDatasetMeta(datasetIndex))
    .find((meta) => chart.isDatasetVisible(meta.index) && meta.data?.[index])
    ?.data?.[index];
  if (Number.isFinite(pointFromDataset?.x)) return pointFromDataset.x;

  const xScale = chart.scales?.x;
  if (!xScale) return null;
  const xFromIndex = xScale.getPixelForValue(index);
  if (Number.isFinite(xFromIndex)) return xFromIndex;
  const xFromLabel = xScale.getPixelForValue(chart.data.labels?.[index]);
  return Number.isFinite(xFromLabel) ? xFromLabel : null;
};

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
  const chartRef = useRef(null);
  const selectedLineRef = useRef(null);
  const selectedIndexRef = useRef(null);
  const selectedLineFrameRef = useRef(null);
  const selectedStateFrameRef = useRef(null);
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
  const [selectedChartIndex, setSelectedChartIndex] = useState(null);

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
  const reportSeries = useMemo(() => reportData?.series || [], [reportData?.series]);
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

    const token = localStorage.getItem("token");
    const body = {
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
        user: currentUser,
      },
    };

    setAiLoading(true);
    setAiAnalysis("");

    try {
      // Stream de chu hien dan, khong bi nginx cat sau 60s.
      await sensorReportAiAnalysisStream(token, body, {
        onDelta: (_delta, full) => setAiAnalysis(full),
        onDone: (_full, done) => {
          if (done?.aiUsage) setAiUsage(done.aiUsage);
        },
      });
    } catch (streamError) {
      if (streamError?.status === 429) {
        setAiUsage(streamError.payload?.aiUsage || null);
        setAiError(streamError.payload?.error || streamError.message);
        setAiLoading(false);
        return;
      }

      // Server cu hoac proxy chan SSE thi quay ve endpoint thuong.
      try {
        const res = await sensorReportAiAnalysisPost(token, body);
        if (res.data.success) {
          setAiAnalysis(res.data.analysis || "");
          setAiUsage(res.data.aiUsage || null);
        } else {
          setAiError(res.data.error || "Không phân tích được báo cáo bằng AI");
        }
      } catch (error) {
        setAiUsage(error.response?.data?.aiUsage || null);
        setAiError(error.response?.data?.error || streamError.message || "Không phân tích được báo cáo bằng AI");
      }
    } finally {
      setAiLoading(false);
    }
  };

  const openExportPanel = () => {
    setErrorMessage("");
    setReportName((prev) => sanitizeFileName(prev, getDefaultReportName(fromDate, toDate)));
    setIsExportPanelOpen((prev) => !prev);
  };

  const chartLabels = useMemo(() => reportData?.labels?.map(formatDateTime) || [], [reportData?.labels]);
  const wholeHourIndexSet = useMemo(() => getWholeHourIndexSet(chartLabels), [chartLabels]);
  const filterWholeHourTicks = useCallback((scale) => {
    filterTicksByIndexSet(scale, wholeHourIndexSet);
  }, [wholeHourIndexSet]);
  const formatWholeHourTick = useCallback(function (value) {
    return wholeHourIndexSet.has(Number(value)) ? this.getLabelForValue(value) : "";
  }, [wholeHourIndexSet]);

  const chartData = useMemo(() => ({
    labels: chartLabels,
    datasets: isCombinedReport
      ? reportSeries.flatMap((item, index) => {
        const loggerColor = palette[index % palette.length];
        return [
          {
            label: `${item.id} ${item.name} - Áp suất`,
            data: (item.pressureValues || []).map(roundToTwo),
            borderColor: loggerColor,
            backgroundColor: `${loggerColor}22`,
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
            borderColor: loggerColor,
            backgroundColor: `${loggerColor}18`,
            borderWidth: 2.5,
            borderDash: [7, 5],
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
  }), [chartLabels, isCombinedReport, reportSeries]);

  const isFlowChart = (reportData?.metric?.key || selectedMetric.key) === "flow";
  const chartTitle = isCombinedReport ? "Lưu lượng và áp lực" : `Biểu đồ ${reportData?.metric?.label || selectedMetric.label}`;
  const chartLegendItems = useMemo(() => chartData.datasets.map((dataset) => ({
    label: dataset.label,
    displayLabel: isCombinedReport && reportSeries.length === 1
      ? `${compactDatasetLabel(dataset.label)}${dataset.unit ? ` (${dataset.unit})` : ""}`
      : dataset.label,
    color: dataset.borderColor || "#0f766e",
    dashed: Array.isArray(dataset.borderDash) && dataset.borderDash.length > 0,
    unit: dataset.unit || reportData?.metric?.unit || selectedMetric.unit,
  })), [chartData.datasets, isCombinedReport, reportData?.metric?.unit, reportSeries.length, selectedMetric.unit]);
  const selectedChartTitle = selectedChartIndex === null
    ? ""
    : formatSelectedDateTime(reportData?.labels?.[selectedChartIndex] || chartData.labels?.[selectedChartIndex]);
  const selectedChartValues = useMemo(() => selectedChartIndex === null
    ? []
    : chartData.datasets.map((dataset) => ({
      label: isCombinedReport && reportSeries.length === 1 ? compactDatasetLabel(dataset.label) : dataset.label,
      color: dataset.borderColor || "#0f766e",
      value: dataset.data?.[selectedChartIndex],
      unit: dataset.unit || reportData?.metric?.unit || selectedMetric.unit,
    })).filter((item) => item.value !== null && item.value !== undefined), [
      chartData.datasets,
      isCombinedReport,
      reportData?.metric?.unit,
      reportSeries.length,
      selectedChartIndex,
      selectedMetric.unit,
    ]);

  const syncSelectedLinePosition = useCallback((nextIndex = selectedIndexRef.current) => {
    const line = selectedLineRef.current;
    const chart = chartRef.current;
    if (!line) return;
    if (nextIndex === null || nextIndex === undefined || !chart?.chartArea) {
      line.style.display = "none";
      return;
    }

    const x = getChartPointX(chart, nextIndex);
    if (!Number.isFinite(x)) {
      line.style.display = "none";
      return;
    }

    line.style.display = "block";
    line.style.left = `${x}px`;
    line.style.top = `${chart.chartArea.top}px`;
    line.style.height = `${Math.max(chart.chartArea.bottom - chart.chartArea.top, 0)}px`;
  }, []);

  const moveSelectedLine = useCallback((nextIndex) => {
    if (nextIndex === null || nextIndex === undefined) return;
    selectedIndexRef.current = nextIndex;
    if (selectedLineFrameRef.current) return;
    selectedLineFrameRef.current = requestAnimationFrame(() => {
      selectedLineFrameRef.current = null;
      syncSelectedLinePosition(selectedIndexRef.current);
    });
  }, [syncSelectedLinePosition]);

  const commitSelectedIndex = useCallback((nextIndex) => {
    if (nextIndex === null || nextIndex === undefined) return;
    const indexChanged = selectedIndexRef.current !== nextIndex;
    moveSelectedLine(nextIndex);
    if (indexChanged && !selectedStateFrameRef.current) {
      selectedStateFrameRef.current = requestAnimationFrame(() => {
        selectedStateFrameRef.current = null;
        setSelectedChartIndex((current) => (
          current === selectedIndexRef.current ? current : selectedIndexRef.current
        ));
      });
    }
  }, [moveSelectedLine]);

  useEffect(() => () => {
    if (selectedLineFrameRef.current) cancelAnimationFrame(selectedLineFrameRef.current);
    if (selectedStateFrameRef.current) cancelAnimationFrame(selectedStateFrameRef.current);
  }, []);

  useEffect(() => {
    const nextLength = chartData.labels.length;
    setSelectedChartIndex((prev) => {
      if (!nextLength) {
        selectedIndexRef.current = null;
        syncSelectedLinePosition(null);
        return null;
      }
      const nextIndex = prev !== null && prev >= 0 && prev < nextLength ? prev : nextLength - 1;
      selectedIndexRef.current = nextIndex;
      requestAnimationFrame(() => syncSelectedLinePosition(nextIndex));
      return nextIndex;
    });
  }, [reportData?.labels?.length, activeLoggerKey, metric, intervalMinutes, sourceMode, syncSelectedLinePosition]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => syncSelectedLinePosition());
    const handleResize = () => syncSelectedLinePosition();
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [selectedChartIndex, chartData.labels.length, chartData.datasets.length, activeLoggerKey, metric, intervalMinutes, sourceMode, syncSelectedLinePosition]);

  const chartPlugins = useMemo(() => [], []);

  const selectChartIndexFromEvent = useCallback((event) => {
    const chart = chartRef.current;
    if (!chart?.chartArea || !chart.scales?.x || !chartData.labels.length) return;
    const sourceEvent = event?.nativeEvent || event?.native || event;
    const clientX = sourceEvent?.touches?.[0]?.clientX
      ?? sourceEvent?.changedTouches?.[0]?.clientX
      ?? sourceEvent?.clientX;
    const canvasRect = chart.canvas.getBoundingClientRect();
    const chartArea = chart.chartArea;
    const x = Number.isFinite(clientX)
      ? clientX - canvasRect.left
      : sourceEvent?.x;
    if (!Number.isFinite(x)) return;
    const boundedX = Math.min(Math.max(x, chartArea.left), chartArea.right);
    const nextPoint = chartData.labels.reduce(
      (closest, _label, index) => {
        const pointX = getChartPointX(chart, index);
        if (!Number.isFinite(pointX)) return closest;
        const distance = Math.abs(pointX - boundedX);
        return distance < closest.distance ? { index, distance } : closest;
      },
      { index: null, distance: Infinity }
    );
    if (nextPoint.index === null) return;
    commitSelectedIndex(nextPoint.index);
  }, [chartData.labels, commitSelectedIndex]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        borderColor: "rgba(226, 232, 240, 0.35)",
        borderWidth: 1,
        boxPadding: 6,
        cornerRadius: 12,
        padding: 12,
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y ?? "—"} ${ctx.dataset.unit || reportData?.metric?.unit || selectedMetric.unit}`,
        },
      },
      decimation: {
        enabled: chartData.labels.length > 1200,
        algorithm: "lttb",
        samples: 700,
      },
    },
    onHover: (event, elements) => {
      if (elements?.length) {
        commitSelectedIndex(elements[0].index);
      }
    },
    onClick: (event) => {
      selectChartIndexFromEvent(event);
    },
    scales: isCombinedReport
      ? {
        x: {
          border: { display: false },
          grid: { color: "#e9eef5", drawTicks: false },
          afterBuildTicks: filterWholeHourTicks,
          ticks: {
            maxTicksLimit: 6,
            color: "#94a3b8",
            font: { weight: "700" },
            callback: formatWholeHourTick,
          },
        },
        pressure: {
          position: "left",
          border: { display: false },
          title: { display: false },
          grid: { color: "#e9eef5", drawTicks: false },
          ticks: { color: "#64748b", font: { weight: "800" } },
        },
        flow: {
          position: "right",
          min: 0,
          border: { display: false },
          title: { display: false },
          grid: { drawOnChartArea: false },
          ticks: { color: "#64748b", font: { weight: "800" } },
        },
      }
      : {
        x: {
          border: { display: false },
          grid: { color: "#e9eef5", drawTicks: false },
          afterBuildTicks: filterWholeHourTicks,
          ticks: {
            maxTicksLimit: 6,
            color: "#94a3b8",
            font: { weight: "700" },
            callback: formatWholeHourTick,
          },
        },
        y: {
          min: isFlowChart ? 0 : undefined,
          border: { display: false },
          title: { display: false },
          grid: { color: "#e9eef5", drawTicks: false },
          ticks: { color: "#64748b", font: { weight: "800" } },
        },
      },
  }), [
    chartData.labels.length,
    commitSelectedIndex,
    filterWholeHourTicks,
    formatWholeHourTick,
    isCombinedReport,
    isFlowChart,
    reportData?.metric?.unit,
    selectChartIndexFromEvent,
    selectedMetric.unit,
  ]);

  const renderStatCell = (item, key) => {
    if (!isCombinedReport) return formatNumber(item.stats?.[key]);
    return (
      <div className="space-y-1 leading-tight">
        <div><span className="font-bold text-teal-700">Áp:</span> {formatNumber(item.pressureStats?.[key])} m</div>
        <div><span className="font-bold text-blue-700">Lưu lượng:</span> {formatNumber(item.flowStats?.[key])} m³/h</div>
      </div>
    );
  };

  const renderMeterSumAtToDate = (item) => {
    const value = item.stats?.meterSumAtToDate ?? item.stats?.lastSum;
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toFixed(2)} m³` : "—";
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

          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{chartTitle}</h2>
                  <div className="mt-1 text-sm font-semibold text-slate-500">
                    {reportData?.labels?.length ? `${reportData.labels.length} mốc dữ liệu · ${reportSeries.length} logger` : "Chưa có dữ liệu biểu đồ"}
                  </div>
                </div>
                <button
                  onClick={analyzeReportWithAi}
                  disabled={aiLoading || !reportData?.labels?.length || !reportSeries.length || aiUsage?.remaining === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FaRobot /> {aiLoading ? "AI đang phân tích..." : "Phân tích AI"}
                </button>
              </div>

              {chartLegendItems.length > 0 && (
                <div className="flex max-h-20 flex-wrap gap-x-5 gap-y-2 overflow-y-auto">
                  {chartLegendItems.map((item, index) => (
                    <div
                      key={`${item.label}-${index}`}
                      className="inline-flex min-w-0 items-center gap-2 text-sm font-extrabold text-slate-500"
                      title={`${item.label} ${item.unit ? `(${item.unit})` : ""}`}
                    >
                      <span
                        className="h-0 w-8 shrink-0 border-t-[3px]"
                        style={{
                          borderColor: item.color,
                          borderStyle: item.dashed ? "dashed" : "solid",
                        }}
                      />
                      <span className="max-w-[260px] truncate">{item.displayLabel}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {aiUsage && (
              <div className="-mt-2 mb-3 text-right text-xs font-bold text-slate-500">
                Còn {aiUsage.remaining}/{aiUsage.limit} lượt AI hôm nay
              </div>
            )}

            <div className="rounded-[24px] border border-slate-200 bg-white p-3 shadow-inner">
              <div
                className="relative h-[430px] cursor-crosshair overflow-hidden rounded-[18px] bg-white p-1"
                onClick={selectChartIndexFromEvent}
              >
              {reportData?.labels?.length ? (
                <>
                  <Line ref={chartRef} data={chartData} options={chartOptions} plugins={chartPlugins} />
                  <div
                    ref={selectedLineRef}
                    className="pointer-events-none absolute z-20 hidden w-0 -translate-x-1/2 border-l-2 border-dashed border-slate-900/90"
                  />
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                  <FaChartLine className="mb-4 text-5xl text-teal-200" />
                  <div className="text-lg font-black text-slate-600">Chưa có dữ liệu báo cáo</div>
                  <div className="mt-1 max-w-md text-sm">Chọn logger hoặc DMA, biểu đồ sẽ tự hiển thị khi có dữ liệu.</div>
                </div>
              )}
              </div>
            </div>

            {selectedChartValues.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="mb-3 text-base font-black text-slate-700">
                  {selectedChartTitle || `Điểm ${selectedChartIndex + 1}`}
                </div>
                <div className="space-y-2">
                  {selectedChartValues.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex min-w-0 items-center justify-between gap-3 text-sm font-black">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="truncate" style={{ color: item.color }}>{item.label}:</span>
                      </div>
                      <span className="shrink-0" style={{ color: item.color }}>
                        {formatChartValue(item.value)} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(aiAnalysis || aiError || aiLoading) && (
              <section className="mt-5">
                {aiLoading && !aiAnalysis && (
                  <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm font-bold text-teal-700">
                    AI đang đọc dữ liệu biểu đồ và tạo nhận xét...
                  </div>
                )}
                {aiError && (
                  <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {aiError}
                  </div>
                )}
                {aiAnalysis && (
                  <AiReportDocument
                    content={aiAnalysis}
                    badge="Báo cáo phân tích AI"
                    fallbackTitle="Báo cáo phân tích áp lực – lưu lượng tại điểm đo"
                    highlightLabel="Tổng sản lượng trong kỳ"
                    streaming={aiLoading}
                  />
                )}
              </section>
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
                    <th className="px-4 py-3">Số tổng ĐH</th>
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
                      <td className="px-4 py-3">{renderMeterSumAtToDate(item)}</td>
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
