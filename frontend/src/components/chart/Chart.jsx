import { useState, useEffect, useRef } from 'react';
import { changeData } from "../sensor/SensorList"
import mqtt from 'mqtt';
import { Sema } from 'async-sema'
import { produce } from "immer";
import annotationPlugin from "chartjs-plugin-annotation";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
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

let battery = [];
let timeReach = [];
export let respondInterval;
export const listDataSensor = []
export const listDataTable = []

function convertTime(timeConvert) {
  timeConvert = new Date(timeConvert)
  return timeConvert.getHours() * 60 + timeConvert.getMinutes()
}

export const addDataSensor = (indexSensors, data, dataPressure) => {
  listDataTable[indexSensors] = data
  listDataSensor[indexSensors] = dataPressure
}

export const connectMqtt = (timeTrackingRet, info) => {
  const [data, setData] = useState();
  const host = 'iotwater2024.mooo.com';
  const port = 9001;
  const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
  const connectUrl = `wss://${host}:${port}/mqtt`;
  const topic = 'iotwatter@2024';
  let check = false;
  timeReach = timeTrackingRet;
  const options = {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 5000,
  }
  const client = mqtt.connect(connectUrl, options);

  useEffect(() => {

    const semaphore = new Sema(1);
    client.on('connect', () => {
      console.log('Connected to MQTT broker');
    });

    client.on('message', async (topic, messageData) => {
      await semaphore.acquire();
      try {
        messageData = JSON.parse(messageData.toString());
        const sen_name = Number(messageData.sen_name);
        const timeFake = info[sen_name].sample * 1000;
        const msg_id = Number(messageData.msg_id);
        if (msg_id === 1 && sen_name != null) {
          const lastValue = messageData.data[messageData.data.length - 1];
          battery[sen_name] = lastValue.battery;
          const dateNow = Date.now() - (messageData.data.length - 1) * timeFake;
          let currentStart = messageData.data[0].createAt * 1000;
          const timeCheck = Math.abs(currentStart - dateNow)
          if (Number(timeCheck) > 100000) {
            check = true
          }
          else {
            check = false
          }
          messageData.data.forEach(async (message, index) => {
            if (check) {
              message.createAt = dateNow + (index + 1) * timeFake;
            }
            else {
              message.createAt = message.createAt * 1000
            }
            if (message.Pressure >= info[sen_name].tracking) {
              timeReach[sen_name] += Math.floor((message.createAt - currentStart) / 60000)
            }
            currentStart = message.createAt
            await addData(sen_name, message, message.createAt, message.Pressure);
          })
        }
      } catch (error) {
        if (error.res && !error.res.data.success) {
          alert(error.res.data.error);
        }
      } finally {
        setData(messageData);
        semaphore.release();
      }
    });
    client.subscribe(topic)
    return () => {
      client.end();
    };
  }, []);
  return data;
}

export const addData = async (indexSensor, data, newDate, dataPressure) => {
  if (!listDataSensor[indexSensor] || listDataSensor[indexSensor].length > 1439) {
    listDataSensor[indexSensor] = [];
  }
  if (!listDataTable[indexSensor]) {
    listDataTable[indexSensor] = []
  }
  const index = Math.floor(convertTime(newDate))
  listDataSensor[indexSensor][index] = dataPressure
  listDataTable[indexSensor][index] = data
};

