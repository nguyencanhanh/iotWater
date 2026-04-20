import React, { useEffect, useState } from "react";
import { useAuth } from '../../context/authContext'
// import { Link } from "react-router-dom";
import { Battery, battery } from "../chart/Chart";
import RealTimeLineChart, { addDataSensor, connectMqtt, TimeComparison, Param, ParamFlow } from "../chart/Chart";
import ModalData from "../chart/Modal";
import { sensorListGet, getSensorInGroup } from "../../api/index"
import SettingsButton, {initData} from "../setting/Setting";
import ScrollableTable from "../chart/Table";
import EditComponent from "./EditComponent";
import { useLocation, useParams } from "react-router-dom";
import { produce } from "immer";

export let changeData

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

const laInit = (info) => {
  const la = []
  for (let i = 0; i < info.length; i++) {
    la.push(generateLabelsAndData(info[i].watch))
  }
  return la
}

const currentTime = (info) => {
  const currentT = []
  const currentDate = new Date();
  for (let i = 0; i < info.length; i++) {
    currentT.push((currentDate.getHours() * 60 + currentDate.getMinutes()) / 1440)
  }
  return currentT
}


function SensorList() {
  const { user } = useAuth()
  const groupPram = useParams().group
  const groupID = useLocation().state.sensorIDs;
  const idMap = useLocation().state.sensorMap
  const [sensorLoading, setSensorLoading] = useState(false);
  const [dateData, setDateData] = useState([])
  const [dataPressure, setDataPressure] = useState(null)
  const [filteredDevices, setFilteredDevices] = useState(groupID);
  const [dataInfo, setdataInfo] = useState(groupID);
  const [showModal, setShowModal] = useState(false);
  const [pram, setPram] = useState([]);
  const [pramFlow, setPramFlow] = useState([]);
  const [timeTracking, setTimeTracking] = useState([]);
  const [batteryInit, setBatteryInit] = useState([]);
  const [temp, setTemp] = useState([]);
  const [isViEdit, setIsEdit] = useState(Array(groupID.length).fill(false));
  const [scrollPosition, setScrollPosition] = useState(Array(groupID.length).fill(0));
  const fetchSetting = async (total, info) => {
    try {
      const res = await getSensorInGroup(localStorage.getItem("token"), `group=${encodeURIComponent(groupPram)}&user=${encodeURIComponent(user.user)}`);
      if (res.data.success) {
        const resInfo = res.data.senInGroup
        setdataInfo(resInfo)
        setFilteredDevices(resInfo)
        fetchSensors(resInfo.length, resInfo)
      } else {
        alert("Failed to fetch sensors");
      }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  };
  const fetchSensors = async (total, info) => {
    try {
      const startOfToday = new Date();
      const res = await sensorListGet(localStorage.getItem("token"), { total: total, info: info, user: user.user, date: [startOfToday, null] });
      if (res.data.success) {
        const data = res.data.sensors
        data.forEach((sensor, index) => {
          addDataSensor(index, sensor.sensorT, sensor.dataPressure, sensor.dataFlow)
        })
        setTimeTracking(res.data.timeTrackingRet)
        setBatteryInit(res.data.battery)
        setTemp(res.data.temperature)
        setPram(res.data.pram)
        setPramFlow(res.data.pramFlow)
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
    fetchSetting()
    battery.length = 0;
  }, []);
  changeData = connectMqtt(timeTracking, dataInfo, idMap)


  const filterSensor = (e) => {
    const records = dataInfo.filter((dep) => dep.name.toLowerCase().includes(e.target.value.toLowerCase()))
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
            {/* <Link
              to="/admin-dashboard/add-sensors"
              className="px-4 py-1 bg-teal-600 rounded text-white"
            >
              Thêm cảm biến
            </Link>  */}
            {/* <DateCom handleData={handleData} />
            <Dropdown /> */}
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-4 w-full">
            {!dataPressure ? (
              <div className="flex justify-center items-center h-screen">
                <div>Loading...</div>
              </div>
            ) : (filteredDevices.map((device) => {
              const step = idMap[device.id]
              return (
                <li className="flex flex-col items-center w-full sm:w-[560px] md:w-[600px] bg-gray-200 p-4 rounded-lg shadow" key={device.id}>
                  <div className="flex w-full justify-between items-center mb-4" >
                    <button
                      className="px-3 py-1 bg-teal-600 text-white rounded"
                      onClick={() => setIsEdit(prevData =>
                        produce(prevData, draft => {
                          draft[step] = !draft[step];
                        })
                      )}
                    >
                      Thông tin
                    </button>
                    <h3 className="text-lg font-bold">{device.name} ({dataInfo[step].id})</h3>
                    <Battery step={step} temp={temp[step]} data={batteryInit[step]} dataInfo={dataInfo[step]} />
                    {isViEdit[step] ? <EditComponent step={step} id={dataInfo[step].id} setIsEdit={setIsEdit} /> : null}
                  </div>
                  <div className="flex w-full justify-between" >
                    <TimeComparison step={step} init={timeTracking[step]} info={groupID[step]} />
                    <SettingsButton total={groupID.length}
                      info={dataInfo}
                      setdataInfo={setdataInfo}
                      handleData={handleData}
                      adj={device.adj}
                      step={step}
                    />
                  </div>
                  <div className="flex w-full justify-between">
                    <Param pram={pram[step]} />
                    <button
                      onClick={() => initData(dataInfo)}
                      className="px-5 transition"
                      title="Khởi tạo lại dữ liệu ban đầu"
                    >
                      🔄
                    </button>
                  </div>
                  <ParamFlow step={step} pram={pramFlow[step]} />
                  <RealTimeLineChart name={step} adj={device.adj} label={laInit(dataInfo)[step]} data={dataPressure[step]} scrollPosition={scrollPosition[step]} />
                  <ScrollableTable step={step} watch={dataInfo[step].watch} adj={device.adj} currentTimeDate={currentTime(dataInfo)[step]} handle={setScrollPosition} data={dataPressure[step]} />
                </li>
              )
            }))}
            {showModal ? <ModalData dateData={dateData} info={dataInfo} idMap={idMap} isOpen={showModal} handleCancel={() => setShowModal(false)} /> : null}
          </ul>
        </div>
      )}
    </>
  );
}

export default SensorList;
