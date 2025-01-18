import React, { useState } from "react";
import SetInterval from "../sensor/SetInterval";
import { intervalUpdatePut } from '../../api/index';

const SettingsButton = (profs) => {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(profs.tracking);  // Lưu giá trị người dùng nhập
  const [valueB, setValueB] = useState(profs.trackingB); 
  const [isEditing, setIsEditing] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingB, setIsEditingB] = useState(false);  // Trạng thái để hiển thị ô nhập liệu

  const handleInputChange = (event) => {
    setValue(event.target.value);  // Cập nhật giá trị khi người dùng nhập
  };

  const handleInputChangeB = (event) => {
    setValueB(event.target.value);  // Cập nhật giá trị khi người dùng nhập
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
    console.log(valueB)
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
            <li>
              <div className="flex justify-between items-center">
                <div className="text-white">Thời gian hiển thị:</div>
                <select
                  className="bg-teal-600 rounded text-white"
                  value={profs.value}
                  onChange={profs.handle}
                >
                  <option value={15}>15 giây</option>
                  <option value={60}>1 phút</option>
                  <option value={300}>5 phút</option>
                  <option value={600}>10 phút</option>
                  <option value={900}>15 phút</option>
                  <option value={1800}>30 phút</option>
                  <option value={3600}>1 giờ</option>
                </select>
              </div>
            </li>

            {/* Cài đặt interval */}
            <li><SetInterval interval={profs.interval} setClose={setIsOpen} /></li>

            {/* Cài đặt giá trị theo dõi */}
            <li>
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">Giá trị trên:</label>
                <div className="flex items-center space-x-2">
                  {/* Nếu đang trong chế độ chỉnh sửa, hiển thị ô nhập */}
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
                <label htmlFor="input-value" className="text-white">Giá trị dưới:</label>
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