export const ChartMadal = (profs) => {
  const chartRef = useRef(null);
  const chartData = {
    labels: profs.dataLabel.labels,
    datasets: [
      {
        label: "Áp suất hôm nay (Bar)",
        data: profs.dataModal.sensorH,
        borderColor: "#FF0000", // Màu xanh lá
        tension: 0.1, // Độ cong của đường
        borderWidth: 1,
        pointRadius: pointLage, // Độ lớn điểm
        pointBackgroundColor: "#FF0000", // Màu điể
        spanGaps: true
      },
      {
        label: "Áp suất cùng kì (Bar)",
        data: profs.dataModal.sensorY,
        borderColor: profs.colorY, // Màu xanh
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: profs.colorY, // Màu điểm
        spanGaps: true
      }
    ]
  }

  // Tùy chọn biểu đồ
  const options = {
    responsive: true,
    maintainAspectRatio: false,
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
          horizontalLine: { // Đường kẻ ngang
            type: "line",
            borderColor: "rgba(150, 150, 150, 0.5)",
            borderWidth: 1,
            scaleID: "y",
            value: 0, // Cập nhật khi di chuột
          },
          highlightBox: {
            type: "box",
            xMin: 0,  // Điều chỉnh vị trí vùng màu
            xMax: 5,
            backgroundColor: "rgba(255, 0, 0, 0.3)", // Màu đỏ trong suốt
            borderWidth: 1,
          },
        },
      },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    scales: {
      x: { min: 0, max: profs.length, grid: { display: false } },
      y: { min: 0, max: 7, ticks: { stepSize: 0.1 }, grid: { color: "rgba(200, 200, 200, 0.2)" } },
    },
  };

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const canvas = chart.canvas;

    const updateAnnotation = (event) => {
      const chartInstance = chartRef.current;
      if (!chartInstance) return;

      const xScale = chartInstance.scales.x;
      const yScale = chartInstance.scales.y;

      const xValue = xScale.getValueForPixel(event.offsetX);
      const yValue = yScale.getValueForPixel(event.offsetY);

      chartInstance.options.plugins.annotation.annotations.verticalLine.value = xValue;
      chartInstance.options.plugins.annotation.annotations.horizontalLine.value = yValue;

      chartInstance.update("none");
    };

    canvas.addEventListener("mousemove", updateAnnotation);

    return () => {
      canvas.removeEventListener("mousemove", updateAnnotation);
    };
  }, []);

  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current; // Truy cập biểu đồ
      const annotation = chart.options.plugins.annotation;

      // Cập nhật giá trị xMin và xMax
      annotation.annotations.highlightBox.xMin = profs.scrollPosition;
      annotation.annotations.highlightBox.xMax = profs.scrollPosition + 5;

      chart.update(); // Cập nhật biểu đồ mà không reset trạng thái
    }
  }, [profs.scrollPosition]);

  return (
    <div className="w-full h-80 mb-3">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
}

const RealTimeLineChart = (profs) => {
  const chartRef = useRef(null);
  const [chartData, setData] = useState({
    labels: profs.label[profs.name],
    datasets: [
      {
        label: "Áp suất hôm nay (Bar)",
        data: profs.data[profs.name].dataPressure,
        borderColor: "#FF0000", // Màu xanh lá
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: "#FF0000", // Màu điểm
        spanGaps: true
      },
      {
        label: "Áp suất cùng kì (Bar)",
        data: profs.data[profs.name].sensorYRest,
        borderColor: "#0000FF", // Màu xanh
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: "#0000FF", // Màu điểm
        spanGaps: true
      },
    ],
  })

  // Tùy chọn biểu đồ
  const [options, setOptions] = useState({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        // position: "top",
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
      annotation: {
        annotations: {
          highlightBox: {
            type: "box",
            xMin: 0,  // Điều chỉnh vị trí vùng màu
            xMax: 5,
            backgroundColor: "rgba(255, 0, 0, 0.3)", // Màu đỏ trong suốt
            borderWidth: 1,
          },
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: profs.label[profs.name].length,
        grid: {
          display: false,
        },
      },
      y: {
        min: 0,
        max: 7,
        ticks: {
          stepSize: 0.1,
        },
        grid: {
          color: "rgba(200, 200, 200, 0.2)",
        },
      },
    },
  })

  useEffect(() => {
    setData((prevData) => ({
      ...prevData,
      datasets: prevData.datasets.map((dataset, index) => {
        if (index !== 1) {
          return {
            ...dataset,
            data: listDataSensor[profs.name]
          };
        }
        else {
          return {
            ...dataset,
            data: profs.data[profs.name]?.sensorYRest
          };
        }
      }),
    }));
    // setData(prevData =>
    //   produce(prevData, draft => {
    //     draft.datasets[0].data = listDataSensor[profs.name];
    //   })
    // )
  }, [changeData]);

  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current; // Truy cập biểu đồ
      const annotation = chart.options.plugins.annotation;

      // Cập nhật giá trị xMin và xMax
      annotation.annotations.highlightBox.xMin = profs.scrollPosition[profs.name];
      annotation.annotations.highlightBox.xMax = profs.scrollPosition[profs.name] + 5;

      chart.update(); // Cập nhật biểu đồ mà không reset trạng thái
    }
  }, [profs.scrollPosition[profs.name]]);

  // useEffect(() => {
  //   if (chartRef.current) {
  //     const chart = chartRef.current;

  //     // Cập nhật nhãn của dataset
  //     chart.data.labels = profs.label[profs.name];
  //     setData((prevData) => ({
  //       ...prevData,
  //       datasets: prevData.datasets.map((dataset, index) => {
  //         if (index !== 1) {
  //           return {
  //             ...dataset,
  //             data: listDataSensor[profs.name]
  //           };
  //         }
  //         else {
  //           return {
  //             ...dataset,
  //             data: profs.data[profs.name]?.sensorYRest
  //           };
  //         }
  //       }),
  //     }));
  //     chart.update(); // Cập nhật biểu đồ mà không reset trạng thái
  //   }
  // }, [profs.label[profs.name]]);

  return (
    <div className="w-full h-80 mb-3">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
};

