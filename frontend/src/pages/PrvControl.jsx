import React, { useEffect, useState } from 'react';
// import ValveScheduleControl from '../components/prv/TimeAlarm'
import SettingsPanel from '../components/prv/settingPrv'
import { ChartPrv } from "../components/chart/Chart";
import mqtt from "mqtt";
import { useAuth } from "../context/authContext";
import { getPrv, getAllPrv } from '../api/index';
import { produce } from "immer";

function generateLabelsAndData(watch) {
  const labels = [];

  for (let i = 0; i < 1440; i += watch / 60) {
    const totalSeconds = i;
    const hour = Math.floor(totalSeconds / 60);
    const minute = i % 60
    labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return labels;
};

const CurrentData = ({ prvData, name }) => {
  return (
    <div className="inline-block border rounded-2xl shadow-md p-4 bg-white">
      {/* Tiêu đề */}
      <div className="text-lg font-semibold mb-3 col-span-2 text-center">
        {name}
      </div>
      {/* Nội dung dạng lưới */}
      <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-base text-left h-full pb-6">
        <div>Áp Lực Trước Van</div>
        <div>: {prvData?.p2} (m)</div>

        <div>Áp Lực Sau Van</div>
        <div>: {prvData?.p1} (m)</div>

        <div>Áp Lực Điểm Cuối</div>
        <div>: {prvData?.i} (m)</div>

        <div>Lưu lượng</div>
        <div>: {prvData?.f} (m3/h)</div>
      </div>
    </div>
  )
}

const ControlData = ({ control }) => {
  return (
    <div className="border border-gray-300 rounded-lg shadow-md p-4 bg-white">
      {/* Tiêu đề cố định */}
      <div className="grid grid-cols-4 bg-gray-100 font-bold text-center border-b border-gray-300">
        <div className="py-2 px-2">Thời gian</div>
        <div className="py-2 px-2">Van điều khiển (m)</div>
        <div className="py-2 px-2">Thời gian điều khiển (s)</div>
        <div className="py-2 px-2">Biên độ dao động (m)</div>
      </div>

      {/* Dữ liệu cuộn được */}
      <div className="max-h-40 overflow-y-auto divide-y divide-gray-200">
        {control?.map((item, idx) => (
          <div
            key={idx}
            className="grid grid-cols-4 text-center py-2 px-2 hover:bg-gray-50"
          >
            <div>
              {new Date(item.createAt).toLocaleTimeString('vi-VN', {
                timeZone: 'Asia/Ho_Chi_Minh'
              })}
            </div>
            <div>{item.control}</div>
            <div>{item.time}</div>
            <div>{item.min} → {item.max}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// function getPrvData() {
//   const raw = localStorage.getItem('prv_d');
//   if (!raw) return null;
//   const obj = JSON.parse(raw);
//   // if (Date.now() > obj.expire) {
//   //   localStorage.removeItem('prv_d');
//   //   return null;
//   // }
//   return obj.value;
// }

export default function PrvControl() {
  const { user } = useAuth();
  // const [schedules, setSchedules] = useState([]);
  const [name_prv, setSchsetNamePrv] = useState();
  const [allPrv, setAllPrv] = useState();
  const [showSettings, setShowSettings] = useState(false);
  const [dataPrv1, setDataPrv1] = useState([]);
  const [dataPrv2, setDataPrv2] = useState([]);
  const [dataPrv3, setDataPrv3] = useState([]);
  const [flowData, setFlowData] = useState([]);
  const [control, setControl] = useState([]);
  const [dataset, setDataset] = useState([])
  // const [pressureTop, setPressureTop] = useState([]);
  const [prvData, setPrvData] = useState({});
  const [selectedIndex, setSelectedIndex] = useState(localStorage.getItem('name_prv') || 0);
  const label = generateLabelsAndData(60)

  const host = "iotwater2024.mooo.com";
  const port = 9001;
  const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
  const connectUrl = `wss://${host}:${port}/mqtt`;
  const topic = "prv/send";
  const options = { clientId, clean: true, connectTimeout: 4000, reconnectPeriod: 5000 };
  const client = mqtt.connect(connectUrl, options);
  useEffect(() => {
    // localStorage.removeItem("prv_d");
    client.on("connect", () => console.log("Connected to MQTT broker"));
    client.on("message", (topic, messageData) => {
      messageData = JSON.parse(messageData.toString());
      if (!messageData.p1) return
      setPrvData(prevData =>
        produce(prevData, draft => {
          draft[messageData.n] = messageData;
        })
      );
    });
    client.subscribe(topic);

    return () => {
      client.end();
    };
  }, []);
  // useEffect(() => {
  //   localStorage.setItem('prv_d', JSON.stringify({prvData:prvData, expire: Date.now() + 10000 }))
  // }, [prvData])
  // const updateSchedules = (list) => {
  //   const sorted = [...list].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
  //   setSchedules(sorted);
  // };
  const fetchPrv = async (id) => {
    try {
      const res = await getPrv(localStorage.getItem("token"), { user: user.user, prv_name: id });
      if (res.data.success) {
        setSchsetNamePrv(res.data.info)
        // updateSchedules(res.data.time)
        setDataPrv1(res.data.prvDataP1)
        setDataPrv2(res.data.prvDataP2)
        setDataPrv3(res.data.prvDataP3)
        setFlowData(res.data.prvDataF)
        setControl(res.data.control)
        setDataset([
          {
            label: "Áp suất trước van",
            data: res.data.prvDataP2,
            borderColor: "#FF0000", // Màu xanh lá
            tension: 0.1, // Độ cong của đường
            borderWidth: 1,
            pointRadius: 0, // Độ lớn điểm
            pointBackgroundColor: "#FF0000", // Màu điể
            yAxisID: "y1",
            spanGaps: true
          },
          {
            label: "Áp suất sau van",
            data: res.data.prvDataP1,
            borderColor: "#FF9933", // Màu xanh lá
            tension: 0.1, // Độ cong của đường
            borderWidth: 1,
            pointRadius: 0, // Độ lớn điểm
            pointBackgroundColor: "#FF9933", // Màu điể
            yAxisID: "y1",
            spanGaps: true
          },
          {
            label: "Áp suất điểm bất lợi",
            data: res.data.prvDataP3,
            borderColor: "#000000", // Màu xanh lá
            tension: 0.1, // Độ cong của đường
            borderWidth: 1,
            pointRadius: 0, // Độ lớn điểm
            pointBackgroundColor: "#000000", // Màu điể
            yAxisID: "y1",
            spanGaps: true
          },
          {
            label: "Lưu lượng",
            data: res.data.prvDataF,
            borderColor: "#000080", // Màu xanh lá
            tension: 0.1, // Độ cong của đường
            borderWidth: 1,
            pointRadius: 0, // Độ lớn điểm
            pointBackgroundColor: "#000080", // Màu điể
            yAxisID: "y2",
            spanGaps: true
          },
    ])
      } else {
        alert("Failed to fetch prv");
      }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  }
  const fetchDataInfo = async () => {
    try {
      const resAll = await getAllPrv(localStorage.getItem("token"));
      if (resAll.data.success) {
        setAllPrv(resAll.data.info)
        fetchPrv(resAll.data.info[selectedIndex].id)
      } else {
        alert("Failed to fetch prv");
      }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  }

  useEffect(() => {
    fetchDataInfo()
  }, []);

  useEffect(() => {
    if (!allPrv) return;
    localStorage.setItem("name_prv", selectedIndex);
    fetchPrv(allPrv[selectedIndex].id)
  }, [selectedIndex]);

  return (
    <>
      {!name_prv ? (
        <div className="flex justify-center items-center h-screen">
          <div>Loading...</div>
        </div>
      ) : (
        <div className="p-5">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-2xl font-bold text-center flex-1">
              Van điều áp{" "}
              <select
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(Number(e.target.value))}
              >
                {allPrv.map((prv, index) => (
                  <option key={prv.id} value={index}>
                    {prv.name}
                  </option>
                ))}
              </select>
            </h3>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="text-gray-600 hover:text-gray-900 focus:outline-none p-2"
              title="Cài đặt"
            >
              ⚙️
            </button>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-4 w-full">
            {showSettings && (
              <div className="w-full">
                <SettingsPanel defaultData={name_prv} />
              </div>
            )}
            {/* <ValveScheduleControl updateSchedules={updateSchedules} sendCommandPrv={sendCommandPrv} schedules={schedules} id={0} user={user.user} /> */}
          </div>
          <div className="text-center mt-5">
            <h3 className="text-lg font-bold">Biểu đồ áp van</h3>
            <ChartPrv label={label} dataset={dataset}/>
          </div>
          <hr className="my-6 border-t-2 border-gray-300 w-full" />
          <div className="flex flex-wrap mt-5 gap-5 justify-center items-stretch">
            <CurrentData
              prvData={prvData[allPrv[selectedIndex].id]}
              name={allPrv[selectedIndex].name}
            />
            <ControlData
              control={control[allPrv[selectedIndex].id]}
            />
          </div>
          {allPrv
            .filter(prv => prv.id !== allPrv[selectedIndex].id)   // lọc bỏ id=1
            .map((prv, idx) => (
              <div key={idx}>
                <hr className="my-6 border-t-2 border-gray-300 w-full" />
                <div className="flex flex-wrap mt-5 gap-5 justify-center items-stretch">
                  <CurrentData
                    prvData={prvData[prv.id]}
                    name={prv.name}
                  />
                  <ControlData
                    control={control[prv.id]}
                  />
                </div>
              </div>
            ))}
        </div >
      )}
    </>
  );
}
