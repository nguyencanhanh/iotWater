import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { changeData } from "../sensor/SensorList"
// import mqtt from 'mqtt';
import { Sema } from 'async-sema'
import { getMqttClient } from "../../pages/AdminDashboard";
import annotationPlugin from "chartjs-plugin-annotation";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  Decimation,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Title,
  Legend,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";

// Đăng ký các thành phần của Chart.js
ChartJS.register(
  CategoryScale,
  Decimation,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Title,
  Legend,
  zoomPlugin,
  annotationPlugin
);

//define
const pointLage = 0
//end define

const defaultDetailChartHiddenStates = [false, true, false, true];
const detailChartHiddenStorageKey = "sensorDetailChartHiddenStatesV2";

const readDetailChartHiddenStates = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(detailChartHiddenStorageKey) || "[]");
    const normalized = defaultDetailChartHiddenStates.map((fallback, index) => saved[index] ?? fallback);
    return normalized.some((hidden) => hidden === false) ? normalized : defaultDetailChartHiddenStates;
  } catch {
    return defaultDetailChartHiddenStates;
  }
};

const formatChartNumber = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("vi-VN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

const getSelectedLineStyle = (chart, container, index) => {
  if (!chart?.chartArea || !container || index === null) return null;
  const x = getChartPointX(chart, index);
  if (!Number.isFinite(x)) return null;
  const canvasRect = chart.canvas.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return {
    left: `${canvasRect.left - containerRect.left + x}px`,
    top: `${canvasRect.top - containerRect.top + chart.chartArea.top}px`,
    height: `${Math.max(chart.chartArea.bottom - chart.chartArea.top, 0)}px`,
  };
};

export let battery = [];
export let flowsum = [];
export let temperature = [];
let timeReach = [];
export let respondInterval;
export const listDataSensor = []
export const flowDataSensor = []
export const listDataTable = []

function convertTime(timeConvert, watch) {
  timeConvert = new Date(timeConvert)
  return (timeConvert.getHours() * 60 + timeConvert.getMinutes()) * 60 / watch
}

export const addDataSensor = (indexSensors, data, dataPressure, dataFlow) => {
  listDataTable[indexSensors] = data
  listDataSensor[indexSensors] = dataPressure
  flowDataSensor[indexSensors] = dataFlow;
}


export function connectMqtt(timeTrackingRet, info, idMap) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const client = getMqttClient();
    if (!client) return;

    const topic = "iotwatter@2024";
    const semaphore = new Sema(1);

    // ✅ TẠO HANDLER RIÊNG (QUAN TRỌNG)
    const handleMessage = async (topic, messageData) => {
      await semaphore.acquire();
      try {
        const parsed = JSON.parse(messageData.toString());

        const sen_name = idMap[Number(parsed.n)];
        const msg_id = Number(parsed.m);
        if (msg_id === 1 && sen_name != null) {
          const dataMess = parsed.d;
          const lastValue = dataMess[dataMess.length - 1];

          battery[sen_name] = lastValue.b || parsed.b;
          flowsum[sen_name] = parsed.s / 10;
          temperature[sen_name] = parsed.t;

          let currentStart = dataMess[0].t * 1000;

          for (const mess of dataMess) {
            const message = {
              createAt: mess.t * 1000,
              Pressure: mess.p,
              flow: mess.f,
              battery: mess.b || parsed.b,
            };

            if (message.Pressure >= info[sen_name].tracking) {
              timeTrackingRet[sen_name] += Math.floor(
                (message.createAt - currentStart) / 60000
              );
            }

            currentStart = message.createAt;

            await addData(
              sen_name,
              message,
              message.createAt,
              message.Pressure,
              info[sen_name].watch
            );
          }
        }

        setData(parsed);
      } catch (err) {
        console.error("MQTT message error:", err);
      } finally {
        semaphore.release();
      }
    };

    // ✅ ĐĂNG KÝ LISTENER
    client.on("message", handleMessage);
    client.subscribe(topic);

    // 🔥 CLEANUP KHI RỜI TRANG
    return () => {
      client.off("message", handleMessage);
    };
  }, [idMap, info, timeTrackingRet]);

  return data;
}


