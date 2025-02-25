import { useState, useEffect, useRef } from 'react';
import { changeData } from "../sensor/SensorList"
import mqtt from 'mqtt';
import { Sema } from 'async-sema'
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
const pointLage = 0.5
//end define

let battery = [];
let timeReach = [];
let timeReachB = [];
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

export const connectMqtt = (timeTrackingRet, info, timeTrackingRetB) => {
  const [data, setData] = useState();
  const host = 'broker.hivemq.com';
  const port = 8884;
  const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
  const connectUrl = `wss://${host}:${port}/mqtt`;
  const topic = 'iotwatter@2024';
  timeReach = timeTrackingRet;
  timeReachB = timeTrackingRetB;
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
        const lastValue = messageData.data[messageData.data.length - 1]
        const sen_name = Number(messageData.sen_name);
        const msg_id = Number(messageData.msg_id);
        battery[sen_name] = lastValue.battery;
        const dateNow = Date.now() - messageData.data.length * 60000;
        let currentStart = dateNow;
        messageData.data.forEach(async (message, index) => {
          if (msg_id === 1) {
            if(sen_name === 0){
              message.createAt = dateNow + index * 60000 + 60000;
            }
            else{
              message.createAt = message.createAt * 1000
            }
            message.Pressure = message.Pressure * 0.7093 + 0.7411
            if (message.Pressure >= info[sen_name].tracking) {
              timeReach[sen_name] += Math.floor((message.createAt - currentStart) / 60000)
            }
            if (message.Pressure <= info[sen_name].trackingB) {
              timeReachB[sen_name] += Math.floor((message.createAt - currentStart) / 60000)
            }
            currentStart = message.createAt
            await addData(sen_name, message, message.createAt, message.Pressure);
          }
          else if (msg_id === 2) {
            respondInterval = message.resp;
          }
        })
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

const RealTimeLineChart = (profs) => {
  const chartRef = useRef(null);
  const [chartData, setData] = useState({
    labels: profs.label,
    datasets: profs.dataModal ? [
      {
        label: "Áp suất (Bar)",
        data: profs.dataModal[profs.name.id].dataPressure,
        borderColor: profs.colorN, // Màu xanh lá
        tension: 0.1, // Độ cong của đường
        borderWidth: 1,
        pointRadius: pointLage, // Độ lớn điểm
        pointBackgroundColor: profs.colorN, // Màu điểm
        spanGaps: true
      },
      {
        label: "Áp suất cùng kì (Bar)",
        data: profs.dataModal[profs.name.id].sensorYRest,
        borderColor: profs.colorY, // Màu xanh
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: profs.colorY, // Màu điểm
        spanGaps: true
      }
    ] : [
      {
        label: "Áp suất hôm nay (Bar)",
        data: profs.data[profs.name.id].dataPressure,
        borderColor: profs.colorN, // Màu xanh lá
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: profs.colorN, // Màu điểm
        spanGaps: true
      },
      {
        label: "Áp suất cùng kì (Bar)",
        data: profs.data[profs.name.id].sensorYRest,
        borderColor: profs.colorY, // Màu xanh
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: profs.colorY, // Màu điểm
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
      annotation: {
        annotations: [
          {
            type: "box",
            xMin: 1,
            xMax: 1 + 5, // Chỉnh lại theo cách bạn muốn
            backgroundColor: "rgba(255, 0, 0, 0.3)",
          },
        ],
      },
    },
    scales: {
      x: {
        min: 0,
        max: 1440,
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

  if (profs.dataModal) {
    useEffect(() => {
      setData((prevData) => ({
        ...prevData,
        datasets: prevData.datasets.map((dataset, index) => {
          if (index === 1) {
            return {
              ...dataset,
              data: profs.dataModal[profs.name.id].dataPressure,
            };
          }
          else {
            return {
              ...dataset,
              data: profs.dataModal[profs.name.id].sensorYRest,
            };
          }
        }),
      }));

    }, [profs.dataModal[profs.name.id]]);
  }
  else {
    useEffect(() => {
      setData((prevData) => ({
        ...prevData,
        datasets: prevData.datasets.map((dataset, index) => {
          if (index !== 1) {
            return {
              ...dataset,
              data: listDataSensor[profs.name.id]
            };
          }
          else {
            return {
              ...dataset,
              data: profs.data[profs.name.id]?.sensorYRest
            };
          }
        }),
      }));

    }, [changeData]);
  }
  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current; // Truy cập biểu đồ
      const annotation = chart.options.plugins.annotation;

      // Cập nhật giá trị xMin và xMax
      annotation.annotations[0].xMin = profs.scrollPosition[profs.name.id];
      annotation.annotations[0].xMax = profs.scrollPosition[profs.name.id] + 5;

      chart.update(); // Cập nhật biểu đồ mà không reset trạng thái
    }
  }, [profs.scrollPosition[profs.name.id]]);

  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current;

      // Cập nhật màu của dataset
      chart.data.datasets[0].pointBackgroundColor = profs.colorN;
      chart.data.datasets[0].borderColor = profs.colorN;

      chart.update(); // Cập nhật biểu đồ mà không reset trạng thái
    }
  }, [profs.colorN]);

  useEffect(() => {
    if (chartRef.current) {
      const chart = chartRef.current;

      // Cập nhật màu của dataset
      chart.data.datasets[1].pointBackgroundColor = profs.colorY;
      chart.data.datasets[1].borderColor = profs.colorY;

      chart.update(); // Cập nhật biểu đồ mà không reset trạng thái
    }
  }, [profs.colorY]);



  return (
    <div className="w-full h-80 mb-3">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
};

export const Battery = ({ step, data }) => {
  const [batteryLevel, setBatteryLevel] = useState(data[step]);

  useEffect(() => {
    setBatteryLevel(battery[step] || data[step]);
  }, [changeData]);
  const getBatteryColor = (percentage) => {
    if (percentage > 50) return "bg-green-500"; // Pin đầy
    if (percentage > 20) return "bg-yellow-500"; // Pin trung bình
    return "bg-red-500"; // Pin yếu
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="w-24 h-10 border-2 border-gray-400 rounded-sm flex items-center relative">
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
  )
};

export const TimeComparison = (profs) => {
  const morningLessThan = 5;    // Thời gian bé hơn trong buổi sáng
  const [timeMoreThan, setTimeMoreThan] = useState(profs.init[profs.step])
  const [timeLessThan, setTimeLessThan] = useState(profs.initB[profs.step])
  if (!profs.dataModal) {
    useEffect(() => {
      setTimeMoreThan(timeReach[profs.step]);
      setTimeLessThan(timeReachB[profs.step]);
    }, [changeData]);
  }
  else {
    console.log(timeMoreThan, timeLessThan)
  }
  return (
    <div className="flex items-center w-80 py-2">
      <h2 className="text-lg font-semibold text-teal-600">Thời gian đạt được</h2>
      <div className="flex justify-between w-full">
        <div className="flex flex-col items-center w-1/2">
          <span className="text-sm font-medium text-gray-700">Lớn hơn</span>
          <span className="text-lg font-bold text-teal-700">{Math.floor(timeMoreThan / 60)}H {timeMoreThan % 60}P</span>
        </div>
        <div className="flex flex-col items-center w-1/2">
          <span className="text-sm font-medium text-gray-700">Bé hơn</span>
          <span className="text-lg font-bold text-teal-700">{Math.floor(timeLessThan / 60)}H {timeLessThan % 60}P</span>
        </div>
      </div>
    </div>
  );
};




export default RealTimeLineChart;
