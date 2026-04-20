import React, { useState, useEffect } from "react";
import SetInterval from "./SetInterval";
import SetSample from "./SetSample";
import { produce } from "immer";
import { intervalUpdatePut } from '../../api/index';
import { useAuth } from '../../context/authContext'
// import ScheduleViewer from './settingFlowAlarm'

export const initData = async (profs) => {
  if (user.role === 'trial') {
    alert('Chức năng này không khả dụng cho tài khoản dùng thử')
    return;
  }
  
  try {
    const res = await intervalUpdatePut(
      localStorage.getItem("token"),
      { upTime:  1, sen_id: profs.info[profs.step].id, user: user.user }
    )
    if (res.data.success) {
      alert("Cập nhật thành công");
    }
  } catch (error) {
    if (error.res && !error.res.data.success) {
      alert(error.res.data.error);
    }
  }
}

const SettingsButton = (profs) => {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingAdj, setIsEditingAdj] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingT, setIsEditingT] = useState(false);  // Trạng thái để hiển thị ô nhập liệu
  const [isEditingWP, setIsEditingWP] = useState(false);
  const [FlowSum, setFlowSum] = useState();
  const [FlowUnit, setFlowUnit] = useState();
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
      if (res.data.success) {
        alert("Cập nhật thành công");
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  }

  const handleSendUnit = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { unit: FlowUnit, sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
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

  // const handleSubmitWP = async () => {
  //   if (user.role === 'trial') {
  //     alert('Chức năng này không khả dụng cho tài khoản dùng thử')
  //     return;
  //   }
  //   try {
  //     const res = await intervalUpdatePut(
  //       localStorage.getItem("token"),
  //       { wPress: Number(profs.info[profs.step].wPress) + Number(profs.adj), sen_id: profs.info[profs.step].id, user: user.user }
  //     )
  //     if (res.data.success) {
  //       setIsEditingWP(false);
  //     }
  //   } catch (error) {
  //     if (error.res && !error.res.data.success) {
  //       alert(error.res.data.error);
  //     }
  //   }
  // };

  const handleOnOffWaringLost = async (dataInput) => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { [dataInput]: !profs.info[profs.step][dataInput], sen_id: profs.info[profs.step].id, user: user.user }
      )
      if (res.data.success) {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step][dataInput] = !draft[profs.step][dataInput];
          })
        );
        alert("Cập nhật thành công");
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  }

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
        alert("Cập nhật thành công");
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
        alert("Cập nhật thành công");
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

  // --- Pressure alerts (7 entries) handlers ---
  const handleAlertChange = (idx, field, value) => {
    // update highAlerts or lowAlerts depending on field
    profs.setdataInfo(prevData =>
      produce(prevData, draft => {
        const cur = draft[profs.step];
        if (field === 'high') {
          if (!Array.isArray(cur.highAlerts)) cur.highAlerts = Array.from({ length: 7 }, () => "");
          cur.highAlerts[idx] = value;
        }
        if (field === 'low') {
          if (!Array.isArray(cur.lowAlerts)) cur.lowAlerts = Array.from({ length: 7 }, () => "");
          cur.lowAlerts[idx] = value;
        }
      })
    );
  };

  const handleSubmitAlerts = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const cur = profs.info[profs.step] || {};
      // ensure arrays exist
      const highAlerts = Array.isArray(cur.highAlerts) ? cur.highAlerts : Array.from({ length: 7 }, () => "");
      // const lowAlerts = Array.isArray(cur.lowAlerts) ? cur.lowAlerts : Array.from({ length: 7 }, () => "");

      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { highAlerts, sen_id: cur.id, user: user.user }
      );
      if (res.data.success) {
        alert('Lưu cảnh báo thành công');
      }
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || 'Lỗi khi lưu cảnh báo');
    }
  };

  const handleSubmitLowAlerts = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const cur = profs.info[profs.step] || {};
      const lowAlerts = Array.isArray(cur.lowAlerts) ? cur.lowAlerts : Array.from({ length: 7 }, () => "");
      const res = await intervalUpdatePut(
        localStorage.getItem('token'),
        { lowAlerts, sen_id: cur.id, user: user.user }
      );
      if (res.data.success) alert('Lưu áp thấp thành công');
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || 'Lỗi khi lưu áp thấp');
    }
  };

  // Flow alerts (7 entries for high/low)
  const handleFlowChange = (idx, field, value) => {
    profs.setdataInfo(prev =>
      produce(prev, draft => {
        const cur = draft[profs.step];
        if (!Array.isArray(cur.flowHighs)) cur.flowHighs = Array.from({ length: 7 }, () => "");
        if (!Array.isArray(cur.flowLows)) cur.flowLows = Array.from({ length: 7 }, () => "");
        if (field === 'high') cur.flowHighs[idx] = value;
        if (field === 'low') cur.flowLows[idx] = value;
      })
    );
  };

  const handleSubmitFlow = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const cur = profs.info[profs.step] || {};
      const flowHighs = Array.isArray(cur.flowHighs) ? cur.flowHighs : Array.from({ length: 7 }, () => "");
      const flowLows = Array.isArray(cur.flowLows) ? cur.flowLows : Array.from({ length: 7 }, () => "");
      const res = await intervalUpdatePut(
        localStorage.getItem('token'),
        { flowHighs, flowLows, sen_id: cur.id, user: user.user }
      );
      if (res.data.success) alert('Lưu cảnh báo lưu lượng thành công');
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || 'Lỗi khi lưu cảnh báo lưu lượng');
    }
  };

  const handleSubmitFlowLow = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const cur = profs.info[profs.step] || {};
      const flowLows = Array.isArray(cur.flowLows) ? cur.flowLows : Array.from({ length: 7 }, () => "");
      const res = await intervalUpdatePut(
        localStorage.getItem('token'),
        { flowLows, sen_id: cur.id, user: user.user }
      );
      if (res.data.success) alert('Lưu lưu lượng thấp thành công');
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || 'Lỗi khi lưu lưu lượng thấp');
    }
  };

  // Save only alert times
  const handleSubmitTimes = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const cur = profs.info[profs.step] || {};
      let alertTimes = Array.isArray(cur.alertTimes) ? cur.alertTimes : Array.from({ length: 7 }, () => '');
      // normalize to minutes (number) or empty string
      alertTimes = alertTimes.map((t) => {
        if (typeof t === 'number') return t;
        if (typeof t === 'string' && t.includes(':')) {
          const [hh, mm] = t.split(':').map(Number);
          if (!Number.isNaN(hh) && !Number.isNaN(mm)) return hh * 60 + mm;
        }
        return t || '';
      });
      const res = await intervalUpdatePut(
        localStorage.getItem('token'),
        { alertTimes, sen_id: cur.id, user: user.user }
      );
      if (res.data.success){
        console.log(res.data.alertTimes)
        alert('Lưu thời gian cảnh báo thành công');
      } 
    } catch (error) {
      console.error(error);
      alert(error?.response?.data?.error || 'Lỗi khi lưu thời gian cảnh báo');
    }
  };

  return (
    <div className="relative inline-block text-left z-[1]">
      {/* Nút cài đặt */}
      {/* <button
        onClick={() => initData()}
        className="px-3 py-1 transition"
        title="Khởi tạo lại dữ liệu ban đầu"
      >
        🔄
      </button> */}
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
          style={{ maxHeight: "400px", overflowY: "auto", width: "min(500px, 90vw)", overflowX: "auto" }}
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
              <label htmlFor="input-value" className="text-white">
                <input
                  type="checkbox"
                  checked={profs.info[profs.step].isWarning}
                  onChange={() => handleOnOffWaringLost("isWarning")}
                  className="w-5"
                />
                Tắt/bật cảnh báo mất logger
              </label>
            </li>
            <li></li>
            <li>
              <label htmlFor="input-value" className="text-white">
                <input
                  type="checkbox"
                  checked={profs.info[profs.step].onP}
                  onChange={() => handleOnOffWaringLost("onP")}
                  className="w-5"
                />
                Tắt/bật cảnh báo áp suất ngoài ngưỡng
              </label>
            </li>
            <li>
              <label htmlFor="input-value" className="text-white">
                <input
                  type="checkbox"
                  checked={profs.info[profs.step].onF}
                  onChange={() => handleOnOffWaringLost("onF")}
                  className="w-5"
                />
                Tắt/bật cảnh báo lưu lượng ngoài ngưỡng
              </label>
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
                      <span className="text-white">{profs.info[profs.step].tracking || 1.5} m</span>
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
                      <span className="text-white">{profs.info[profs.step].adj} m</span>
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
                  onChange={(e) => {
                    const [d, t] = e.target.value.split("T");
                    const [h, m] = t.split(":").map(Number);
                    const rm = Math.round(m / 5) * 5;
                    setFromDate(`${d}T${String(h).padStart(2, "0")}:${String(rm % 60).padStart(2, "0")}`);
                  }}
                  className="border px-2 py-1"
                  style={{ width: "160px" }}
                />

                <span className="text-white">đến</span>
                <input
                  type="datetime-local"
                  value={toDate}
                  onChange={(e) => {
                    const [d, t] = e.target.value.split("T");
                    const [h, m] = t.split(":").map(Number);
                    const rm = Math.round(m / 5) * 5;
                    setToDate(`${d}T${String(h).padStart(2, "0")}:${String(rm % 60).padStart(2, "0")}`);
                  }}
                  className="border px-2 py-1"
                  style={{ width: "160px" }}
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
              <div className="flex justify-center space-x-2 mb-2">
                <button
                  onClick={() => {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    const from = `${yesterday.toISOString().split("T")[0]}T06:00`;
                    const to = `${today.toISOString().split("T")[0]}T06:00`;
                    setFromDate(from);
                    setToDate(to);
                  }}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                >
                  6h hôm qua đến 6h hôm nay
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    const from = `${yesterday.toISOString().split("T")[0]}T09:00`;
                    const to = `${today.toISOString().split("T")[0]}T09:00`;
                    setFromDate(from);
                    setToDate(to);
                  }}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                >
                  9h hôm qua đến 9h hôm nay
                </button>
                <button
                  onClick={() => {
                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    const from = `${yesterday.toISOString().split("T")[0]}T00:00`;
                    const to = `${today.toISOString().split("T")[0]}T00:00`;
                    setFromDate(from);
                    setToDate(to);
                  }}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                >
                  0h hôm qua đến 0h hôm nay
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
            {/* 7-entry alert times (separate save) */}
            <li>
              <div className="text-white font-bold mb-2">Thời gian cảnh báo</div>
              <div className="mt-2 space-y-2">
                {(() => {
                  const cur = profs.info[profs.step] || {};
                  const rawArr = Array.isArray(cur.alertTimes) ? cur.alertTimes.slice() : Array.from({ length: 7 }, () => '');
                  const toMinutes = (t) => {
                    if (typeof t === 'number') return t;
                    if (typeof t === 'string' && t.includes(':')) {
                      const [hh, mm] = t.split(':').map(Number);
                      if (!Number.isNaN(hh) && !Number.isNaN(mm)) return hh * 60 + mm;
                    }
                    return null;
                  };
                  const toHHMM = (m) => {
                    if (typeof m !== 'number') return '';
                    const hh = Math.floor(m / 60).toString().padStart(2, '0');
                    const mm = (m % 60).toString().padStart(2, '0');
                    return `${hh}:${mm}`;
                  };

                  // convert to minutes or null for empty
                  const minutesArr = rawArr.map(toMinutes);
                  // sort numeric times ascending, keep nulls at the end
                  const numeric = minutesArr.filter((x) => typeof x === 'number').sort((a, b) => a - b);
                  const sorted = [...numeric];
                  while (sorted.length < 7) sorted.push(null);

                  return sorted.map((val, idx) => (
                    <div key={idx} className="grid grid-cols-1 gap-2 items-center">
                      <input
                        type="time"
                        value={val === null ? '' : toHHMM(val)}
                        onChange={(e) => {
                          const v = e.target.value; // 'HH:MM' or ''
                          profs.setdataInfo(prev =>
                            produce(prev, draft => {
                              const c = draft[profs.step];
                              if (!Array.isArray(c.alertTimes)) c.alertTimes = Array.from({ length: 7 }, () => '');
                              // build current minutes array from c.alertTimes, convert to minutes or null
                              const curRaw = Array.isArray(c.alertTimes) ? c.alertTimes.slice() : Array.from({ length: 7 }, () => '');
                              const curMins = curRaw.map(toMinutes);
                              const nums = curMins.filter(x => typeof x === 'number').sort((a,b)=>a-b);
                              // set value at position idx in the sorted list
                              if (!v) {
                                // remove an entry at this sorted position (set to null)
                                nums.splice(idx, 1);
                              } else {
                                const [hh, mm] = v.split(':').map(Number);
                                const newMin = hh * 60 + mm;
                                // if position exists, replace, else insert
                                if (idx < nums.length) nums.splice(idx, 1, newMin);
                                else nums.splice(idx, 0, newMin);
                              }
                              // rebuild c.alertTimes: numeric sorted then nulls
                              const newArr = [...nums];
                              while (newArr.length < 7) newArr.push('');
                              c.alertTimes = newArr.map(x => (typeof x === 'number' ? x : ''));
                            })
                          )
                        }}
                        className="px-2 py-1 rounded w-full"
                      />
                    </div>
                  ));
                })()}
              </div>
              <div className="mt-3">
                <button onClick={handleSubmitTimes} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Lưu thời gian</button>
              </div>
            </li>

            {/* 7-entry high/low pressure alerts shown side-by-side */}
            <li>
              <div className="text-white font-bold mb-2">Cảnh báo áp suất</div>
              <div className="grid grid-cols-2 gap-2 bg-teal-600 p-2 rounded">
                <div className="text-white font-semibold">Áp thấp (m)</div>
                <div className="text-white font-semibold">Áp cao (m)</div>
              </div>

              <div className="mt-2">
                {Array.from({ length: 7 }).map((_, idx) => {
                  const cur = profs.info[profs.step] || {};
                  const high = Array.isArray(cur.highAlerts) ? cur.highAlerts[idx] ?? '' : '';
                  const low = Array.isArray(cur.lowAlerts) ? cur.lowAlerts[idx] ?? '' : '';
                  return (
                    <div key={idx} className="grid grid-cols-2 gap-2 items-center mb-2">
                      <input
                        type="number"
                        value={low}
                        onChange={(e) => handleAlertChange(idx, 'low', e.target.value)}
                        className="px-2 py-1 rounded w-full"
                        placeholder={`Áp thấp ${idx + 1}`}
                      />
                      <input
                        type="number"
                        value={high}
                        onChange={(e) => handleAlertChange(idx, 'high', e.target.value)}
                        className="px-2 py-1 rounded w-full"
                        placeholder={`Áp cao ${idx + 1}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex space-x-3">
                <button onClick={handleSubmitLowAlerts} className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Lưu áp thấp</button>
                <button onClick={handleSubmitAlerts} className="flex-1 bg-slate-500 text-white px-4 py-2 rounded hover:bg-slate-600">Lưu áp cao</button>
              </div>
            </li>
            
            {/* Flow alerts (7 entries high/low) */}
            <li>
              <div className="text-white font-bold mb-2">Cảnh báo lưu lượng (7 mục)</div>
              <div className="grid grid-cols-2 gap-2 bg-teal-600 p-2 rounded">
                <div className="text-white font-semibold">Lưu lượng thấp</div>
                <div className="text-white font-semibold">Lưu lượng cao</div>
              </div>

              <div className="mt-2">
                {Array.from({ length: 7 }).map((_, idx) => {
                  const cur = profs.info[profs.step] || {};
                  const fh = Array.isArray(cur.flowHighs) ? cur.flowHighs[idx] ?? '' : '';
                  const fl = Array.isArray(cur.flowLows) ? cur.flowLows[idx] ?? '' : '';
                  return (
                    <div key={idx} className="grid grid-cols-2 gap-2 items-center mb-2">
                      <input
                        type="number"
                        value={fl}
                        onChange={(e) => handleFlowChange(idx, 'low', e.target.value)}
                        className="px-2 py-1 rounded w-full"
                        placeholder={`Lưu lượng thấp ${idx + 1}`}
                      />
                      <input
                        type="number"
                        value={fh}
                        onChange={(e) => handleFlowChange(idx, 'high', e.target.value)}
                        className="px-2 py-1 rounded w-full"
                        placeholder={`Lưu lượng cao ${idx + 1}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex space-x-3">
                <button onClick={handleSubmitFlow} className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Lưu lưu lượng thấp</button>
                <button onClick={handleSubmitFlowLow} className="flex-1 bg-slate-500 text-white px-4 py-2 rounded hover:bg-slate-600">Lưu lưu lượng cao</button>
              </div>
            </li>
            {/* <li>
              <label htmlFor="input-value" className="text-white">
                <input
                  type="checkbox"
                  checked={profs.info[profs.step].isWarning}
                  onChange={handleOnOffWaringLost}
                  className="w-5"
                />
                Tắt/bật cảnh báo mất logger
              </label>
            </li> */}
            {/* <li>
              <ScheduleViewer sen_name={profs.info[profs.step].id} />
            </li> */}
            <li>
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">
                  Nhập lưu lượng tổng khởi tạo:
                  <input
                    type="number"
                    value={FlowSum}
                    onChange={(e) => setFlowSum(e.target.value)}
                    placeholder="Nhập lưu lượng tổng m3"
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
            <li>
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">
                  Nhập số đơn vị mỗi xung (lit):
                  <input
                    type="number"
                    value={FlowUnit}
                    onChange={(e) => setFlowUnit(e.target.value)}
                    placeholder="Nhập đơn vị mỗi xung (lit)"
                    className="border text-black border-gray-300 p-2 rounded w-full mb-4"
                  />
                </label>
                <button
                  onClick={handleSendUnit}
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