export const addData = async (indexSensor, data, newDate, dataPressure, watch) => {
  if (!listDataSensor[indexSensor]) {
    listDataSensor[indexSensor] = [];
  }
  if (!listDataTable[indexSensor]) {
    listDataTable[indexSensor] = []
  }
  const index = Math.floor(convertTime(newDate, watch))
  listDataSensor[indexSensor][index] = dataPressure
  listDataTable[indexSensor][index] = data
};

export const ChartPrv = (profs) => {
  const chartRef = useRef(null);
  const chartData = {
    labels: profs.label,
    datasets: profs.dataset
  }
  // Tùy chọn biểu đồ
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest', // <<== điểm gần nhất
      axis: 'x', // hoặc 'xy' nếu muốn cả 2 chiều
      intersect: false, // <<== quan trọng: không cần trỏ đúng vào điểm
    },
    plugins: {
      legend: { display: true, position: "top" },
      tooltip: { enabled: true },
    },
    scales: {
      x: {
        min: 0,
        max: profs.length,
      },
      y1: {
        position: "left",
        title: { display: true, text: "Áp suất(m)" },
        min: 0,
        max: 50,
        grid: { color: "rgba(43, 41, 41, 0.2)" },
      },
      y2: {
        position: "right",
        title: { display: true, text: "Lưu lượng m3/h" },
        min: 0,
        max: 500,
      },
    },
  }), [profs.length]);


  return (
    <div className="w-full h-80 mb-3">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
}

export const ChartMadal = (profs) => {
  const chartRef = useRef(null);
  const labels = profs.dataLabel?.labels || [];
  const chartData = {
    labels,
    datasets: [
      {
        label: "Áp suất(m)",
        data: profs.dataModal.sensorH,
        borderColor: "#FF0000", // Màu xanh lá
        tension: 0.1, // Độ cong của đường
        borderWidth: 1,
        pointRadius: pointLage, // Độ lớn điểm
        pointBackgroundColor: "#FF0000", // Màu điể
        yAxisID: "y1",
        spanGaps: true
      },
      {
        label: "Lưu lượng(m3/h)",
        data: profs.dataModal.flowH,
        borderColor: "#000080", // Màu xanh
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: "#000080", // Màu điểm
        yAxisID: "y2",
        spanGaps: true
      },
    ]
  }

  // Tùy chọn biểu đồ
  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest', // <<== điểm gần nhất
      axis: 'x', // hoặc 'xy' nếu muốn cả 2 chiều
      intersect: false, // <<== quan trọng: không cần trỏ đúng vào điểm
    },
    plugins: {
      legend: { display: true, position: "top" },
      tooltip: { enabled: true },
      zoom: {
        pan: {
          enabled: true,
          mode: "x", // Kéo ngang
        },
        zoom: {
          wheel: {
            enabled: true, // Zoom bằng cuộn chuột
          },
          pinch: {
            enabled: true, // Zoom trên màn hình cảm ứng
          },
          mode: "x", // Zoom theo trục X
          speed: 0.1, // Tăng độ nhạy zoom
        },
      },
      annotation: {
        annotations: {
          ...profs.dataLabel.verticalLines, // Giữ nguyên đường annotation cũ
          verticalLine: {  // Đường kẻ dọc
            type: "line",
            borderColor: "rgba(150, 150, 150, 0.5)",
            borderWidth: 1,
            scaleID: "x",
            value: 0, // Cập nhật khi di chuột
          },
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: Math.max((labels.length || profs.length || 1) - 1, 0),
        grid: { display: false },
        ticks: {
          autoSkip: false,
          callback: function (value) {
            const label = this.getLabelForValue(value);
            if (!label) return '';
            const lengthLabels = labels.length
            if (label.includes('-')) return label
            const hour = parseInt(label.split(':')[0]);
            const minute = parseInt(label.split(':')[1]);
            if (lengthLabels < 288) {
              if (minute === 0) return label;
            }
            else if (lengthLabels < 576) {
              if (minute === 0 && hour % 2 === 0) return label;
            }
            else if (lengthLabels < 864) {
              if (minute === 0 && hour % 3 === 0) return label;
            }
            else if (lengthLabels < 1152) {
              if (minute === 0 && hour % 4 === 0) return label;
            }
            else if (lengthLabels < 1728) {
              if (minute === 0 && hour % 6 === 0) return label;
            }
            else if (lengthLabels < 2340) {
              if (minute === 0 && hour % 8 === 0) return label;
            }
            else if (lengthLabels < 3456) {
              if (minute === 0 && hour % 12 === 0) return label;
            }
            return '';
          }
        }
      },
      y1: {
        position: "left",
        title: { display: true, text: "Áp suất (m)" },
        min: 0,
        max: 50,
        grid: { color: "rgba(200, 200, 200, 0.2)" },
      },
      y2: {
        position: "right",
        title: { display: true, text: "Lưu lượng (m3/h)" },
        min: 0,
        max: 500,
        grid: { drawOnChartArea: false }, // Ẩn lưới của trục này
      },
    },
  }), [labels, profs.dataLabel?.verticalLines, profs.length]);


  return (
    <div className="w-full h-60 mb-3">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
}

