import React, { useState, useEffect } from "react";
import SetInterval from "./SetInterval";
import SetSample from "./SetSample";
import { produce } from "immer";
import { intervalUpdatePut } from '../../api/index';
import { useAuth } from '../../context/authContext'

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}


const SettingsButton = (profs) => {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingAdj, setIsEditingAdj] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingT, setIsEditingT] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingWP, setIsEditingWP] = useState(false);
  const [isEditingWPTime, setIsEditingWPTime] = useState(false);
  const [FlowSum, setFlowSum] = useState();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const handleSend = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { sum: FlowSum, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if(res.data.success){
        alert("Cập nhật thành công");
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  }

  const handleInputChange = (event) => {
    profs.setdataInfo(prevData =>
      produce(prevData, draft => {
        draft[profs.step].tracking = event.target.value;
      })
    );
  };

  const handleInputChangeAdj = (event) => {
    profs.setdataInfo(prevData =>
      produce(prevData, draft => {
        draft[profs.step].adj = event.target.value;
      })
    );
  };

  const handleInputChangeT = (event) => {
    profs.setdataInfo(prevData =>
      produce(prevData, draft => {
        draft[profs.step].temperature = event.target.value;
      })
    );
  };

  const handleInputChangeWP = (event) => {
    profs.setdataInfo(prevData =>
      produce(prevData, draft => {
        draft[profs.step].wPress = event.target.value;
      })
    );
  };

  const handleInputChangeWPTime = (event) => {
    event.preventDefault();
    profs.setdataInfo(prevData =>
      produce(prevData, draft => {
        draft[profs.step].wPressTime = event.target.value;
      })
    );
  };

  const handleSubmit = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { tracking: profs.info[profs.step].tracking, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        setIsEditing(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };

  const handleSubmitAdj = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { adj: profs.info[profs.step].adj, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        setIsEditingAdj(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };

  const handleSubmitT = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { temp: profs.info[profs.step].temperature, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        setIsEditingT(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };

  const handleSubmitWP = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { wPress: profs.info[profs.step].wPress, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        setIsEditingWP(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };

  const handleSubmitWPTime = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { timeAlarm: profs.info[profs.step].timeAlarm, wPressTime: profs.info[profs.step].wPressTime, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        setIsEditingWPTime(false);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };

  const handleTimeChangeTime = async (event) => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    const value = event.target.value
    const [hours, minutes] = value.split(":").map(Number);
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { timeAlarm: hours * 60 + minutes, wPressTime: profs.info[profs.step].wPressTime, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step].timeAlarm = hours * 60 + minutes;
          })
        );
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };

  const handleSubmitHistory = async () => {
    if (!fromDate || !toDate) {
      return;
    }
    profs.handleData([fromDate, toDate, profs.info[profs.step].id]);
  };

  const handleSelect = async (e) => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const value = Number(e.target.value)
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { watch: value, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step].watch = value;
          })
        );
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  }

  const handleOnOffWT = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { temp: -profs.info[profs.step].temperature, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step].temperature = -draft[profs.step].temperature;
          })
        );
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  }

  const handleOnOffWP = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { wPress: -profs.info[profs.step].wPress, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step].wPress = -draft[profs.step].wPress;
          })
        );
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  }

  const handleOnOffWPTime = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { wPressTime: -profs.info[profs.step].wPressTime, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step].wPressTime = -draft[profs.step].wPressTime;
          })
        );
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  }

  return (
    <div className="relative inline-block text-left z-[1]">
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
          className="absolute right-0 mt-2 w-85 bg-teal-600 rounded-lg shadow-lg"
          style={{ maxHeight: "400px", overflowY: "auto" }}
        >
          <ul className="py-3 px-4 space-y-3 max-h-96 overflow-y-auto">
            {/* Cài đặt thời gian hiển thị */}
            <li><SetSample info={profs.info} setdataInfo={profs.setdataInfo} step={profs.step} user={user.user} role={user.role} /></li>
            <li><SetInterval info={profs.info} setdataInfo={profs.setdataInfo} step={profs.step} user={user.user} role={user.role} /></li>
            <li>
              <div className="ml-1 flex justify-between justify-center">
                <div className='text-white rounded'>Thời gian hiển thị:</div>
                <select className="bg-teal-600 rounded text-white"
                  value={profs.info[profs.step].watch}
                  onChange={handleSelect}
                >
                  <option value={60}>1 phut</option>
                  <option value={300}>5 phut</option>
                  <option value={600}>10 phut</option>
                  <option value={900}>15 phut</option>
                  <option value={1800}>30 phut</option>
                  <option value={3600}>1 gio</option>
                </select>
              </div>
            </li>
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
                      <span className="text-white">{profs.info[profs.step].tracking || 1.5} kg/m2</span>
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
                <label htmlFor="input-value" className="text-white">Áp suất điều chỉnh:</label>
                <div className="flex items-center space-x-2">
                  {isEditingAdj ? (
                    <>
                      <input
                        id="input-value"
                        type="text"
                        value={profs.info[profs.step].adj}
                        onChange={handleInputChangeAdj}
                        placeholder="Nhập giá trị"
                        className="px-2 py-1 rounded-lg text-black w-20"
                      />
                      <button
                        onClick={handleSubmitAdj}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg"
                      >
                        OK
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Nếu không chỉnh sửa, hiển thị giá trị */}
                      <span className="text-white">{profs.info[profs.step].adj} kg/m2</span>
                      <button
                        onClick={() => setIsEditingAdj(true)} // Chuyển sang chế độ chỉnh sửa
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
                  type="datetime-local"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border px-2 py-1"
                  style={{
                    width: "160px",
                  }}
                />
                <span className="text-white">đến</span>
                <input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border px-2 py-1"
                  style={{
                    width: "160px",
                  }}
                />
                <button
                  onClick={handleSubmitHistory}
                  className="bg-teal-500 text-white px-3 py-1 rounded hover:bg-teal-600"
                >
                  Ok
                </button>
              </div>
            </li>
            <li>
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">
                  <input
                    type="checkbox"
                    checked={profs.info[profs.step].temperature && profs.info[profs.step].temperature >= 0}
                    onChange={handleOnOffWT}
                    className="w-5"
                  />
                  Cảnh báo nhiệt độ:
                </label>
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
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">
                  <input
                    type="checkbox"
                    checked={profs.info[profs.step].wPress && profs.info[profs.step].wPress >= 0}
                    onChange={handleOnOffWP}
                    className="w-5"
                  />
                  Cảnh báo áp thấp:
                </label>
                <div className="flex items-center space-x-2">
                  {/* Nếu đang trong chế độ chỉnh sửa, hiển thị ô nhập */}
                  {isEditingWP ? (
                    <>
                      <input
                        id="input-value"
                        type="text"
                        value={profs.info[profs.step].wPress}
                        onChange={handleInputChangeWP}
                        placeholder="Nhập giá trị"
                        className="px-2 py-1 rounded-lg text-black w-20"
                      />
                      <button
                        onClick={handleSubmitWP}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg"
                      >
                        OK
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Nếu không chỉnh sửa, hiển thị giá trị */}
                      <span className="text-white">{profs.info[profs.step].wPress} kg/m2</span>
                      <button
                        onClick={() => setIsEditingWP(true)} // Chuyển sang chế độ chỉnh sửa
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
              <div className="flex flex-col space-y-2 bg-gray-800 p-4 rounded-lg">
                {/* Checkbox Cảnh báo */}
                <div className="flex justify-between items-center">
                  <label htmlFor="checkbox" className="text-white flex items-center space-x-2">
                    <input
                      id="checkbox"
                      type="checkbox"
                      checked={profs.info[profs.step].wPressTime && profs.info[profs.step].wPressTime >= 0}
                      onChange={handleOnOffWPTime}
                      className="w-5 h-5"
                    />
                    <span>Cảnh báo áp đạt mức:</span>
                  </label>
                </div>

                <div className="flex justify-between items-center">
                  {isEditingWPTime ? (
                    <>
                      <input
                        id="input-value"
                        type="text"
                        value={profs.info[profs.step].wPressTime}
                        onChange={handleInputChangeWPTime}
                        placeholder="Nhập giá trị"
                        className="px-2 py-1 rounded-lg text-black w-20"
                      />
                      <button
                        onClick={handleSubmitWPTime}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg"
                      >
                        OK
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-white">{profs.info[profs.step].wPressTime || 1.1} kg/m2</span>
                      <button
                        onClick={() => setIsEditingWPTime(true)}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg shadow-md hover:bg-teal-600 transition-all duration-200"
                      >
                        Chỉnh sửa
                      </button>
                    </>
                  )}
                </div>

                {/* Ô chọn giờ */}
                <div className="flex justify-between items-center">
                  <label htmlFor="time-input" className="text-white">
                    Chọn giờ:
                  </label>
                  <input
                    id="time-input"
                    type="time"
                    value={minutesToTime(profs.info[profs.step].timeAlarm)}
                    onChange={handleTimeChangeTime}
                    className="px-2 py-1 rounded-lg text-black w-25"
                  />
                </div>
              </div>
            </li>
            <li>
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">
                  Nhập áp tổng khởi tạo:
                <input
                  type="number"
                  value={FlowSum}
                  onChange={(e) => setFlowSum(e.target.value)}
                  placeholder="Nhập áp suất (kg/m²)"
                  className="border text-black border-gray-300 p-2 rounded w-full mb-4"
                />
                </label>
                <button
                  onClick={handleSend}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Gửi đi
                </button>
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SettingsButton;