export const Battery = ({ step, data, dataInfo, setSingnals, signalStrength }) => {
  const [batteryLevel, setBatteryLevel] = useState(data[step]);

  useEffect(() => {
    setBatteryLevel(battery[step] || data[step]);
    if (battery[step]) {
      setSingnals(prevData =>
        produce(prevData, draft => {
          draft[step] = 3;
        })
      )
    }
    setTimeout(() => {
      setSingnals(prevData =>
        produce(prevData, draft => {
          draft[step] = 0;
        })
      )
    }, dataInfo[step].interval * 1000 + 40000);
  }, [changeData]);

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
        className={`w-2 ${signalStrength[step] >= index + 1 ? "bg-green-500" : "bg-gray-300"}`}
        style={{ height: `${height}%` }}
      ></div>
    ));
  };

  return (
    <div className="flex items-center space-x-4">
      <div className="flex items-end space-x-1 h-8">
        {renderSignalBars()}
      </div>
      {/* Pin */}
      <div className="flex items-center space-x-2">
        <div className="w-16 h-8 border-2 border-gray-400 rounded-sm flex items-center relative">
          <div
            className={`h-full ${getBatteryColor(batteryLevel)} rounded-sm`}
            style={{ width: `${batteryLevel}%` }}
          ></div>
          <span className="absolute w-full text-center text-black font-bold">
            {batteryLevel}%
          </span>
          <div className="w-2 h-4 bg-gray-400 absolute -right-3 rounded-sm"></div>
        </div>
      </div>
    </div>
  );
};


export const TimeComparison = (profs) => {
  const [timeMoreThan, setTimeMoreThan] = useState(profs.init[profs.step])
  if (!profs.dataModal) {
    useEffect(() => {
      setTimeMoreThan(timeReach[profs.step]);
    }, [changeData]);
  }
  else {
    console.log(timeMoreThan)
  }
  return (
    <div className="flex justify-between w-full">
      <div className="flex items-center w-1/2">
        <span className="text-sm font-medium text-gray-700 mr-2">
          Lớn hơn <span className="text-red-600">{profs.info[profs.step].tracking}</span> Bar:
        </span>
        <span className="text-lg font-bold text-teal-700">{Math.floor(timeMoreThan / 60)}H {timeMoreThan % 60}P</span>
      </div>
    </div>
  );
};




export default RealTimeLineChart;
