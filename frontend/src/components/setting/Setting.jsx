import React, { useState } from "react";
import SetInterval from "../sensor/SetInterval";
const SettingsButton = (profs) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
      >
        Cài đặt
      </button>

      {isOpen && (
        <div
          className="absolute right-0 justify-between rounded shadow bg-teal-600 w-56"
          style={{ maxHeight: "200px", overflowY: "auto" }} // Tùy chọn cuộn nếu danh sách quá dài
        >
          <ul className="py-1">
            <li>
              <div className="flex justify-between items-center">
                <div className="text-white rounded">Thoi gian hien thi:</div>
                <select className="bg-teal-600 rounded text-white" value={profs.value} onChange={profs.handle}>
                  <option value={15}>15 giay</option>
                  <option value={60}>1 phut</option>
                  <option value={300}>5 phut</option>
                  <option value={600}>10 phut</option>
                  <option value={900}>15 phut</option>
                  <option value={1800}>30 phut</option>
                  <option value={3600}>1 gio</option>
                </select>
              </div>
            </li>
            <li><SetInterval interval={profs.interval} setClose={setIsOpen}/></li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SettingsButton;
