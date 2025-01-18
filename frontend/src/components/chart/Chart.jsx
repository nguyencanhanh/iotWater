import { useState, useEffect, useRef } from 'react';
import { changeData } from "../sensor/SensorList"
import { saveDataPost } from "../../api/index"
import DataTable from "react-data-table-component";
import { columnsT } from "../../utils/SensorHelper";
import mqtt from 'mqtt';
import { Sema } from 'async-sema'
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
  zoomPlugin
);

import { intervalRep } from '../sensor/SensorList';

let battery = [];
export let respondInterval;
export let client;
export const listDataSensor = []
export const listDataTable = []

function convertTime(timeConvert) {
  return timeConvert.getHours() * 3600 + timeConvert.getMinutes() * 60 + timeConvert.getSeconds()
}

export const addDataSensor = (indexSensors, data, dataPressure) => {
  listDataTable[indexSensors] = data
  listDataSensor[indexSensors] = dataPressure
}

export const connectMqtt = () => {
  const [data, setData] = useState([]);
  const host = 'broker.hivemq.com';
  const port = 8884;
  const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
  const connectUrl = `wss://${host}:${port}/mqtt`;

  const options = {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 5000,
  }
  client = mqtt.connect(connectUrl, options);

  useEffect(() => {

    const topic = 'iotwatter@2024';
    const semaphore = new Sema(1);
    client.on('connect', () => {
      console.log('Connected to MQTT broker');
    });

    client.on('message', async (topic, message) => {
      await semaphore.acquire();
      try {
        message = JSON.parse(message.toString());
        setData((prev) => [...prev, message]);
        const sen_name = Number(message.sen_name);
        const msg_id = Number(message.msg_id);
        if (msg_id === 1) {
          const newDate = new Date()
          const realTime = {
            ...message,
            createAt: newDate
          };
          battery[sen_name] = message.battery;
          await addData(sen_name, realTime, intervalRep, newDate, realTime.Pressure);
          const res = await saveDataPost(localStorage.getItem("token"), { index: sen_name, data: message })
        }
        else if (msg_id === 2) {
          respondInterval = message.resp;
        }
      } catch (error) {
        if (error.res && !error.res.data.success) {
          alert(error.res.data.error);
        }
      } finally {
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

export const addData = async (indexSensor, data, interval, newDate, dataPressure) => {
  if (!listDataSensor[indexSensor]) {
    listDataSensor[indexSensor] = [];
  }
  if(!listDataTable[indexSensor]){
    listDataTable[indexSensor] = []
  }
  listDataSensor[indexSensor][Math.floor(convertTime(newDate) / interval)] = dataPressure
  listDataTable[indexSensor].push(data)
};

const RealTimeLineChart = (profs) => {
  const chartRef = useRef(null);
  const [chartData, setData] = useState({
    labels: profs.label,
    datasets: profs.dataModal ? [
      {
        label: "Áp suất (Bar)",
        data: profs.dataModal[profs.name.id].dataPressure,
        borderColor: "rgb(34, 197, 94)", // Màu xanh lá
        tension: 0.3, // Độ cong của đường
        pointRadius: 5, // Độ lớn điểm
        pointBackgroundColor: "rgb(34, 197, 94)", // Màu điểm
        spanGaps: true
      },
    ] : [
      {
        label: "Áp suất hôm qua (Bar)",
        data: profs.data[profs.name.id]?.sensorYRest,
        borderColor: "rgb(59, 130, 246)", // Màu xanh
        tension: 0.3, // Độ cong của đường
        pointRadius: 5, // Độ lớn điểm
        pointBackgroundColor: "rgb(59, 130, 246)", // Màu điểm
        spanGaps: true
      },
      {
        label: "Áp suất hôm nay (Bar)",
        data: profs.data[profs.name.id]?.dataPressure,
        borderColor: "rgb(34, 197, 94)", // Màu xanh lá
        tension: 0.3, // Độ cong của đường
        pointRadius: 5, // Độ lớn điểm
        pointBackgroundColor: "rgb(34, 197, 94)", // Màu điểm
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
      title: {
        display: true, // Hiển thị tiêu đề
        text: profs.name.name, // Tên đồ thị
        font: {
          size: 12, // Kích thước chữ
          weight: "bold", // Độ dày chữ
        },
        color: "#333", // Màu chữ
        align: "center", // Căn giữa tiêu đề
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
  })

  useEffect(() => {
    setData((prevData) => ({
      ...prevData,
      labels: profs.label
    }));
  }, [profs.label])
  if(profs.dataModal){
    useEffect(() => {
      setData((prevData) => ({
        ...prevData,
        datasets: prevData.datasets.map((dataset) => {
            return {
              ...dataset,
              data: profs.dataModal[profs.name.id].dataPressure,
            };
        }),
      }));
                                                                                                
    }, [profs.dataModal[profs.name.id]]);
  }
  else{
    useEffect(() => {
      setData((prevData) => ({
        ...prevData,
        datasets: prevData.datasets.map((dataset, index) => {
          if (index === 1) {
            return {
              ...dataset,
              data: listDataSensor[profs.name.id] ? listDataSensor[profs.name.id] : profs.data[profs.name.id]?.dataPressure
            };
          }
          else{
            return {
              ...dataset,
              data: profs.data[profs.name.id]?.sensorYRest
            };
          }
        }),
      }));
                                                                                                
    }, [changeData, profs.data[profs.name.id]]);
  }
  return (
    <div className="w-full h-80 mb-3">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
};

export const Battery = ({step}) => {
  const [batteryLevel, setBatteryLevel] = useState(100);

  useEffect(() => {
    setBatteryLevel(battery[step]);
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

export const Table = ({ step, data, dataModal }) => {
  const [mockData, setMockData] = useState([]);
  if (dataModal) {
    useEffect(() => {
      console.log(dataModal[step])
      setMockData(dataModal[step].sensor);
    }, [])
  }
  else {
    useEffect(() => {
      setMockData(listDataTable[step])
    }, [changeData, data]);
  }

  return (
    <DataTable columns={columnsT}
      data={[...mockData].reverse()}
      keyField="_id"
      fixedHeader
      fixedHeaderScrollHeight="250px"
      striped
    />
  );
};


export default RealTimeLineChart;