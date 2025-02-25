import React, { useEffect, useState } from "react";
import { useAuth } from '../../context/authContext'
import { Link, useNavigate } from "react-router-dom";
import { Battery } from "../chart/Chart";
import RealTimeLineChart, { addDataSensor, connectMqtt, TimeComparison } from "../chart/Chart";
import DateCom from "../chart/Date";
import ModalData from "../chart/Modal";
import { sensorListGet } from "../../api/index"
import Dropdown from "./DropBar";
import SettingsButton from "../setting/Setting";
import ScrollableTable from "../chart/Table";
import EditComponent from "./EditComponent";
import { produce } from "immer";


export let changeData

export function generateLabelsAndData() {
  const labels = [];

  for (let i = 0; i < 1440; i++) {
    const totalSeconds = i;
    const hour = Math.floor(totalSeconds / 60);
    const minute = i % 60
    labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
  }
  return labels;
};

function SensorList() {
  const currentDate = new Date();
  const currentTimeDate = (currentDate.getHours() * 60 + currentDate.getMinutes()) / 1435;
  const { user, info } = useAuth()
  const [sensorLoading, setSensorLoading] = useState(false);
  const [dateData, setDateData] = useState([])
  const [dataPressure, setDataPressure] = useState(null)
  const [filteredDevices, setFilteredDevices] = useState(info);
  const [dataInfo, setdataInfo] = useState(info);
  const [showModal, setShowModal] = useState(false);
  const [timeTracking, setTimeTracking] = useState([]);
  const [timeTrackingB, setTimeTrackingB] = useState([]);
  const [batteryInit, setBatteryInit] = useState([]);
  const label = generateLabelsAndData();
  const [sen_idModal, setsen_idModal] = useState(0)
  const [isViEdit, setIsEdit] = useState(Array(user.total).fill(false));
  const [scrollPosition, setScrollPosition] = useState(Array(user.total).fill(0));
  const [colorN, setColorN] = useState(localStorage.getItem("colorN") || "#FF0000");
  const [colorY, setColorY] = useState("#0000FF");

  const fetchSensors = async (total) => {
    try {
      const res = await sensorListGet(localStorage.getItem("token"), { total: total, info: info });
      if (res.data.success) {
        const data = res.data.sensors
        data.forEach((sensor, index) => {
          addDataSensor(index, sensor.sensorT, sensor.dataPressure)
        })
        setDataPressure(data)
        setTimeTracking(res.data.timeTrackingRet)
        setTimeTrackingB(res.data.timeTrackingRetB)
        setBatteryInit(res.data.battery)
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
    fetchSensors(user.total);
  }, []);

  changeData = connectMqtt(timeTracking, info, timeTrackingB)
  const filterSensor = (e) => {
    const records = info.filter((dep) => dep.name.toLowerCase().includes(e.target.value.toLowerCase()))
    setFilteredDevices(records)
  }

  const handleData = async (data) => {
    setShowModal(true);
    setDateData(data)
  }

  return (
    <>
      {sensorLoading ? (
        <div className="flex justify-center items-center h-screen">
          <div>Loading...</div>
        </div>
      ) : (
        <div className="p-5">
          <div className="text-center mb-4">
            <h3 className="text-2xl font-bold">Quản lý cảm biến</h3>
          </div>

          <div className="flex flex-wrap justify-between items-center mb-4">
            <input
              type="text"
              placeholder="Tìm kiếm cảm biến"
              className="border rounded"
              onChange={filterSensor}
            />
            <Link
              to="/admin-dashboard/add-sensors"
              className="px-4 py-1 bg-teal-600 rounded text-white"
            >
              Thêm cảm biến
            </Link>
            <DateCom handleData={handleData} />
            <Dropdown />
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-4 w-full">
            {!dataPressure ? (
              <div className="flex justify-center items-center h-screen">
                <div>Loading...</div>
              </div>
            ) : (filteredDevices.map((device) => (
              <li className="flex flex-col items-center w-full sm:w-[560px] md:w-[600px] bg-gray-200 p-4 rounded-lg shadow" key={device.id}>
                <div className="flex w-full justify-between items-center mb-4" >
                  <Battery step={device.id} data={batteryInit}/>
                  <h3 className="text-lg font-bold">{device.name}</h3>
                  <button
                    className="px-3 py-1 bg-teal-600 text-white rounded"
                    onClick={() => setIsEdit(prevData =>
                      produce(prevData, draft => {
                        draft[device.id] = !draft[device.id];
                      })
                    )}
                  >
                    Thông tin
                  </button>
                  {isViEdit[device.id] ? <EditComponent id={device.id} /> : null}
                </div>
                <div className="flex w-full justify-between border-b-2 border-gray-300 items-center mb-4" >
                  <TimeComparison step={device.id} init={timeTracking} initB={timeTrackingB} />
                  <SettingsButton total={user.total}
                    info={dataInfo}
                    setdataInfo={setdataInfo}
                    fetchData={fetchSensors}
                    handleData={handleData}
                    step={device.id}
                    colorN={colorN} setColorN={setColorN} colorY={colorY} setColorY={setColorY}
                  />
                </div>
                <RealTimeLineChart name={device} label={label} data={dataPressure} scrollPosition={scrollPosition} colorN={colorN} colorY={colorY}/>
                <ScrollableTable step={device.id} currentTimeDate={currentTimeDate} handle={setScrollPosition} />
              </li>
            )))
            }
            {showModal ? <ModalData dateData={dateData} info={info} id={sen_idModal} isOpen={showModal} handleCancel={() => setShowModal(false)} /> : null}
          </ul>
        </div>
      )}
    </>
  );
}

export default SensorList;