const RealTimeLineChart = (profs) => {
  const chartRef = useRef(null);
  const chartContainerRef = useRef(null);
  const selectedLineRef = useRef(null);
  const selectedIndexRef = useRef(null);
  const lineFrameRef = useRef(null);
  const selectedStateFrameRef = useRef(null);
  const zoomRangeRef = useRef(null);
  const chartRangeKeyRef = useRef("");
  const [hiddenStates, setHiddenStates] = useState(readDetailChartHiddenStates);
  const [selectedChartIndex, setSelectedChartIndex] = useState(null);
  const [zoomLocked, setZoomLocked] = useState(true);
  const chartRangeKey = `${profs.name}-${profs.rangeKey || ""}-${profs.label?.[0] || ""}-${profs.label?.[profs.label?.length - 1] || ""}-${profs.label?.length || 0}`;
  const chartLabels = profs.label || [];
  const wholeHourIndexSet = useMemo(() => getWholeHourIndexSet(chartLabels), [chartLabels]);
  const filterWholeHourTicks = useCallback((scale) => {
    filterTicksByIndexSet(scale, wholeHourIndexSet);
  }, [wholeHourIndexSet]);
  const formatWholeHourTick = useCallback(function (value) {
    return wholeHourIndexSet.has(Number(value)) ? this.getLabelForValue(value) : "";
  }, [wholeHourIndexSet]);

  if (chartRangeKeyRef.current !== chartRangeKey) {
    chartRangeKeyRef.current = chartRangeKey;
    zoomRangeRef.current = null;
  }

  const chartData = useMemo(() => ({
    labels: chartLabels,
    datasets: [
      {
        label: "Áp suất",
        data: profs.data?.dataPressure || [],
        borderColor: "#ff5a5f",
        backgroundColor: "rgba(255, 90, 95, 0.12)",
        tension: 0.28,
        pointRadius: pointLage,
        pointHoverRadius: 4,
        borderWidth: 2,
        pointBackgroundColor: "#ff5a5f",
        yAxisID: "y1",
        hidden: hiddenStates[0],
        spanGaps: true,
        unit: "m",
      },
      {
        label: "Áp suất cùng kỳ",
        data: profs.data?.sensorYRest || [],
        borderColor: "#64748b",
        backgroundColor: "rgba(100, 116, 139, 0.12)",
        tension: 0.28,
        pointRadius: pointLage,
        pointHoverRadius: 4,
        borderWidth: 1.6,
        borderDash: [5, 5],
        pointBackgroundColor: "#64748b",
        yAxisID: "y1",
        hidden: hiddenStates[1],
        spanGaps: true,
        unit: "m",
      },
      {
        label: "Lưu lượng",
        data: profs.data?.dataFlow || [],
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.12)",
        tension: 0.28,
        pointRadius: pointLage,
        pointHoverRadius: 4,
        borderWidth: 2,
        pointBackgroundColor: "#2563eb",
        yAxisID: "y2",
        hidden: hiddenStates[2],
        spanGaps: true,
        unit: "m³/h",
      },
      {
        label: "Lưu lượng cùng kỳ",
        data: profs.data?.flowYRest || [],
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.12)",
        tension: 0.28,
        pointRadius: pointLage,
        pointHoverRadius: 4,
        borderWidth: 1.6,
        borderDash: [5, 5],
        pointBackgroundColor: "#f59e0b",
        yAxisID: "y2",
        hidden: hiddenStates[3],
        spanGaps: true,
        unit: "m³/h",
      },
    ],
  }), [
    chartLabels,
    hiddenStates,
    profs.data?.dataPressure,
    profs.data?.dataFlow,
    profs.data?.sensorYRest,
    profs.data?.flowYRest,
  ]);

  const defaultXMax = Math.max((chartLabels.length || 1) - 1, 0);
  const savedZoomRange = zoomRangeRef.current;
  const zoomMin = Number.isFinite(savedZoomRange?.min)
    ? Math.min(Math.max(savedZoomRange.min, 0), defaultXMax)
    : 0;
  const zoomMax = Number.isFinite(savedZoomRange?.max) && savedZoomRange.max > zoomMin
    ? Math.min(Math.max(savedZoomRange.max, zoomMin), defaultXMax)
    : defaultXMax;

  const saveZoomRange = useCallback(() => {
    const xScale = chartRef.current?.scales?.x;
    if (!xScale || !Number.isFinite(xScale.min) || !Number.isFinite(xScale.max)) return;
    zoomRangeRef.current = { min: xScale.min, max: xScale.max };
  }, []);

  const syncSelectedLinePosition = useCallback((nextIndex = selectedIndexRef.current) => {
    const line = selectedLineRef.current;
    if (!line) return;
    const nextStyle = getSelectedLineStyle(chartRef.current, chartContainerRef.current, nextIndex);
    if (!nextStyle) {
      line.style.display = "none";
      return;
    }
    line.style.display = "block";
    line.style.left = nextStyle.left;
    line.style.top = nextStyle.top;
    line.style.height = nextStyle.height;
  }, []);

  const moveSelectedLine = useCallback((nextIndex) => {
    if (nextIndex === null || nextIndex === undefined) return;
    selectedIndexRef.current = nextIndex;
    if (lineFrameRef.current) return;
    lineFrameRef.current = requestAnimationFrame(() => {
      lineFrameRef.current = null;
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

  const selectChartIndexFromEvent = useCallback((event) => {
    const chart = chartRef.current;
    if (!chart?.chartArea || !chartData.labels.length) return;
    const sourceEvent = event?.nativeEvent || event?.native || event;
    const clientX = sourceEvent?.touches?.[0]?.clientX
      ?? sourceEvent?.changedTouches?.[0]?.clientX
      ?? sourceEvent?.clientX;
    const canvasRect = chart.canvas.getBoundingClientRect();
    const x = Number.isFinite(clientX) ? clientX - canvasRect.left : sourceEvent?.x;
    if (!Number.isFinite(x)) return;

    const boundedX = Math.min(Math.max(x, chart.chartArea.left), chart.chartArea.right);
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

  const toggleDataset = useCallback((index) => {
    setHiddenStates((prev) => {
      const next = defaultDetailChartHiddenStates.map((fallback, stateIndex) => prev[stateIndex] ?? fallback);
      next[index] = !next[index];
      localStorage.setItem(detailChartHiddenStorageKey, JSON.stringify(next));
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    zoomRangeRef.current = null;
    chartRef.current?.resetZoom?.();
    requestAnimationFrame(() => syncSelectedLinePosition());
  }, [syncSelectedLinePosition]);

  useEffect(() => {
    zoomRangeRef.current = null;
    chartRef.current?.resetZoom?.();
    const frame = requestAnimationFrame(() => {
      chartRef.current?.update?.("none");
      syncSelectedLinePosition();
    });
    return () => cancelAnimationFrame(frame);
  }, [chartRangeKey, syncSelectedLinePosition]);

  const handleWheelZoom = useCallback((event) => {
    if (zoomLocked) return;
    const chart = chartRef.current;
    if (!chart?.zoom || !chart.canvas || !event.deltaY) return;
    event.preventDefault();
    event.stopImmediatePropagation?.();
    event.stopPropagation();

    const canvasRect = chart.canvas.getBoundingClientRect();
    const focalPoint = {
      x: event.clientX - canvasRect.left,
      y: event.clientY - canvasRect.top,
    };
    const zoomAmount = event.deltaY < 0 ? 1.18 : 0.86;
    chart.zoom({ x: zoomAmount, y: 1, focalPoint }, "zoom");
    saveZoomRange();
    requestAnimationFrame(() => syncSelectedLinePosition());
  }, [zoomLocked, saveZoomRange, syncSelectedLinePosition]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      axis: 'x',
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        borderColor: "rgba(226, 232, 240, 0.35)",
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
        titleColor: "#f8fafc",
        bodyColor: "#f8fafc",
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${formatChartNumber(ctx.parsed.y)} ${ctx.dataset.unit || ""}`,
        },
      },
      decimation: {
        enabled: chartData.labels.length > 1200,
        algorithm: "lttb",
        samples: 700,
      },
      zoom: {
        pan: {
          enabled: !zoomLocked,
          mode: "x",
          onPanComplete: () => {
            saveZoomRange();
            requestAnimationFrame(() => syncSelectedLinePosition());
          },
        },
        zoom: {
          wheel: { enabled: false },
          pinch: { enabled: !zoomLocked },
          mode: "x",
          speed: 0.1,
          onZoomComplete: () => {
            saveZoomRange();
            requestAnimationFrame(() => syncSelectedLinePosition());
          },
        },
      },
    },
    onHover: (_event, elements) => {
      if (elements?.length) {
        commitSelectedIndex(elements[0].index);
      }
    },
    onClick: (event) => {
      selectChartIndexFromEvent(event);
    },
    scales: {
      x: {
        min: zoomMax > zoomMin ? zoomMin : 0,
        max: zoomMax > zoomMin ? zoomMax : defaultXMax,
        afterBuildTicks: filterWholeHourTicks,
        border: { display: false },
        grid: { color: "#e9eef5", drawTicks: false },
        ticks: {
          color: "#94a3b8",
          font: { weight: "700" },
          callback: formatWholeHourTick,
        },
      },
      y1: {
        position: "left",
        title: { display: false },
        min: 0,
        border: { display: false },
        grid: { color: "#e9eef5", drawTicks: false },
        ticks: { color: "#ff5a5f", font: { weight: "800" } },
      },
      y2: {
        position: "right",
        title: { display: false },
        min: 0,
        border: { display: false },
        grid: { drawOnChartArea: false },
        ticks: { color: "#2563eb", font: { weight: "800" } },
      },
    },
  }), [
    chartData.labels.length,
    defaultXMax,
    filterWholeHourTicks,
    formatWholeHourTick,
    saveZoomRange,
    selectChartIndexFromEvent,
    syncSelectedLinePosition,
    commitSelectedIndex,
    zoomLocked,
    zoomMax,
    zoomMin,
  ]);

  const selectedValues = useMemo(() => selectedChartIndex === null
    ? []
    : chartData.datasets
      .map((dataset, index) => ({ dataset, index }))
      .filter(({ index }) => !hiddenStates[index])
      .map(({ dataset }) => ({
        label: dataset.label,
        color: dataset.borderColor,
        value: dataset.data?.[selectedChartIndex],
        unit: dataset.unit,
      }))
      .filter((item) => item.value !== null && item.value !== undefined), [chartData.datasets, hiddenStates, selectedChartIndex]);
  const chartPlugins = useMemo(() => [], []);

  useEffect(() => () => {
    if (lineFrameRef.current) cancelAnimationFrame(lineFrameRef.current);
    if (selectedStateFrameRef.current) cancelAnimationFrame(selectedStateFrameRef.current);
  }, []);

  useEffect(() => {
    setSelectedChartIndex((prev) => {
      const length = chartLabels.length || 0;
      const nextIndex = prev !== null && prev >= 0 && prev < length ? prev : length - 1;
      selectedIndexRef.current = length ? nextIndex : null;
      requestAnimationFrame(() => syncSelectedLinePosition(selectedIndexRef.current));
      return length ? nextIndex : null;
    });
  }, [chartLabels.length, profs.name, syncSelectedLinePosition]);

  useEffect(() => {
    const chartContainer = chartContainerRef.current;
    if (!chartContainer) return;
    if (zoomLocked) return;

    chartContainer.addEventListener("wheel", handleWheelZoom, { passive: false });
    return () => {
      chartContainer.removeEventListener("wheel", handleWheelZoom);
    };
  }, [zoomLocked, chartData.labels.length, handleWheelZoom]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => syncSelectedLinePosition());
    const handleResize = () => syncSelectedLinePosition();
    window.addEventListener("resize", handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, [selectedChartIndex, chartLabels.length, hiddenStates, syncSelectedLinePosition]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => syncSelectedLinePosition());
    return () => cancelAnimationFrame(frame);
  }, [chartData.labels.length, hiddenStates, syncSelectedLinePosition]);

  return (
    <div className="mb-4 rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs font-extrabold text-slate-500">
            {chartData.datasets.map((dataset, index) => (
              <button
                key={dataset.label}
                type="button"
                onClick={() => toggleDataset(index)}
                className={`inline-flex items-center gap-2 transition ${hiddenStates[index] ? "opacity-40" : "opacity-100"}`}
                title={hiddenStates[index] ? "Bấm để hiện đường này" : "Bấm để ẩn đường này"}
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: dataset.borderColor }} />
                <span>{dataset.label}{dataset.unit ? ` (${dataset.unit})` : ""}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setZoomLocked((prev) => !prev)}
            className={`h-9 rounded-xl px-3 text-xs font-black shadow-sm transition ${
              zoomLocked
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {zoomLocked ? "Mở khóa zoom" : "Khóa zoom"}
          </button>
          {!zoomLocked && (
            <button
              type="button"
              onClick={resetZoom}
              className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div
        ref={chartContainerRef}
        className={`relative h-[300px] overflow-hidden rounded-[18px] bg-white p-1 sm:h-[340px] ${
          zoomLocked ? "cursor-crosshair" : "cursor-zoom-in"
        }`}
        onClick={selectChartIndexFromEvent}
        style={{ touchAction: zoomLocked ? "pan-y" : "none" }}
      >
        <Line ref={chartRef} data={chartData} options={options} plugins={chartPlugins} />
        <div
          ref={selectedLineRef}
          className="pointer-events-none absolute z-0 hidden w-0 -translate-x-1/2 border-l-2 border-dashed border-slate-900/90 will-change-[left,top,height]"
        />
      </div>

      {selectedValues.length > 0 && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
          <div className="mb-2 text-sm font-black text-slate-700">
            {profs.label?.[selectedChartIndex] || `Điểm ${selectedChartIndex + 1}`}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {selectedValues.map((item) => (
              <div key={item.label} className="flex min-w-0 items-center justify-between gap-3 text-sm font-black">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate" style={{ color: item.color }}>{item.label}:</span>
                </div>
                <span className="shrink-0" style={{ color: item.color }}>
                  {formatChartNumber(item.value)} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const Battery = ({ step, data, dataInfo }) => {
  const [batteryLevel, setBatteryLevel] = useState(data);
  const [signalStrength, setSingnals] = useState(0)
  const signalTimeoutRef = useRef(null);

  useEffect(() => {
    const nextBattery = battery[step] || data;
    setBatteryLevel((current) => current === nextBattery ? current : nextBattery);

    if (signalTimeoutRef.current) clearTimeout(signalTimeoutRef.current);
    if (battery[step]) {
      setSingnals((current) => current === 3 ? current : 3)
    }

    const offlineDelay = (Number(dataInfo?.interval) || 0) * 1000 + 40000;
    signalTimeoutRef.current = setTimeout(() => {
      setSingnals((current) => current === 0 ? current : 0)
    }, offlineDelay);

    return () => {
      if (signalTimeoutRef.current) clearTimeout(signalTimeoutRef.current);
    };
  }, [changeData, data, dataInfo?.interval, step]);

  const getBatteryColor = (percentage) => {
    if (percentage > 50) return "bg-green-500";
    if (percentage > 20) return "bg-yellow-500";
    return "bg-red-500";
  };

  const renderSignalBars = () => {
    const bars = [20, 40, 60, 80];
    return bars.map((height, index) => (
      <div
        key={index}
        className={`w-1 ${signalStrength >= index + 1 ? "bg-green-500" : "bg-gray-300"}`}
        style={{ height: `${height}%` }}
      ></div>
    ));
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="flex items-end h-4">
        {renderSignalBars()}
      </div>
      {/* Pin */}
      <div className="flex items-center space-x-2">
        <div className="w-8 h-4 border-2 border-gray-400 rounded-sm flex items-center relative">
          <div
            className={`h-full ${getBatteryColor(batteryLevel)} rounded-sm`}
            style={{ width: `${batteryLevel}%` }}
          ></div>
          <span className="absolute w-full text-center text-sm text-black font-bold">
            {batteryLevel}
          </span>
          <div className="w-1 h-2 bg-gray-400 absolute -right-2 rounded-sm"></div>
        </div>
      </div>
    </div>
  );
};


export const TimeComparison = (profs) => {
  // const [timeMoreThan, setTimeMoreThan] = useState(profs.init)
  // if (!profs.dataModal) {
  //   useEffect(() => {
  //     setTimeMoreThan(timeReach[profs.step]);
  //   }, [changeData]);
  // }
  return (
    <div className="flex items-center w-1/2">
      <span className="text-sm font-medium text-gray-700 mr-2">
        Lớn hơn <span className="text-red-600">{profs.info?.tracking}</span>m:
      </span>
      <span className="text-lg font-bold text-teal-700">{Math.floor(profs.init / 60)}H{profs.init % 60}P</span>
    </div>
  );
};

export const Param = (profs) => {
  return (
    <div className="flex">
      <p className='text-sm'>max: {profs.pram?.max}</p>
      <p className='ml-3 text-sm'>min: {profs.pram?.min}</p>
      <p className='ml-3 text-sm'>avg: {profs.pram?.avg?.toFixed(2)}</p>
    </div>
  );
};

export const ParamFlow = (profs) => {
  const [sumFlow, setSumFlow] = useState(profs.pram?.sum?.toFixed(1))
  const [total, setTotal] = useState(profs.pram?.total?.toFixed(1))
  useEffect(() => {
    setTotal((prevData) => {
      return !flowsum[profs.step] ? prevData : (Number(prevData) + flowsum[profs.step] - Number(sumFlow)).toFixed(1)
    });
    setSumFlow(flowsum[profs.step] ? flowsum[profs.step].toFixed(1) : profs.pram?.sum?.toFixed(1));
  }, [changeData]);
  return (
    <table className="min-w-full border border-gray-300 text-sm mt-2 text-center">
      <thead className="bg-gray-100 font-semibold">
        <tr>
          <th className="border border-gray-300 p-2">Max</th>
          <th className="border border-gray-300 p-2">Min</th>
          <th className="border border-gray-300 p-2">Avg</th>
          <th className="border border-gray-300 p-2">Total</th>
          <th className="border border-gray-300 p-2">Total24</th>
          <th className="border border-gray-300 p-2">Sum</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-gray-300 p-2">{profs.pram?.max}</td>
          <td className="border border-gray-300 p-2">{profs.pram?.min}</td>
          <td className="border border-gray-300 p-2">{profs.pram?.avg?.toFixed(2)}</td>
          <td className="border border-gray-300 p-2">{total}</td>
          <td className="border border-gray-300 p-2">{profs.pram?.total24?.toFixed(1)}</td>
          <td className="border border-gray-300 p-2">{sumFlow}</td>
        </tr>
      </tbody>
    </table>
  );
};




export default RealTimeLineChart;
