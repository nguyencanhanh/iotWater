import React, { useState } from "react";
import SetInterval from "./SetInterval";
import SetSample from "./SetSample";
import { intervalUpdatePut } from '../../api/index';

const SettingsButton = (profs) => {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(profs.tracking);  // Lưu giá trị người dùng nhập
  const [valueB, setValueB] = useState(profs.trackingB); 
  const [valueT, setValueT] = useState(profs.temperature); 
  const [isEditing, setIsEditing] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingB, setIsEditingB] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingT, setIsEditingT] = useState(false);  // Trạng thái để hiển thị ô nhập liệu

  const handleInputChange = (event) => {
    setValue(event.target.value);  // Cập nhật giá trị khi người dùng nhập
  };

  const handleInputChangeB = (event) => {
    setValueB(event.target.value);  // Cập nhật giá trị khi người dùng nhập
  };

  const handleInputChangeT = (event) => {
    setValueT(event.target.value);  // Cập nhật giá trị khi người dùng nhập
  };

  const handleSubmit = async () => {
    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), { tracking: value })
      if (res.data.success) {
        setIsEditing(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
    finally{
      profs.fetchSensors(profs.total, value, valueB)
    }
  };

  const handleSubmitB = async () => {
    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), { trackingB: valueB })
      if (res.data.success) {
        setIsEditingB(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
    finally{
      profs.fetchSensors(profs.total, value, valueB)
    }
  };

  const handleSubmitT = async () => {
    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), { temp: valueT })
      if (res.data.success) {
        setIsEditingT(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };

  const toggleVisibilityM = () => {
    profs.setAp((prev) => !prev);
  };

  return (
    <div className="relative inline-block text-left">
      {/* Nút cài đặt */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-5 py-3 text-sm font-medium text-white bg-blue-500 rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 transition-all duration-300"
      >
        Cài đặt
      </button>

      {/* Thanh cài đặt hiển thị khi nút nhấn */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-teal-600 rounded-lg shadow-lg"
          style={{ maxHeight: "400px", overflowY: "auto" }}
        >
          <ul className="py-3 px-4 space-y-3">
            {/* Cài đặt thời gian hiển thị */}
            <li><SetSample interval={profs.interval} sample={profs.sample}/></li>
            <li><SetInterval interval={profs.interval} sample={profs.sample}/></li>
            <li>
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">Giá trị áp trên:</label>
                <div className="flex items-center space-x-2">
                  {isEditing ? (
                    <>
                      <input
                        id="input-value"
                        type="text"
                        value={value}
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
                      <span className="text-white">{value || 1.5} Bar</span>
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
                        value={valueB}
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
                      <span className="text-white">{valueB || 1.5} Bar</span>
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
                        value={valueT}
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
                      <span className="text-white">{valueT || 45} ℃</span>
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
            {/* Cài đặt ẩn/hiện */}
            <li>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  onChange={toggleVisibilityM}
                  className="w-5 h-5"
                />
                <span className="text-white">Ẩn/hiện buổi sáng</span>
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SettingsButton;
