import React, { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";

// Đăng ký các thành phần của Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  zoomPlugin
);

const LineChart = (profs) => {
  const [interval, setInterval] = useState(15); // Default interval: 15s
  const chartRef = useRef(null);

  // Hàm để tạo labels và dữ liệu dựa trên interval
  const generateLabelsAndData = (interval) => {
    const labels = [];
    const data = [];

    const totalSecondsInDay = 24 * 60 * 60;

    // Tạo labels theo interval
    for (let i = 0; i < totalSecondsInDay; i += interval) {
      const totalSeconds = i;
      const hour = Math.floor(totalSeconds / 3600);
      const minute = Math.floor((totalSeconds % 3600) / 60);
      const second = totalSeconds % 60;
      labels.push({ hour, minute, second });

      // Dữ liệu ngẫu nhiên cho áp suất
      data.push(Math.random() * 10 + 20);
    }

    return { labels, data };
  };

  const { labels, data } = generateLabelsAndData(interval);

  // Dữ liệu biểu đồ
  const chartData = {
    labels: labels,
    datasets: [
      {
        label: "Áp suất hôm nay (Bar)",
        data: data,
        borderColor: "rgb(59, 130, 246)", // Màu xanh
        tension: 0.3, // Độ cong của đường
      },
      {
        label: "Áp suất hôm qua (Bar)",
        data: [20,20, 30, 40, 50,null, null, null,50,20, 30, 40, 50,200, null, null, null],
        borderColor: "rgb(34, 197, 94)", // Màu xanh lá
        tension: 0.3, // Độ cong của đường
        pointRadius: 5, // Độ lớn điểm
        pointBackgroundColor: "rgb(34, 197, 94)", // Màu điểm
        spanGaps: true
      },
    ],
  };

  // Tùy chọn biểu đồ
  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: "top",
      },
      tooltip: {
        enabled: true,
      },
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
    },
    scales: {
      x: {
        ticks: {
          callback: function (value, index, values) {
            const totalTicks = values.length;
            const label = labels[value];

            // Nếu thu nhỏ đến mức 1 giờ trở lên, chỉ hiển thị theo giờ (HH)
            if (interval >= 3600) {
              return `${String(label.hour).padStart(2, "0")}`;
            } 
            // Nếu thu nhỏ đến mức 1 phút, hiển thị theo HH:MM
            else if (interval >= 60) {
              return `${String(label.hour).padStart(2, "0")}:${String(label.minute).padStart(2, "0")}`;
            } 
            // Khi chi tiết nhất, hiển thị theo HH:MM:SS
            else {
              return `${String(label.hour).padStart(2, "0")}:${String(label.minute).padStart(2, "0")}:${String(label.second).padStart(2, "0")}`;
            }
          },
        },
        min: 0,
        max: 60,
        grid: {
          display: false,
        },
      },
      y: {
        ticks: {
          stepSize: 10,
        },
        grid: {
          color: "rgba(200, 200, 200, 0.2)",
        },
      },
    },
  };

  useEffect(() => {
    setInterval(profs.interval)
  }, [profs.interval])

  return (
      <Line ref={chartRef} data={chartData} options={options} />
  );
};

export default LineChart;
