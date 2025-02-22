import React, { useEffect, useState } from "react";
import { changeData } from "../sensor/SensorList";
import { listDataTable, TimeComparison } from "./Chart";
const ScrollableTable = (device) => {
  const [tableData, setTableData] = useState(listDataTable[device.step]);
  const [timeTracking, setTimeTracking] = useState([]);
  // Hàm xử lý cuộn
  const handleScroll = () => {
    let mode = ""
    if(device.dataModal){
      mode = "M"
    }
    const scrollContainer = document.getElementById(mode + device.step);
    const scrollTop = scrollContainer.scrollTop; // Lấy vị trí cuộn
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    device.handle((prevStates) => {
      const updatedStates = [...prevStates]; // Sao chép mảng cũ
      updatedStates[device.step] = Math.floor(scrollTop / (maxScroll / 1435)); // Cập nhật phần tử tại index
      return updatedStates; // Trả về mảng mới
    });
  };
  if (!device.dataModal) {
    useEffect(() => {
      setTableData(listDataTable[device.step])
    }, [changeData])
  }
  else{
    useEffect(() => {
      setTableData(device.dataModal[device.step].sensorT)
    }, []);
  }

  return (
    <div
      id={device.dataModal? "M" + device.step : "" + device.step}
      onScroll={handleScroll}
      className="max-h-60 overflow-y-scroll border border-gray-300 w-full" // Đặt chiều cao đủ cho 5 dòng
    >
      <table className="border-collapse w-full">
        <thead className="bg-gray-200 sticky top-0">
          <tr>
            <th className="border border-gray-300 px-4 py-2">Thời gian</th>
            <th className="border border-gray-300 px-4 py-2">Áp suất (Bar)</th>
            <th className="border border-gray-300 px-4 py-2">Nhiệt độ (°C)</th>
            <th className="border border-gray-300 px-4 py-2">Pin (%)</th>
          </tr>
        </thead>
        <tbody>
          {!tableData ? (
            <h1>Loading...</h1>
          ) : (
            tableData.map((row, index) => (
              <tr key={index}>
                <td className="border border-gray-300 px-4 py-2">{`${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}`}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{row?.Pressure.toFixed(2) ?? ""}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{row?.temperature ?? ""}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">
                  {row?.battery != null ? `${row.battery}%` : ""}
                </td>
              </tr>
            )))}
        </tbody>
      </table>
    </div>
  );
};

export default ScrollableTable;
