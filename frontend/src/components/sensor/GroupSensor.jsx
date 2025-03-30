import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom'
import { getGroupInfo } from "../../api";
import { useAuth } from '../../context/authContext'

function GroupSensor() {
  const {user} = useAuth()
  const navigate = useNavigate()
  const [dataGroup, setDataGroup] = useState({})
  const [currentData, setCurrentData] = useState([])
  const fetchSensors = async () => {
    try {
      const res = await getGroupInfo(localStorage.getItem("token"), {user: user.user});
      if (res.data.success) {
        setCurrentData(res.data.valueSenS)
        setDataGroup(res.data.data)
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
  useEffect(() => {
    fetchSensors();
  }, []);

  const handleGroupClick = (group) => {
    const sensorMap = {}
    const sensorIDs = dataGroup[group].map(sensor => sensor); // Lấy danh sách ID
    sensorIDs.forEach((element, index) => {
      sensorMap[element.id] = index
    });
    navigate(`/admin-dashboard/sensors/${group}`,{state: {sensorIDs: sensorIDs, sensorMap: sensorMap}})
  };

  return (
    <table className="border-collapse border border-gray-300 w-full p-5">
      <thead>
        <tr className="bg-gray-200">
          {/* <th className="border border-gray-300 p-2">Tên nhóm</th> */}
          <th className="border border-gray-300 p-2">ID</th>
          <th className="border border-gray-300 p-2">Tên cảm biến</th>
          <th className="border border-gray-300 p-2">Áp suất</th>
          <th className="border border-gray-300 p-2">Lưu lượng</th>
          <th className="border border-gray-300 p-2">Pin</th>
        </tr>
      </thead>
      {!dataGroup ? (
        <div className="flex justify-center items-center h-screen">
          <div>Loading...</div>
        </div>
      ) : (
        <tbody>
          {Object.keys(dataGroup).map((group, index) => (
            <React.Fragment key={index}>
              {/* Hàng Group (Nhấn vào để lấy danh sách ID cảm biến) */}
              <tr
                className="bg-blue-100 cursor-pointer hover:bg-blue-200"
                onClick={() => handleGroupClick(group)}
              >
                <td className="border border-gray-300 p-2 font-bold" colSpan={6}>
                  {group}
                </td>
              </tr>
              {/* Hàng Sensor trong Group */}
              {dataGroup[group].map((sensor, i) => (
                <tr key={i} className="hover:bg-gray-100">
                  {/* <td className="border border-gray-300 p-2"></td> */}
                  <td className="border border-gray-300 p-2">{sensor.id}</td>
                  <td className="border border-gray-300 p-2">{sensor.name}</td>
                  <td className="border border-gray-300 p-2">{currentData[sensor.id]?.Pressure}</td>
                  <td className="border border-gray-300 p-2">{currentData[sensor.id]?.Flow}</td>
                  <td className="border border-gray-300 p-2">{currentData[sensor.id]?.battery}%</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      )}
    </table>
  );
}

export default GroupSensor