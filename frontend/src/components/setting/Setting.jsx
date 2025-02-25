import React, { useState, useEffect } from "react";
import SetInterval from "./SetInterval";
import SetSample from "./SetSample";
import { produce } from "immer";
import { intervalUpdatePut } from '../../api/index';
import DateM from '../chart/Date'

const colors = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FFA500",
  "#800080",
  "#008000",
  "#800000",
  "#008080",
  "#000080",
  "#808000",
  "#808080",
  "#C0C0C0",
  "#FFD700",
  "#FF4500",
  "#FF6347",
];


const SettingsButton = (profs) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingB, setIsEditingB] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingT, setIsEditingT] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!fromDate || !toDate) {
      return;
    }
    const fromTimestamp = new Date(fromDate).getTime();
    const toTimestamp = new Date(toDate).getTime();

  }, [fromDate, toDate]);

  const handleInputChange = (event) => {
    profs.setdataInfo(prevData =>
      produce(prevData, draft => {
        draft[profs.info[profs.step].id].tracking = event.target.value;
      })
    );
  };

  const handleInputChangeB = (event) => {
    profs.setdataInfo(prevData =>
      produce(prevData, draft => {
        draft[profs.info[profs.step].id].trackingB = event.target.value;
      })
    );  // Cập nhật giá trị khi người dùng nhập
  };

  const handleInputChangeT = (event) => {
    profs.setdataInfo(prevData =>
      produce(prevData, draft => {
        draft[profs.info[profs.step].id].temperature = event.target.value;
      })
    );
  };

  const handleSubmit = async () => {
    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), { tracking: profs.info[profs.step].tracking, sen_id: profs.info[profs.step].id })
      if (res.data.success) {
        setIsEditing(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
    finally {
      // profs.fetchSensors(profs.total, value, valueB)
    }
  };

  const handleSubmitB = async () => {
    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), { trackingB: profs.info[profs.step].trackingB, sen_id: profs.info[profs.step].id })
      if (res.data.success) {
        setIsEditingB(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };

  const handleSubmitT = async () => {
    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), { temp: profs.info[profs.step].temperature, sen_id: profs.info[profs.step].id })
      if (res.data.success) {
        setIsEditingT(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };

  const handleChangeColor = (event) => {
    profs.setColorN(event.target.value);
    localStorage.setItem("colorN", event.target.value);
  }

  return (
    <div className="relative inline-block text-left">
      {/* Nút cài đặt */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-5 py-3 text-sm"
      >
        ⚙️
      </button>

      {/* Thanh cài đặt hiển thị khi nút nhấn */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-teal-600 rounded-lg shadow-lg"
          style={{ maxHeight: "400px", overflowY: "auto" }}
        >
          <ul className="py-3 px-4 space-y-3">
            {/* Cài đặt thời gian hiển thị */}
            <li><SetSample info={profs.info} setdataInfo={profs.setdataInfo} step={profs.step} /></li>
            <li><SetInterval info={profs.info} setdataInfo={profs.setdataInfo} step={profs.step} /></li>
            <li>
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">Giá trị áp trên:</label>
                <div className="flex items-center space-x-2">
                  {isEditing ? (
                    <>
                      <input
                        id="input-value"
                        type="text"
                        value={profs.info[profs.step].tracking}
                        onChange={handleInputChange}
                        placeholder="Nhập giá trị"
                        className="px-2 py-1 rounded-lg text-black w-20"
                      />
                      <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg"
                      >
                        OK
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Nếu không chỉnh sửa, hiển thị giá trị */}
                      <span className="text-white">{profs.info[profs.step].tracking || 1.5} Bar</span>
                      <button
                        onClick={() => setIsEditing(true)} // Chuyển sang chế độ chỉnh sửa
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg shadow-md hover:bg-teal-600 transition-all duration-200"
                      >
                        Chỉnh sửa
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>

            <li>
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">Giá trị áp dưới:</label>
                <div className="flex items-center space-x-2">
                  {/* Nếu đang trong chế độ chỉnh sửa, hiển thị ô nhập */}
                  {isEditingB ? (
                    <>
                      <input
                        id="input-value"
                        type="text"
                        value={profs.info[profs.step].trackingB}
                        onChange={handleInputChangeB}
                        placeholder="Nhập giá trị"
                        className="px-2 py-1 rounded-lg text-black w-20"
                      />
                      <button
                        onClick={handleSubmitB}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg"
                      >
                        OK
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Nếu không chỉnh sửa, hiển thị giá trị */}
                      <span className="text-white">{profs.info[profs.step].trackingB || 1.5} Bar</span>
                      <button
                        onClick={() => setIsEditingB(true)} // Chuyển sang chế độ chỉnh sửa
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg shadow-md hover:bg-teal-600 transition-all duration-200"
                      >
                        Chỉnh sửa
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>

            <li>
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">Ngưỡng nhiệt độ:</label>
                <div className="flex items-center space-x-2">
                  {/* Nếu đang trong chế độ chỉnh sửa, hiển thị ô nhập */}
                  {isEditingT ? (
                    <>
                      <input
                        id="input-value"
                        type="text"
                        value={profs.info[profs.step].temperature}
                        onChange={handleInputChangeT}
                        placeholder="Nhập giá trị"
                        className="px-2 py-1 rounded-lg text-black w-20"
                      />
                      <button
                        onClick={handleSubmitT}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg"
                      >
                        OK
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Nếu không chỉnh sửa, hiển thị giá trị */}
                      <span className="text-white">{profs.info[profs.step].temperature || 45} ℃</span>
                      <button
                        onClick={() => setIsEditingT(true)} // Chuyển sang chế độ chỉnh sửa
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg shadow-md hover:bg-teal-600 transition-all duration-200"
                      >
                        Chỉnh sửa
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
            <li>
              {/* <DateM handleData={profs.handleData}/> */}
              <div className="flex space-x-4 mb-4">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border px-2 py-1"
                />
                <span className="text-white">đến</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border px-2 py-1"
                />
              </div>
            </li>
            <li>
              <div className="ml-1 flex justify-between justify-center">
                <div className='text-white rounded'>Màu đồ thị hôm nay:</div>
                <select
                  className="p-2 border rounded-lg shadow-md"
                  style={{ backgroundColor: profs.colorN }}
                  value={profs.colorN}
                  onChange={handleChangeColor}
                >
                  {colors.map((color) => (
                    console.log(profs.colorN),
                    <option key={color} value={color} style={{ backgroundColor: color }}>
                    </option>
                  ))}
                </select>
              </div>
            </li>
            <li>
              <div className="ml-1 flex justify-between justify-center">
                <div className='text-white rounded'>Màu đồ thị hôm qua:</div>
                <select
                  className="p-2 border rounded-lg shadow-md"
                  style={{ backgroundColor: profs.colorY }}
                  value={profs.colorY}
                  onChange={handleChangeColor}
                >
                  {colors.map((color) => (
                    <option key={color} value={color} style={{ backgroundColor: color }}>
                    </option>
                  ))}
                </select>
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SettingsButton;
