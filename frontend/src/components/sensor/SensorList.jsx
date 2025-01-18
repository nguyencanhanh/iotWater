import React, { useEffect, useState } from "react";
import { useAuth } from '../../context/authContext'
import { Link, useNavigate } from "react-router-dom";
import { Battery } from "../chart/Chart";
import RealTimeLineChart, { addDataSensor, connectMqtt, Table } from "../chart/Chart";
import Date from "../chart/Date";
import ModalData from "../chart/Modal";
import { sensorListGet } from "../../api/index"
import Dropdown from "./DropBar";
import SettingsButton from "../setting/Setting";

export let changeData
export let intervalRep = 15

export function generateLabelsAndData(interval) {
  const labels = [];
  const totalSecondsInDay = 24 * 60 * 60;

  for (let i = 0; i < totalSecondsInDay; i += interval) {
    const totalSeconds = i;
    const hour = Math.floor(totalSeconds / 3600);
    const minute = Math.floor((totalSeconds % 3600) / 60);
    const second = totalSeconds % 60;
    if (interval === 3600) {
      labels.push(`${String(hour).padStart(2, "0")}`);
    }
    else if (interval === 15) {
      labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`);

    }
    else {
      labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);

    }
  }
  return labels;
};

function SensorList() {
  const { user } = useAuth()
  const [sensorLoading, setSensorLoading] = useState(false);
  const [dateData, setDateData] = useState([])
  const [dataPressure, setDataPressure] = useState(null)
  const [filteredDevices, setFilteredDevices] = useState(user.sen_id);
  const [showModal, setShowModal] = useState(false);
  const [interval, setInterval] = useState(15);
  const [label, setLabel] = useState(generateLabelsAndData(15));
  const navigate = useNavigate();

  const fetchSensors = async (interval) => {
    try {
      const res = await sensorListGet(localStorage.getItem("token"), { total: user.total, interval: interval });
      if (res.data.success) {
        const data = res.data.sensors
        data.forEach((sensor, index) => {
          addDataSensor(index, sensor.sensorT, sensor.dataPressure)
        })
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
    fetchSensors();
  }, []);

  changeData = connectMqtt(interval)
  const filterSensor = (e) => {
    const records = user.sen_id.filter((dep) => dep.name.toLowerCase().includes(e.target.value.toLowerCase()))
    setFilteredDevices(records)
  }

  const handleData = async (data) => {
    setShowModal(true);
    setDateData(data)
  }

  const handleIntervalChange = (e) => {
    const value = parseInt(e.target.value, 10);
    intervalRep = value
    setInterval(value);
    setLabel(generateLabelsAndData(value))
    fetchSensors(value)
  };

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
            {/* <Link
              to="/admin-dashboard/add-sensors"
              className="px-4 py-1 bg-teal-600 rounded text-white"
            >
              Thêm cảm biến
            </Link> */}
            <Date handleData={handleData} />
            <Dropdown />
            <SettingsButton interval={user.interval} value={interval} handle={handleIntervalChange} />
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-4">
            {!dataPressure ? (
              <div className="flex justify-center items-center h-screen">
                <div>Loading...</div>
              </div>
            ) : (filteredDevices.map((device) => (
              <li className="flex flex-col items-center w-full sm:w-[600px] md:w-[600px] bg-gray-200 p-4 rounded-lg shadow" key={device.id}>
                <div className="flex w-full justify-between items-center mb-4" >
                  <Battery step={device.id} />
                  <button
                    className="px-3 py-1 bg-teal-600 text-white rounded"
                    onClick={() => navigate(`/admin-dashboard/sensor/${device.id}`)}
                  >
                    Đổi tên
                  </button>
                </div>
                <RealTimeLineChart name={device} label={label} data={dataPressure} />
                <Table step={device.id} data={dataPressure} />
              </li>
            )))
            }
            {showModal ? <ModalData dateData={dateData} listInfor={user.sen_id} isOpen={showModal} handleCancel={() => setShowModal(false)} /> : null}
          </ul>
        </div>
      )}
    </>
  );
}

export default SensorList;