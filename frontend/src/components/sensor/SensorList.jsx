import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from '../../context/authContext'
// import { Link } from "react-router-dom";
import { Battery, battery } from "../chart/Chart";
import RealTimeLineChart, { addDataSensor, TimeComparison } from "../chart/Chart";
import ModalData from "../chart/Modal";
import { sensorListGet, getSensorInGroup, intervalUpdatePut, sensorProductionPost } from "../../api/index"
import SettingsButton from "../setting/Setting";
import ScrollableTable from "../chart/Table";
import EditComponent from "./EditComponent";
import { useLocation, useParams } from "react-router-dom";
import { produce } from "immer";
import { Chart } from "react-chartjs-2";
import { BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineController, LineElement, PointElement } from "chart.js";
import { Chart as ChartJS } from "chart.js";

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineController, LineElement, PointElement);

export let changeData

export const overviewMetricOptions = [
  { key: "pressureMax", label: "Áp suất cao nhất" },
  { key: "pressureMin", label: "Áp suất thấp nhất" },
  { key: "pressureAvg", label: "Áp suất trung bình" },
  { key: "flowMax", label: "Lưu lượng cao nhất" },
  { key: "flowMin", label: "Lưu lượng thấp nhất" },
  { key: "flowAvg", label: "Lưu lượng trung bình" },
  { key: "flowTotal", label: "Sản lượng ngày" },
  { key: "flowTotal24", label: "Sản lượng 24h" },
  { key: "flowMeter", label: "Chỉ số đồng hồ" },
  { key: "reverseTotal", label: "M³ chảy nghịch" },
  { key: "productionMonth", label: "Sản lượng tháng" },
  { key: "productionYear", label: "Sản lượng năm" },
];

export const detailTableColumnOptions = [
  { key: "time", label: "Thời gian" },
  { key: "pressure", label: "Áp suất" },
  { key: "pressureCompare", label: "Áp suất cùng kì" },
  { key: "flow", label: "Lưu lượng" },
  { key: "flowCompare", label: "Lưu lượng cùng kì" },
  { key: "battery", label: "Pin" },
];

export const defaultOverviewMetrics = overviewMetricOptions.map((item) => item.key);
export const defaultDetailTableColumns = detailTableColumnOptions.map((item) => item.key);

const detailDisplayIntervalOptions = [
  { value: 1, label: "1 phút" },
  { value: 5, label: "5 phút" },
  { value: 10, label: "10 phút" },
  { value: 15, label: "15 phút" },
  { value: 30, label: "30 phút" },
  { value: 60, label: "1 giờ" },
];

const normalizeDisplayIntervalValue = (value) => {
  const number = Number(value);
  return detailDisplayIntervalOptions.some((option) => option.value === number) ? number : 1;
};

const averageByIndexes = (values = [], indexes = []) => {
  const numbers = indexes
    .map((index) => values?.[index])
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
};

const lastDefinedByIndexes = (values = [], indexes = []) => {
  for (let i = indexes.length - 1; i >= 0; i -= 1) {
    const value = values?.[indexes[i]];
    if (value !== null && value !== undefined) return value;
  }
  return null;
};

const getSourceMinutesFromWatch = (watch) => {
  const minutesFromWatch = Number(watch || 0) / 60;
  return Number.isFinite(minutesFromWatch) && minutesFromWatch > 0 ? minutesFromWatch : 1;
};

const buildDisplayBuckets = (labels = [], watch, intervalValue) => {
  const indexes = labels.map((_label, index) => index);
  if (!labels.length) {
    return indexes.map((index) => ({ label: labels[index], indexes: [index] }));
  }

  const displayMinutes = Number(intervalValue);
  const sourceMinutes = getSourceMinutesFromWatch(watch);
  if (!Number.isFinite(displayMinutes) || displayMinutes <= 0) {
    return indexes.map((index) => ({ label: labels[index], indexes: [index] }));
  }

  const buckets = [];
  indexes.forEach((index) => {
    const bucketIndex = Math.floor((index * sourceMinutes) / displayMinutes);
    if (!buckets[bucketIndex]) {
      buckets[bucketIndex] = {
        label: labels[index],
        indexes: [],
      };
    }
    buckets[bucketIndex].indexes.push(index);
  });

  return buckets.filter(Boolean);
};

