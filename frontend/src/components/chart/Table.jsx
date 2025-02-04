import React, { useEffect, useState } from "react";
import { changeData } from "../sensor/SensorList";
import { listDataTable } from "./Chart";

const ScrollableTable = (device) => {
  const [tableData, setTableData] = useState(listDataTable[device.step]);

  // Hàm xử lý cuộn
  const handleScroll = () => {
    const scrollContainer = document.getElementById("device" + device.step);
    const scrollTop = scrollContainer.scrollTop; // Lấy vị trí cuộn
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    device.handle((prevStates) => {
      const updatedStates = [...prevStates]; // Sao chép mảng cũ
      updatedStates[device.step] = Math.floor(scrollTop / (maxScroll / 1435)); // Cập nhật phần tử tại index
      return updatedStates; // Trả về mảng mới
    });
  };

  useEffect(() => {
    setTableData(listDataTable[device.step])
  }, [changeData])

  return (
    <div
      id={"device" + device.step}
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
          {tableData.map((row, index) => (
            <tr key={index}>
              <td className="border border-gray-300 px-4 py-2">{`${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}`}</td>
              <td className="border border-gray-300 px-4 py-2 text-center">{row?.pressure ?? ""}</td>
              <td className="border border-gray-300 px-4 py-2 text-center">{row?.temperature ?? ""}</td>
              <td className="border border-gray-300 px-4 py-2 text-center">
                {row?.battery != null ? `${row.battery}%` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScrollableTable;
