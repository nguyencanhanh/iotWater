import React, { useState } from "react";


const ScrollableTable = (device) => {
  // Tạo dữ liệu bảng
  const generateData = () => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)); // 00:00 của ngày hiện tại
    const data = Array.from({ length: 1440 }, (_, index) => {
      const currentTime = new Date(startOfDay.getTime() + index * 60000); // Mỗi phút
      return {
        time: currentTime.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }), // Thời gian
        pressure: (Math.random() * 10).toFixed(2), // Áp suất ngẫu nhiên (0-10 bar)
        temperature: (20 + Math.random() * 10).toFixed(1), // Nhiệt độ ngẫu nhiên (20-30 °C)
        battery: Math.floor(Math.random() * 101), // Pin ngẫu nhiên (0-100%)
      };
    });
    return data;
  };

  const [tableData, setTableData] = useState(generateData);

  // Hàm xử lý cuộn
  const handleScroll = () => {
    const scrollTop = document.getElementById("device" + device.step).scrollTop; // Lấy vị trí cuộn
    device.handle((prevStates) => {
      const updatedStates = [...prevStates]; // Sao chép mảng cũ
      updatedStates[device.step] = Math.floor(scrollTop / 41); // Cập nhật phần tử tại index
      return updatedStates; // Trả về mảng mới
    });
  };

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
                <td className="border border-gray-300 px-4 py-2">{row.time}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{row.pressure}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{row.temperature}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{row.battery}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
  );
};

export default ScrollableTable;
