import { useMemo } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";

// File nay chi duoc nap khi that su co bieu do (React.lazy o payloads.jsx),
// de trang tro ly khong keo theo chunk chart.js 85KB ngay tu dau.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const PALETTE = ["#0d9488", "#2563eb", "#f59e0b", "#db2777", "#7c3aed"];

const shortLabel = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const METRIC_FIELD = {
  pressure: { key: "pressureValues", label: "Áp suất", unit: "m", axis: "y" },
  flow: { key: "flowValues", label: "Lưu lượng", unit: "m³/h", axis: "y1" },
  meter: { key: "meterValues", label: "Chỉ số đồng hồ", unit: "m³", axis: "y" },
};

const SeriesChart = ({ reportData, metrics = ["pressure", "flow"], height = 260 }) => {
  const { data, options } = useMemo(() => {
    const labels = (reportData?.labels || []).map(shortLabel);
    const series = reportData?.series || [];
    const multiSeries = series.length > 1;

    const datasets = [];
    metrics.forEach((metricKey, metricIndex) => {
      const metric = METRIC_FIELD[metricKey];
      if (!metric) return;

      series.forEach((item, seriesIndex) => {
        const color = multiSeries ? PALETTE[seriesIndex % PALETTE.length] : PALETTE[metricIndex % PALETTE.length];
        datasets.push({
          label: multiSeries ? `${item.name} · ${metric.label}` : metric.label,
          data: item[metric.key] || [],
          borderColor: color,
          backgroundColor: `${color}1f`,
          borderWidth: 2,
          borderDash: multiSeries && metricIndex > 0 ? [5, 4] : undefined,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
          spanGaps: true,
          fill: metrics.length === 1 && !multiSeries,
          yAxisID: metrics.length > 1 ? metric.axis : "y",
        });
      });
    });

    const showRightAxis = metrics.length > 1 && datasets.some((set) => set.yAxisID === "y1");

    return {
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "bottom",
            labels: { boxWidth: 10, boxHeight: 10, font: { size: 11, weight: "bold" }, usePointStyle: true },
          },
          tooltip: {
            backgroundColor: "#0f172a",
            padding: 10,
            titleFont: { size: 11 },
            bodyFont: { size: 11 },
          },
        },
        scales: {
          x: {
            ticks: { maxTicksLimit: 8, font: { size: 10 }, color: "#64748b" },
            grid: { display: false },
          },
          y: {
            position: "left",
            ticks: { font: { size: 10 }, color: "#64748b" },
            grid: { color: "#e2e8f0" },
            title: {
              display: true,
              text: METRIC_FIELD[metrics[0]]?.unit || "",
              font: { size: 10, weight: "bold" },
              color: "#64748b",
            },
          },
          ...(showRightAxis
            ? {
              y1: {
                position: "right",
                ticks: { font: { size: 10 }, color: "#64748b" },
                grid: { drawOnChartArea: false },
                title: {
                  display: true,
                  text: METRIC_FIELD[metrics[1]]?.unit || "",
                  font: { size: 10, weight: "bold" },
                  color: "#64748b",
                },
              },
            }
            : {}),
        },
      },
    };
  }, [reportData, metrics]);

  if (!data.datasets.length) return null;

  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
};

export default SeriesChart;
