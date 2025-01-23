import React, { useEffect, useState } from "react";
import { useAuth } from '../../context/authContext'
import { Link, useNavigate } from "react-router-dom";
import { Battery } from "../chart/Chart";
import RealTimeLineChart, { addDataSensor, connectMqtt, Table, TimeComparison } from "../chart/Chart";
import Date from "../chart/Date";
import ModalData from "../chart/Modal";
import { sensorListGet } from "../../api/index"
import Dropdown from "./DropBar";
import SettingsButton from "../setting/Setting";
import ScrollableTable from "../chart/Table";

export let changeData

function generateLabelsAndData() {
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
  const { user } = useAuth()
  const [sensorLoading, setSensorLoading] = useState(false);
  const [dateData, setDateData] = useState([])
  const [dataPressure, setDataPressure] = useState(null)
  const [filteredDevices, setFilteredDevices] = useState(user.sen_id);
  const [showModal, setShowModal] = useState(false);
  const [timeTracking, setTimeTracking] = useState([]);
  const label = generateLabelsAndData();
  const [isVisible, setIsVisible] = useState(true);
  const [scrollPosition, setScrollPosition] = useState(Array(user.total).fill(0));
  const navigate = useNavigate();

  const fetchSensors = async (total, tracking) => {
    try {
      const res = await sensorListGet(localStorage.getItem("token"), { total: total, tracking: tracking });
      if (res.data.success) {
        const data = res.data.sensors
        data.forEach((sensor, index) => {
          addDataSensor(index, sensor.sensorT, sensor.dataPressure)
        })
        setDataPressure(data)
        setTimeTracking(res.data.timeTrackingRet)
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
    fetchSensors(user.total, user.tracking);
  }, []);

  changeData = connectMqtt()
  const filterSensor = (e) => {
    const records = user.sen_id.filter((dep) => dep.name.toLowerCase().includes(e.target.value.toLowerCase()))
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
            <Date handleData={handleData} />
            <Dropdown />
            <SettingsButton interval={user.interval} sample={user.sample} setAp={setIsVisible} tracking={user.tracking} trackingB={user.trackingB} fetchData={fetchSensors}/>
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-4 w-full">
            {!dataPressure ? (
              <div className="flex justify-center items-center h-screen">
                <div>Loading...</div>
              </div>
            ) : (filteredDevices.map((device) => (
              <li className="flex flex-col items-center w-full sm:w-[560px] md:w-[600px] bg-gray-200 p-4 rounded-lg shadow" key={device.id}>
                <div className="flex w-full justify-between items-center mb-4" >
                  <Battery step={device.id} />
                  <button
                    className="px-3 py-1 bg-teal-600 text-white rounded"
                    onClick={() => navigate(`/admin-dashboard/sensor/${device.id}`)}
                  >
                    Đổi tên
                  </button>
                </div>
                {isVisible ? <TimeComparison step={device.id} init={timeTracking}/> : null}
                <RealTimeLineChart name={device} label={label} data={dataPressure} scrollPosition={scrollPosition}/>
                {/* <Table step={device.id} /> */}
                <ScrollableTable step={device.id} handle={setScrollPosition}/>
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