const buildDetailDisplayData = (sensorData, labels, watch, intervalValue) => {
  const buckets = buildDisplayBuckets(labels, watch, intervalValue);
  const sourceRows = sensorData?.sensorT || [];
  const aggregateSeries = (values) => buckets.map((bucket) => averageByIndexes(values, bucket.indexes));
  const rows = buckets.map((bucket) => {
    const row = lastDefinedByIndexes(sourceRows, bucket.indexes);
    const pressure = averageByIndexes(sensorData?.dataPressure, bucket.indexes);
    const flow = averageByIndexes(sensorData?.dataFlow, bucket.indexes);
    const battery = lastDefinedByIndexes(
      bucket.indexes.map((index) => sourceRows?.[index]?.battery),
      bucket.indexes.map((_index, position) => position)
    );

    if (!row && pressure === null && flow === null && battery === null) return null;

    return {
      ...(row || {}),
      Pressure: pressure ?? row?.Pressure,
      flow: flow ?? row?.flow,
      battery: battery ?? row?.battery,
    };
  });

  return {
    labels: buckets.map((bucket) => bucket.label),
    indexes: buckets.map((_bucket, index) => index),
    rows,
    data: {
      ...sensorData,
      dataPressure: aggregateSeries(sensorData?.dataPressure),
      sensorYRest: aggregateSeries(sensorData?.sensorYRest),
      dataFlow: aggregateSeries(sensorData?.dataFlow),
      flowYRest: aggregateSeries(sensorData?.flowYRest),
      sensorT: rows,
    },
  };
};

const formatMetricNumber = (value, digits = 2) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : "—";
};

const getDeltaValue = (current, previous) => {
  const currentNumber = Number(current);
  const previousNumber = Number(previous);
  if (!Number.isFinite(currentNumber) || !Number.isFinite(previousNumber)) return null;
  return currentNumber - previousNumber;
};

const getDeltaPercent = (current, previous) => {
  const delta = getDeltaValue(current, previous);
  const previousNumber = Number(previous);
  if (!Number.isFinite(delta) || !Number.isFinite(previousNumber) || previousNumber === 0) return null;
  return (delta / previousNumber) * 100;
};

