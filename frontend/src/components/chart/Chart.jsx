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
const pointLage = 0
//end define

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

export const connectMqtt = (timeTrackingRet, info, idMap) => {
  const [data, setData] = useState();
  const host = 'iotwater2024.mooo.com';
  const port = 9001;
  const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
  const connectUrl = `wss://${host}:${port}/mqtt`;
  const topic = 'iotwatter@2024';
  // let check = false;
  const options = {
    clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 5000,
  }
  const client = mqtt.connect(connectUrl, options);
  
  timeReach = timeTrackingRet;
  useEffect(() => {

    const semaphore = new Sema(1);
    client.on('connect', () => {
      console.log('Connected to MQTT broker');
    });

    client.on('message', async (topic, messageData) => {
      await semaphore.acquire();
      try {
        messageData = JSON.parse(messageData.toString());
        const sen_name = idMap[Number(messageData.n)];
        const msg_id = Number(messageData.m);
        if (msg_id === 1 && sen_name != null) {
          const dataMess = messageData.d
          const lastValue = dataMess[dataMess.length - 1];
          battery[sen_name] = lastValue.b || messageData.b;
          flowsum[sen_name] = messageData.s;
          temperature[sen_name] = messageData.t;
          let currentStart = dataMess[0].t * 1000;
          dataMess.forEach(async (mess, index) => {
            const message = {
              createAt: mess.t,
              Pressure: mess.p,
              flow: mess.f,
              battery: mess.b || messageData.b
            }
            message.createAt = message.createAt * 1000
            if (message.Pressure >= info[sen_name].tracking) {
              timeReach[sen_name] += Math.floor((message.createAt - currentStart) / 60000)
            }
            currentStart = message.createAt
            await addData(sen_name, message, message.createAt, message.Pressure, info[sen_name].watch);
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

export const ChartMadal = (profs) => {
  const chartRef = useRef(null);
  const chartData = {
    labels: profs.dataLabel.labels,
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
  const options = {
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
      x: { min: 0, 
        max: profs.length, 
        grid: { display: false },
        ticks: {
          autoSkip: false,
          callback: function (value, index, ticks) {
            const label = profs.dataLabel.labels[index];
            const lengthLabels = profs.dataLabel.labels.length
            if (label.includes('-')) return label
            const hour = parseInt(label.split(':')[0]);
            const minute = parseInt(label.split(':')[1]);
            if(lengthLabels < 288){
              if (minute === 0) return label;
            }
            else if(lengthLabels < 576){
              if (minute === 0 && hour % 2 === 0) return label;
            }
            else if(lengthLabels < 864){
              if (minute === 0 && hour % 3 === 0) return label;
            }
            else if(lengthLabels < 1152){
              if (minute === 0 && hour % 4 === 0) return label;
            }
            else if(lengthLabels < 1728){
              if (minute === 0 && hour % 6 === 0) return label;
            }
            else if(lengthLabels < 2340){
              if (minute === 0 && hour % 8 === 0) return label;
            }
            else if(lengthLabels < 3456){
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
        max: 300,
        grid: { drawOnChartArea: false }, // Ẩn lưới của trục này
      },
    },
  };


  return (
    <div className="w-full h-60 mb-3">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
}

const RealTimeLineChart = (profs) => {
  const chartRef = useRef(null);
  const [chartData, setData] = useState({
    labels: profs.label,
    datasets: [
      {
        label: "Áp(m)",
        data: profs.data.dataPressure,
        borderColor: "#FF0000", // Màu xanh lá
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: "#FF0000", // Màu điểm
        yAxisID: "y1",
        spanGaps: true
      },
      {
        label: "Áp cùng kỳ(m)",
        data: profs.data.sensorYRest,
        borderColor: "#000000", // Màu xanh
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: "#000000", // Màu điểm
        yAxisID: "y1",
        spanGaps: true
      },
      {
        label: "Lưu lượng(m3/h)",
        data: profs.data.dataFlow,
        borderColor: "#000080", // Màu xanh
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: "#000080", // Màu điểm
        yAxisID: "y2",
        spanGaps: true
      },
      {
        label: "Lưu lượng cùng kỳ(m3/h)",
        data: profs.data.flowYRest,
        borderColor: "#FFFF00", // Màu xanh
        tension: 0.1, // Độ cong của đường
        pointRadius: pointLage, // Độ lớn điểm
        borderWidth: 1,
        pointBackgroundColor: "#FFFF00", // Màu điểm
        yAxisID: "y2",
        spanGaps: true
      },
    ],
  })

  // Tùy chọn biểu đồ
  const [options, setOptions] = useState({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'nearest', // <<== điểm gần nhất
      axis: 'x', // hoặc 'xy' nếu muốn cả 2 chiều
      intersect: false, // <<== quan trọng: không cần trỏ đúng vào điểm
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          boxWidth: 10, // Điều chỉnh kích thước ô vuông
        },
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
        max: profs.label?.length,
        grid: {
          display: false,
        },
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
        max: 300,
        grid: { drawOnChartArea: false }, // Ẩn lưới của trục này
      },
    },
  })

  useEffect(() => {
    setData((prevData) => {
      prevData.datasets[0].data = listDataSensor[profs.name];
      prevData.datasets[2].data = flowDataSensor[profs.name];
      return prevData;
    });
  }, [changeData]);

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
    <div className="w-full h-60">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
};

export const Battery = ({step, data, temp, dataInfo}) => {
  const [batteryLevel, setBatteryLevel] = useState(data);
  const [tem, setTempurature] = useState(temp);
  const [signalStrength, setSingnals] = useState(0)
  useEffect(() => {
    setBatteryLevel(battery[step] || data);
    setTempurature(temperature[step] || temp)
    if (battery[step]) {
      setSingnals(3)
    }
    setTimeout(() => {
      setSingnals(0)
    }, dataInfo?.interval * 1000 + 40000);
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
        className={`w-1 ${signalStrength >= index + 1 ? "bg-green-500" : "bg-gray-300"}`}
        style={{ height: `${height}%` }}
      ></div>
    ));
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="w-12 h-8 flex items-center justify-center bg-blue-200 text-blue-800 font-bold rounded-md">
        {tem}°C
      </div>
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
  const [timeMoreThan, setTimeMoreThan] = useState(profs.init)
  if (!profs.dataModal) {
    useEffect(() => {
      setTimeMoreThan(timeReach[profs.step]);
    }, [changeData]);
  }
  return (
    <div className="flex items-center w-1/2">
      <span className="text-sm font-medium text-gray-700 mr-2">
        Lớn hơn <span className="text-red-600">{profs.info?.tracking}</span>m:
      </span>
      <span className="text-lg font-bold text-teal-700">{Math.floor(timeMoreThan / 60)}H{timeMoreThan % 60}P</span>
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
    <div className="flex">
      <p className='text-sm'>max: {profs.pram?.max}</p>
      <p className='ml-3 text-sm'>min: {profs.pram?.min}</p>
      <p className='ml-3 text-sm'>avg: {profs.pram?.avg?.toFixed(2)}</p>
      <p className='ml-3 text-sm'>total: {total}</p>
      <p className='ml-3 text-sm'>total24: {profs.pram?.total24?.toFixed(1)}</p>
      <p className='ml-3 text-sm'>sum: {sumFlow}</p>
    </div>
  );
};




export default RealTimeLineChart;