const DeltaBadge = ({ value, percent }) => {
  if (!Number.isFinite(Number(percent))) return null;
  const number = Number(value);
  const percentNumber = Number(percent);
  const toneClass = number > 0
    ? "bg-green-50 text-green-700"
    : number < 0
      ? "bg-red-50 text-red-700"
      : "bg-gray-100 text-gray-600";
  const percentSign = percentNumber > 0 ? "+" : "";

  return (
    <div className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${toneClass}`}>
      {percentSign}{percentNumber.toFixed(2)}%
    </div>
  );
};

// ─── MetricCard: Tối giản, thanh lịch ──────────────────────────
const MetricCard = ({ label, value, unit, borderClass, delta, deltaPercent }) => (
  <div className={`flex-1 rounded-xl border border-gray-200/80 border-t-4 bg-white p-3 shadow-sm ${borderClass}`}>
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className="text-lg font-extrabold leading-tight text-gray-900">{value ?? '—'}</span>
      <span className="ml-0.5 text-[11px] font-semibold text-gray-400">{unit}</span>
    </div>
    <DeltaBadge value={delta} percent={deltaPercent} />
  </div>
);

const createRainPattern = () => {
  if (typeof document === "undefined") return "rgba(13, 148, 136, 0.72)";
  const canvas = document.createElement("canvas");
  canvas.width = 10;
  canvas.height = 10;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(13, 148, 136, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(10, 0);
  ctx.stroke();
  return ctx.createPattern(canvas, "repeat");
};

const SensorOverview = ({ pram, pramFlow, sensorData, watch, visibleMetrics = defaultOverviewMetrics, sensorId, userId, lat, lng }) => {
  const [production, setProduction] = useState({
    dayTotal: null,
    previousDayTotal: null,
    total24: null,
    previous24Total: null,
    monthTotal: 0,
    previousMonthTotal: null,
    yearTotal: 0,
    previousYearTotal: null,
    chartData: [],
  });
  const [weatherByDate, setWeatherByDate] = useState({});
  const [weatherError, setWeatherError] = useState("");
  const [productionLoading, setProductionLoading] = useState(false);
  const [chartStartHour, setChartStartHour] = useState("00:00");
  const [chartEndHour, setChartEndHour] = useState("23:59");
  const [chartDays, setChartDays] = useState(7);
  const sumFlow = formatMetricNumber(pramFlow?.sum);
  const total = production.dayTotal ?? pramFlow?.total;
  const total24 = production.total24 ?? pramFlow?.total24;
  const reverseFlowValues = (sensorData?.dataFlow || []).filter((flow) => typeof flow === "number" && flow < 0);
  const reverseTotal = reverseFlowValues.reduce((sum, flow) => sum + Math.abs(flow) * ((watch || 0) / 3600), 0);
  const isVisible = (key) => visibleMetrics.includes(key);

  const fetchWeather = async (chartData) => {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !chartData?.length) {
      setWeatherByDate({});
      setWeatherError("Chưa có tọa độ logger để lấy thời tiết");
      return;
    }

    const startDate = chartData[0].date;
    const endDate = chartData[chartData.length - 1].date;
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      start_date: startDate,
      end_date: endDate,
      hourly: "temperature_2m,precipitation",
      timezone: "Asia/Bangkok",
      precipitation_unit: "mm",
    });

    try {
      const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${params.toString()}`);
      if (!res.ok) throw new Error("weather request failed");
      const json = await res.json();
      const times = json?.hourly?.time || [];
      const temperatures = json?.hourly?.temperature_2m || [];
      const precipitation = json?.hourly?.precipitation || [];
      const startParts = chartStartHour.split(":").map(Number);
      const endParts = chartEndHour.split(":").map(Number);
      const startMinute = (startParts[0] || 0) * 60 + (startParts[1] || 0);
      const endMinute = (endParts[0] || 0) * 60 + (endParts[1] || 0);
      const nextWeather = {};

      times.forEach((time, index) => {
        const [datePart, timePart] = time.split("T");
        const [hour, minute] = timePart.split(":").map(Number);
        const minuteOfDay = hour * 60 + minute;
        const inWindow = startMinute <= endMinute
          ? minuteOfDay >= startMinute && minuteOfDay <= endMinute
          : minuteOfDay >= startMinute || minuteOfDay <= endMinute;
        if (!inWindow) return;
        if (!nextWeather[datePart]) nextWeather[datePart] = { temperatureSum: 0, temperatureCount: 0, hasRain: false };
        const temperature = Number(temperatures[index]);
        if (Number.isFinite(temperature)) {
          nextWeather[datePart].temperatureSum += temperature;
          nextWeather[datePart].temperatureCount += 1;
        }
        if (Number(precipitation[index] || 0) > 0) nextWeather[datePart].hasRain = true;
      });

      setWeatherByDate(
        Object.fromEntries(
          Object.entries(nextWeather).map(([date, value]) => [
            date,
            {
              avgTemperature: value.temperatureCount ? value.temperatureSum / value.temperatureCount : null,
              hasRain: value.hasRain,
            },
          ])
        )
      );
      setWeatherError("");
    } catch (error) {
      console.error(error);
      setWeatherByDate({});
      setWeatherError("Không lấy được dữ liệu thời tiết");
    }
  };

  const fetchProduction = async () => {
    if (!sensorId && sensorId !== 0) return;
    setProductionLoading(true);
    try {
      const res = await sensorProductionPost(localStorage.getItem("token"), {
        id: sensorId,
        user: userId,
        startHour: chartStartHour,
        endHour: chartEndHour,
        days: chartDays,
      });
      if (res.data.success) {
        const chartData = res.data.chartData || [];
        setProduction({
          dayTotal: res.data.dayTotal,
          previousDayTotal: res.data.previousDayTotal,
          total24: res.data.total24,
          previous24Total: res.data.previous24Total,
          monthTotal: res.data.monthTotal || 0,
          previousMonthTotal: res.data.previousMonthTotal,
          yearTotal: res.data.yearTotal || 0,
          previousYearTotal: res.data.previousYearTotal,
          chartData,
        });
        fetchWeather(chartData);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setProductionLoading(false);
    }
  };

  useEffect(() => {
    fetchProduction();
  }, [sensorId, userId]);

  const pressureCards = [
    { key: "pressureMax", label: "Cao nhất", value: formatMetricNumber(pram?.max), unit: "m", borderClass: "border-t-blue-500" },
    { key: "pressureMin", label: "Thấp nhất", value: formatMetricNumber(pram?.min), unit: "m", borderClass: "border-t-blue-500" },
    { key: "pressureAvg", label: "Trung bình", value: formatMetricNumber(pram?.avg), unit: "m", borderClass: "border-t-blue-500" },
  ].filter((card) => isVisible(card.key));
  const flowRateCards = [
    { key: "flowMax", label: "Cao nhất", value: formatMetricNumber(pramFlow?.max), unit: "m³/h", borderClass: "border-t-teal-500" },
    { key: "flowMin", label: "Thấp nhất", value: formatMetricNumber(pramFlow?.min), unit: "m³/h", borderClass: "border-t-teal-500" },
    { key: "flowAvg", label: "Trung bình", value: formatMetricNumber(pramFlow?.avg), unit: "m³/h", borderClass: "border-t-teal-500" },
  ].filter((card) => isVisible(card.key));
  const flowTotalCards = [
    { key: "flowTotal", label: "Sản lượng ngày", value: formatMetricNumber(total), unit: "m³", borderClass: "border-t-teal-600", delta: getDeltaValue(total, production.previousDayTotal), deltaPercent: getDeltaPercent(total, production.previousDayTotal) },
    { key: "flowTotal24", label: "Sản lượng 24h", value: formatMetricNumber(total24), unit: "m³", borderClass: "border-t-teal-600", delta: getDeltaValue(total24, production.previous24Total), deltaPercent: getDeltaPercent(total24, production.previous24Total) },
    { key: "flowMeter", label: "Chỉ số đồng hồ", value: sumFlow, unit: "m³", borderClass: "border-t-teal-600" },
    { key: "reverseTotal", label: "M³ nghịch", value: reverseTotal.toFixed(2), unit: "m³", borderClass: "border-t-red-500" },
    { key: "productionMonth", label: "Sản lượng tháng", value: formatMetricNumber(production.monthTotal), unit: "m³", borderClass: "border-t-amber-500", delta: getDeltaValue(production.monthTotal, production.previousMonthTotal), deltaPercent: getDeltaPercent(production.monthTotal, production.previousMonthTotal) },
    { key: "productionYear", label: "Sản lượng năm", value: formatMetricNumber(production.yearTotal), unit: "m³", borderClass: "border-t-amber-600", delta: getDeltaValue(production.yearTotal, production.previousYearTotal), deltaPercent: getDeltaPercent(production.yearTotal, production.previousYearTotal) },
  ].filter((card) => isVisible(card.key));
  const rainPattern = createRainPattern();
  const chartConfig = {
    labels: production.chartData.map((item) => item.date),
    datasets: [
      {
        type: "bar",
        label: "Sản lượng",
        data: production.chartData.map((item) => Number(Number(item.volume || 0).toFixed(2))),
        backgroundColor: production.chartData.map((item) => weatherByDate[item.date]?.hasRain ? rainPattern : "rgba(13, 148, 136, 0.72)"),
        borderColor: "rgb(15, 118, 110)",
        borderWidth: 1,
        borderRadius: 6,
        yAxisID: "y",
      },
      {
        type: "line",
        label: "Nhiệt độ",
        data: production.chartData.map((item) => {
          const value = weatherByDate[item.date]?.avgTemperature;
          return Number.isFinite(value) ? Number(value.toFixed(1)) : null;
        }),
        borderColor: "rgb(234, 88, 12)",
        backgroundColor: "rgba(234, 88, 12, 0.15)",
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.25,
        yAxisID: "temperature",
        spanGaps: true,
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const date = production.chartData[ctx.dataIndex]?.date;
            const weather = weatherByDate[date];
            const temperature = Number.isFinite(weather?.avgTemperature) ? `${weather.avgTemperature.toFixed(1)}°C` : "không có nhiệt độ";
            const rain = weather ? (weather.hasRain ? "có mưa" : "không mưa") : "không có dữ liệu mưa";
            if (ctx.dataset.yAxisID === "temperature") {
              return `Nhiệt độ: ${ctx.parsed.y}°C`;
            }
            return [`Sản lượng: ${ctx.parsed.y} m³`, `Thời tiết: ${temperature}, ${rain}`];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "m³" },
      },
      temperature: {
        position: "right",
        grid: { drawOnChartArea: false },
        title: { display: true, text: "°C" },
      },
    },
  };

  return (
    <div className="mt-3 w-full space-y-3">
      {/* Khung Áp Suất */}
      {pressureCards.length > 0 && <div className="rounded-xl border border-gray-200/60 bg-gray-50 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-gray-200/50 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-blue-500"></div>
            <span className="text-sm font-bold text-gray-700">Áp suất hôm nay</span>
          </div>
          <span className="rounded bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-600">m</span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {pressureCards.map((card) => <MetricCard key={card.key} {...card} />)}
        </div>
      </div>}

      {/* Khung Lưu Lượng */}
      {(flowRateCards.length > 0 || flowTotalCards.length > 0) && <div className="rounded-xl border border-gray-200/60 bg-gray-50 p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-gray-200/50 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-teal-500"></div>
            <span className="text-sm font-bold text-gray-700">Lưu lượng hôm nay</span>
          </div>
          <span className="rounded bg-teal-50 px-2 py-1 text-[11px] font-bold text-teal-600">m³ - m³/h</span>
        </div>
        {flowRateCards.length > 0 && <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {flowRateCards.map((card) => <MetricCard key={card.key} {...card} />)}
        </div>}
        {flowTotalCards.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-200/40 pt-3 sm:grid-cols-4">
          {flowTotalCards.map((card) => <MetricCard key={card.key} {...card} />)}
        </div>}
      </div>}

      <div className="rounded-xl border border-gray-200/60 bg-gray-50 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/50 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-amber-500"></div>
            <span className="text-sm font-bold text-gray-700">Biểu đồ sản lượng theo khung giờ</span>
          </div>
          <button
            type="button"
            onClick={fetchProduction}
            disabled={productionLoading}
            className="rounded bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:bg-gray-400"
          >
            {productionLoading ? "Đang tải..." : "Cập nhật"}
          </button>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_8rem]">
          <label className="text-xs font-bold text-gray-600">
            Từ giờ
            <input
              type="time"
              value={chartStartHour}
              onChange={(e) => setChartStartHour(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-gray-600">
            Đến giờ
            <input
              type="time"
              value={chartEndHour}
              onChange={(e) => setChartEndHour(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-gray-600">
            Số ngày
            <input
              type="number"
              min="1"
              max="90"
              value={chartDays}
              onChange={(e) => setChartDays(e.target.value)}
              className="mt-1 min-h-10 w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
            />
          </label>
        </div>
        <div className="h-72 rounded-lg bg-white p-3">
          <Chart type="bar" data={chartConfig} options={chartOptions} />
        </div>
        {weatherError && <div className="mt-2 text-xs text-gray-500">{weatherError}</div>}
      </div>
    </div>
  );
};

function generateLabelsAndData(watch, viewMode = 'today') {
  const labels = [];
  let startMinuteOffset = 0;
  if (viewMode === 'past24h') {
    const now = new Date();
    const minutes = now.getMinutes();
    const intervalMinutes = Math.floor(watch / 60);
    const roundedMinutes = Math.round(minutes / intervalMinutes) * intervalMinutes;
    const startDate = new Date();
    startDate.setHours(now.getHours(), roundedMinutes, 0, 0);
    
    const startHour = startDate.getHours();
    const startMin = startDate.getMinutes();
    startMinuteOffset = startHour * 60 + startMin;
  }

  for (let i = 0; i < 1440; i += watch / 60) {
    const totalMinutes = (i + startMinuteOffset) % 1440;
    const hour = Math.floor(totalMinutes / 60);
    const minute = Math.floor(totalMinutes % 60);
    labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return labels;
};

function generateLabelsByLength(watch, length, viewMode = 'today') {
  const total = Math.max(Number(length || 0), 0);
  if (!total) return [];

  const intervalMinutes = getSourceMinutesFromWatch(watch);
  let startMinuteOffset = 0;

  if (viewMode === 'past24h') {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    startMinuteOffset = Math.round(currentMinutes / intervalMinutes) * intervalMinutes;
  }

  return Array.from({ length: total }, (_item, index) => {
    const totalMinutes = Math.round(index * intervalMinutes + startMinuteOffset) % 1440;
    const hour = Math.floor(totalMinutes / 60);
    const minute = Math.floor(totalMinutes % 60);
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  });
}

const getSensorDataLength = (sensorData, baseLabels = []) => Math.max(
  baseLabels.length,
  sensorData?.dataPressure?.length || 0,
  sensorData?.sensorYRest?.length || 0,
  sensorData?.dataFlow?.length || 0,
  sensorData?.flowYRest?.length || 0
);

const getDetailLabels = (deviceInfo, sensorData, baseLabels, viewMode) => {
  const expectedLength = Math.ceil(1440 / getSourceMinutesFromWatch(deviceInfo?.watch));
  const sourceLength = Math.max(getSensorDataLength(sensorData, []), expectedLength);
  if (!sourceLength) return [];
  return generateLabelsByLength(deviceInfo?.watch, sourceLength, viewMode);
};

const laInit = (info, viewModes = {}) => {
  const la = []
  for (let i = 0; i < info.length; i++) {
    const vMode = viewModes[info[i].id] || 'today';
    la.push(generateLabelsAndData(info[i].watch, vMode))
  }
  return la
}

const currentTime = (info, viewModes = {}) => {
  const currentT = []
  const currentDate = new Date();
  for (let i = 0; i < info.length; i++) {
    const vMode = viewModes[info[i].id] || 'today';
    if (vMode === 'past24h') {
      currentT.push(1.0);
    } else {
      currentT.push((currentDate.getHours() * 60 + currentDate.getMinutes()) / 1440)
    }
  }
  return currentT
}


function SensorList() {
  const { user } = useAuth()
  user.user = 0
  const groupPram = useParams().group
  const location = useLocation();
  const groupID = location.state?.sensorIDs || [];
  const idMap = location.state?.sensorMap || {};
  const [sensorLoading, setSensorLoading] = useState(false);
  const [dateData, setDateData] = useState([])
  const [dataPressure, setDataPressure] = useState(null)
  const [filteredDevices, setFilteredDevices] = useState(groupID);
  const [dataInfo, setdataInfo] = useState(groupID);
  const [showModal, setShowModal] = useState(false);
  const [pram, setPram] = useState([]);
  const [pramFlow, setPramFlow] = useState([]);
  const [timeTracking, setTimeTracking] = useState([]);
  const [batteryInit, setBatteryInit] = useState([]);
  const [temp, setTemp] = useState([]);
  const [isViEdit, setIsEdit] = useState(Array(groupID.length).fill(false));
  const [activeTab, setActiveTab] = useState(Array(groupID.length).fill('detail')); // 'detail' | 'overview'
  const [fullScreenSensor, setFullScreenSensor] = useState(null);
  const [fromDates, setFromDates] = useState(Array(groupID.length).fill(""));
  const [toDates, setToDates] = useState(Array(groupID.length).fill(""));
  const [viewModes, setViewModes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sensorViewModes") || "{}");
    } catch {
      return {};
    }
  });
  const getSensorDisplaySettings = (device) => ({
    overviewMetrics: device?.displaySettings?.overviewMetrics?.length ? device.displaySettings.overviewMetrics : defaultOverviewMetrics,
    detailColumns: device?.displaySettings?.detailColumns?.length ? device.displaySettings.detailColumns : defaultDetailTableColumns,
    detailChartInterval: normalizeDisplayIntervalValue(device?.displaySettings?.detailChartInterval),
    detailTableInterval: normalizeDisplayIntervalValue(device?.displaySettings?.detailTableInterval),
  });

  const updateDetailDisplayInterval = async (step, key, value) => {
    const currentSensor = dataInfo[step];
    const current = getSensorDisplaySettings(currentSensor);
    const nextValue = normalizeDisplayIntervalValue(value);
    const displaySettings = {
      ...current,
      [key]: nextValue,
    };

    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), {
        displaySettings,
        sen_id: currentSensor.id,
        user: user.user,
      });
      setdataInfo((prevData) =>
        produce(prevData, (draft) => {
          draft[step].displaySettings = res.data.displaySettings || displaySettings;
        })
      );
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || "Lỗi khi lưu khoảng xem dữ liệu");
    }
  };

  const updateSensorDisplaySettings = async (step, type, key) => {
    const currentSensor = dataInfo[step];
    const current = getSensorDisplaySettings(currentSensor);
    const fallback = type === "overviewMetrics" ? defaultOverviewMetrics : defaultDetailTableColumns;
    const existing = current[type];
    const nextValues = existing.includes(key)
      ? existing.filter((item) => item !== key)
      : [...existing, key];
    const displaySettings = {
      ...current,
      [type]: nextValues.length ? nextValues : fallback,
    };

    try {
      await intervalUpdatePut(localStorage.getItem("token"), {
        displaySettings,
        sen_id: currentSensor.id,
        user: user.user,
      });
      setdataInfo((prevData) =>
        produce(prevData, (draft) => {
          draft[step].displaySettings = displaySettings;
        })
      );
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || "Lỗi khi lưu cấu hình hiển thị");
    }
  };

  const changeSensorViewMode = (deviceId, mode) => {
    setViewModes((prev) => {
      const updated = { ...prev, [deviceId]: mode };
      localStorage.setItem("sensorViewModes", JSON.stringify(updated));
      return updated;
    });
  };

  const fetchSetting = async (total, info) => {
    try {
      const res = await getSensorInGroup(localStorage.getItem("token"), `group=${encodeURIComponent(groupPram)}&user=${encodeURIComponent(user.user)}`);
      if (res.data.success) {
        const resInfo = res.data.senInGroup || [];
        setdataInfo(resInfo)
        setFilteredDevices(resInfo)
        fetchSensors(resInfo.length, resInfo)
      } else {
        alert("Failed to fetch sensors");
      }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  };
  const fetchSensors = async (total, info) => {
    try {
      const startOfToday = new Date();
      const res = await sensorListGet(localStorage.getItem("token"), { total: total, info: info, user: user.user, date: [startOfToday, null], viewModes: viewModes });
      if (res.data.success) {
        const data = res.data.sensors.map((sensor, index) => ({
          ...sensor,
          sourceWatch: info?.[index]?.watch,
        }))
        data.forEach((sensor, index) => {
          addDataSensor(index, sensor.sensorT, sensor.dataPressure, sensor.dataFlow)
        })
        setTimeTracking(res.data.timeTrackingRet)
        setBatteryInit(res.data.battery)
        setTemp(res.data.temperature)
        setPram(res.data.pram)
        setPramFlow(res.data.pramFlow)
        setDataPressure(data)
      } else {
        alert("Failed to fetch sensors");
      }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    } finally {
      setSensorLoading(false);
    }
  };

  useEffect(() => {
    fetchSetting()
    battery.length = 0;
  }, [viewModes]);


  const filterSensor = (e) => {
    const records = dataInfo.filter((dep) => dep.name.toLowerCase().includes(e.target.value.toLowerCase()))
    setFilteredDevices(records)
  }

  const handleData = async (data) => {
    setShowModal(true);
    setDateData(data)
  }

  const labelsByStep = useMemo(() => laInit(dataInfo, viewModes), [dataInfo, viewModes]);
  const currentTimeByStep = useMemo(() => currentTime(dataInfo, viewModes), [dataInfo, viewModes]);

  return (
    <>
      {sensorLoading ? (
        <div className="flex justify-center items-center h-screen">
          <div>Loading...</div>
        </div>
      ) : (
        <div className="p-5 pb-28 sm:pb-5">
          <div className="text-center mb-4">
            <h3 className="text-2xl font-bold">Quản lý cảm biến</h3>
          </div>
          <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Tìm kiếm cảm biến..."
                className="border rounded px-3 py-1.5 text-sm bg-white"
                onChange={filterSensor}
              />
              <button
                onClick={fetchSetting}
                className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-xs transition flex items-center gap-1 shadow-sm"
                title="Cập nhật số liệu"
              >
                🔄 Cập nhật số liệu
              </button>
            </div>

            {/* <Link
              to="/admin-dashboard/add-sensors"
              className="px-4 py-1 bg-teal-600 rounded text-white"
            >
              Thêm cảm biến
            </Link>  */}
            {/* <DateCom handleData={handleData} />
            <Dropdown /> */}
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-4 w-full">
            {!dataPressure ? (
              <div className="flex justify-center items-center h-screen">
                <div>Loading...</div>
              </div>
            ) : (filteredDevices.map((device) => {
              const step = dataInfo.findIndex(d => d.id === device.id);
              if (step === -1) return null;
              const isFullScreen = fullScreenSensor === device.id;
              return (
                (() => {
                  const display = getSensorDisplaySettings(dataInfo[step]);
                  const sensorViewMode = viewModes[device.id] || 'today';
                  const sourceWatch = dataPressure?.[step]?.sourceWatch || dataInfo[step]?.watch;
                  const sourceLabels = getDetailLabels(
                    { watch: sourceWatch },
                    dataPressure?.[step],
                    labelsByStep[step] || [],
                    sensorViewMode
                  );
                  const detailChartInterval = display.detailChartInterval;
                  const detailTableInterval = display.detailTableInterval;
                  const detailChartDisplay = buildDetailDisplayData(dataPressure?.[step], sourceLabels, sourceWatch, detailChartInterval);
                  const detailTableDisplay = buildDetailDisplayData(dataPressure?.[step], sourceLabels, sourceWatch, detailTableInterval);
                  return (
                <li
                  className={isFullScreen
                    ? "fixed inset-0 z-[40] bg-gray-200 p-6 overflow-y-auto flex flex-col items-center w-full h-full"
                    : "flex flex-col items-center w-full sm:w-[560px] md:w-[600px] bg-gray-200 p-4 rounded-lg shadow"
                  }
                  key={device.id}
                >
                  <div className="flex w-full justify-between items-center mb-4" >
                    <button
                      className="px-3 py-1 bg-teal-600 text-white rounded"
                      onClick={() => setIsEdit(prevData =>
                        produce(prevData, draft => {
                          draft[step] = !draft[step];
                        })
                      )}
                    >
                      Thông tin
                    </button>
                    <h3 className="text-lg font-bold">{device.name} ({dataInfo[step].id})</h3>
                    <div className="flex items-center gap-2">
                      <Battery step={step} temp={temp[step]} data={batteryInit[step]} dataInfo={dataInfo[step]} />
                      <SettingsButton total={groupID.length}
                        info={dataInfo}
                        setdataInfo={setdataInfo}
                        handleData={handleData}
                        adj={device.adj}
                        step={step}
                        viewMode={viewModes[device.id] || 'today'}
                        setViewMode={(mode) => changeSensorViewMode(device.id, mode)}
                        displaySettings={display}
                        updateDisplaySettings={(type, key) => updateSensorDisplaySettings(step, type, key)}
                        detailChartDisplayInterval={detailChartInterval}
                        detailTableDisplayInterval={detailTableInterval}
                        detailDisplayOptions={detailDisplayIntervalOptions}
                        setDetailChartDisplayInterval={(value) => updateDetailDisplayInterval(step, "detailChartInterval", value)}
                        setDetailTableDisplayInterval={(value) => updateDetailDisplayInterval(step, "detailTableInterval", value)}
                      />
                      <button
                        className="text-gray-500 hover:text-teal-600 transition p-1 rounded-lg hover:bg-gray-300/50"
                        onClick={() => setFullScreenSensor(isFullScreen ? null : device.id)}
                        title={isFullScreen ? "Thu nhỏ" : "Phóng to toàn màn hình"}
                      >
                        {isFullScreen ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15H3v6m11-11h6V4m-6 6 7-7M10 14l-7 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {isViEdit[step] ? <EditComponent step={step} id={dataInfo[step].id} setIsEdit={setIsEdit} /> : null}
                  </div>
                  <div className="flex w-full items-center gap-3 overflow-x-auto pb-1" >
                    <div className="flex min-w-max items-center gap-3">
                      <TimeComparison step={step} init={timeTracking[step]} info={groupID[step]} />
                      <div className="flex shrink-0 gap-1 rounded-lg bg-gray-300 p-0.5">
                        <button
                          onClick={() => setActiveTab(prev => { const n=[...prev]; n[step]='detail'; return n; })}
                          className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                            activeTab[step] === 'detail'
                              ? 'bg-teal-600 text-white shadow'
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          📈 Số liệu chi tiết
                        </button>
                        <button
                          onClick={() => setActiveTab(prev => { const n=[...prev]; n[step]='overview'; return n; })}
                          className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                            activeTab[step] === 'overview'
                              ? 'bg-teal-600 text-white shadow'
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          📊 Số liệu tổng quan
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="w-full overflow-hidden pb-1">
                    <div className="flex flex-row items-center gap-2 rounded-xl border border-gray-300/40 bg-gray-300/30 px-2 py-1.5 shadow-sm w-full">
                       <input
                        type="datetime-local"
                        value={fromDates[step] || ""}
                        onChange={(e) => {
                          const [d, t] = e.target.value.split("T");
                          if (!d || !t) return;
                          const [h, m] = t.split(":").map(Number);
                          const rm = Math.round(m / 5) * 5;
                          const val = `${d}T${String(h).padStart(2, "0")}:${String(rm % 60).padStart(2, "0")}`;
                          setFromDates(prev => { const n = [...prev]; n[step] = val; return n; });
                        }}
                        className="min-h-10 w-full flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      />
                      <span className="shrink-0 text-[11px] font-semibold text-gray-500">đến</span>
                      <input
                        type="datetime-local"
                        value={toDates[step] || ""}
                        onChange={(e) => {
                          const [d, t] = e.target.value.split("T");
                          if (!d || !t) return;
                          const [h, m] = t.split(":").map(Number);
                          const rm = Math.round(m / 5) * 5;
                          const val = `${d}T${String(h).padStart(2, "0")}:${String(rm % 60).padStart(2, "0")}`;
                          setToDates(prev => { const n = [...prev]; n[step] = val; return n; });
                        }}
                        className="min-h-10 w-full flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                      />
                      <button
                        onClick={() => {
                          if (!fromDates[step] || !toDates[step]) {
                            alert("Vui lòng chọn khoảng thời gian hợp lệ!");
                            return;
                          }
                          handleData([fromDates[step], toDates[step], device.id, device.name, device.adj]);
                        }}
                        className="min-h-10 shrink-0 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700"
                      >
                        Xem dữ liệu
                      </button>
                    </div>
                  </div>
                  {/* Nội dung tab */}
                  {activeTab[step] === 'overview' ? (
                    <SensorOverview pram={pram[step]} pramFlow={pramFlow[step]} sensorData={dataPressure[step]} watch={dataInfo[step].watch} visibleMetrics={display.overviewMetrics} sensorId={device.id} userId={user.user} lat={device.lat} lng={device.lng} step={step} />
                  ) : (
                    <div className="w-full">
                      <RealTimeLineChart
                        name={step}
                        rangeKey={`${device.id}-${detailChartInterval}-${sourceWatch}-${detailChartDisplay.labels.length}`}
                        adj={device.adj}
                        label={detailChartDisplay.labels}
                        data={detailChartDisplay.data}
                      />
                      <ScrollableTable
                        step={step}
                        watch={sourceWatch}
                        adj={device.adj}
                        currentTimeDate={currentTimeByStep[step]}
                        data={detailTableDisplay.data}
                        labels={detailTableDisplay.labels}
                        rowIndexes={detailTableDisplay.indexes}
                        tableRows={detailTableDisplay.rows}
                        visibleColumns={display.detailColumns}
                      />
                    </div>
                  )}
                </li>
                  )
                })()
              )
            }))}
            {showModal ? <ModalData dateData={dateData} info={dataInfo} idMap={idMap} isOpen={showModal} handleCancel={() => setShowModal(false)} /> : null}
          </ul>
        </div>
      )}
    </>
  );
}

export default SensorList;
