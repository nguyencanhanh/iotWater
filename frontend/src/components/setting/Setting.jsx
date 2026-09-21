import React, { lazy, Suspense, useState, useEffect } from "react";
import { FaMapMarkedAlt } from "react-icons/fa";
import SetInterval from "./SetInterval";
import SetSample from "./SetSample";
import { produce } from "immer";
import { intervalUpdatePut, loggerConfigStatusGet } from '../../api/index';
import { useAuth } from '../../context/authContext'

// Tai leaflet theo yeu cau, tranh keo ca thu vien ban do vao chunk cai dat.
const MapPicker = lazy(() => import('../map/MapPicker'));
// import ScheduleViewer from './settingFlowAlarm'

const overviewMetricOptions = [
  { key: "pressureMax", label: "Áp suất cao nhất" },
  { key: "pressureMin", label: "Áp suất thấp nhất" },
  { key: "pressureAvg", label: "Áp suất trung bình" },
  { key: "flowMax", label: "Lưu lượng cao nhất" },
  { key: "flowMin", label: "Lưu lượng thấp nhất" },
  { key: "flowAvg", label: "Lưu lượng trung bình" },
  { key: "flowTotal", label: "Sản lượng ngày" },
  { key: "flowTotal24", label: "Sản lượng 24h" },
  { key: "flowMeter", label: "Chỉ số đồng hồ" },
  { key: "reverseTotal", label: "M³ chảy nghịch" },
];

const detailTableColumnOptions = [
  { key: "time", label: "Thời gian" },
  { key: "pressure", label: "Áp suất" },
  { key: "pressureCompare", label: "Áp suất cùng kì" },
  { key: "flow", label: "Lưu lượng" },
  { key: "flowCompare", label: "Lưu lượng cùng kì" },
  { key: "battery", label: "Pin" },
];

const notificationChannelOptions = [
  { key: "telegram", label: "Telegram" },
  { key: "fcm", label: "FCM" },
];

const DisplayOptionList = ({ title, options, selected, onToggle }) => (
  <div className="rounded-lg border border-teal-400/40 bg-teal-700/30 p-3">
    <div className="mb-2 text-sm font-bold text-white">{title}</div>
    <div className="grid grid-cols-1 gap-2">
      {options.map((option) => (
        <label key={option.key} className="flex items-center gap-2 rounded bg-white/10 px-2 py-1.5 text-sm text-white">
          <input
            type="checkbox"
            checked={selected.includes(option.key)}
            onChange={() => onToggle(option.key)}
            className="h-4 w-4 accent-teal-300"
          />
          {option.label}
        </label>
      ))}
    </div>
  </div>
);

const LoadingSpinner = ({ className = "h-4 w-4" }) => (
  <span className={`${className} inline-block animate-spin rounded-full border-2 border-white/40 border-t-white`} />
);

const SettingActionButton = ({ isLoading, className = "", children, disabled, ...props }) => (
  <button
    {...props}
    disabled={disabled}
    className={`${className} disabled:cursor-not-allowed disabled:opacity-70`}
  >
    <span className="flex items-center justify-center gap-2">
      {isLoading && <LoadingSpinner />}
      {children}
    </span>
  </button>
);

const SettingInlinePending = ({ show }) => (
  show ? <LoadingSpinner className="h-3.5 w-3.5" /> : null
);

const getConfigErrorMessage = (error) => (
  error?.response?.data?.error || error?.message || "Logger chưa phản hồi cấu hình"
);

const formatCoordinateInput = (sensor = {}) => {
  const lat = sensor.lat ?? "";
  const lng = sensor.lng ?? "";
  return lat !== "" && lng !== "" ? `${lat}, ${lng}` : "";
};

const parseCoordinateInput = (value) => {
  const cleaned = String(value || "").replace(/[()]/g, "").trim();
  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  const first = Number(parts[0]);
  const second = Number(parts[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  // Ưu tiên định dạng lat,lng như: 21.012721, 105.762814.
  let lat = first;
  let lng = second;
  if (Math.abs(first) > 90 && Math.abs(first) <= 180 && Math.abs(second) <= 90) {
    lat = second;
    lng = first;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
};

export const initData = async (profs, user) => {
  if (!user || user.role === 'trial') {
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
  const [pendingActions, setPendingActions] = useState({});
  const [remotePendingActions, setRemotePendingActions] = useState({});
  const [coordinateInput, setCoordinateInput] = useState(formatCoordinateInput(profs.info?.[profs.step]));
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const currentSensor = profs.info?.[profs.step] || {};

  const isActionPending = (actionKey) => Boolean(pendingActions[actionKey] || remotePendingActions[actionKey]);

  const setActionPending = (actionKey, isPending) => {
    setPendingActions((prev) => {
      const next = { ...prev };
      if (isPending) {
        next[actionKey] = true;
      } else {
        delete next[actionKey];
      }
      return next;
    });
  };

  const setRemoteActionPending = (actionKey, isPending) => {
    if (!actionKey) return;
    setRemotePendingActions((prev) => {
      const next = { ...prev };
      if (isPending) {
        next[actionKey] = true;
      } else {
        delete next[actionKey];
      }
      return next;
    });
  };

  useEffect(() => {
    setCoordinateInput(formatCoordinateInput(profs.info?.[profs.step]));
  }, [profs.info, profs.step]);

  useEffect(() => {
    const sensorId = currentSensor.id;
    if (!isOpen || !sensorId) {
      setRemotePendingActions({});
      return undefined;
    }

    let isMounted = true;
    const fetchPendingActions = () => {
      loggerConfigStatusGet(
        localStorage.getItem("token"),
        { sensorId, user: user.user }
      )
        .then((res) => {
          if (!isMounted) return;
          const nextPendingActions = {};
          (res.data.pendingActions || []).forEach((actionKey) => {
            nextPendingActions[actionKey] = true;
          });
          setRemotePendingActions(nextPendingActions);
        })
        .catch(() => {
          if (isMounted) setRemotePendingActions({});
        });
    };

    fetchPendingActions();
    const intervalId = window.setInterval(fetchPendingActions, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [isOpen, currentSensor.id, user.user]);

  const sendSensorConfig = async (actionKey, payload, onSuccess, successMessage) => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return null;
    }

    setActionPending(actionKey, true);
    try {
      const res = await intervalUpdatePut(
        localStorage.getItem("token"),
        { ...payload, sen_id: currentSensor.id, user: user.user, configAction: actionKey }
      );
      if (res.data.success) {
        const pendingActionKey = res.data.actionKey || actionKey;
        if (res.data.pending) {
          setRemoteActionPending(pendingActionKey, true);
        }
        onSuccess?.(res);
        if (successMessage && !res.data.pending) alert(successMessage);
      }
      return res;
    } catch (error) {
      console.error(error);
      alert(getConfigErrorMessage(error));
      return null;
    } finally {
      setActionPending(actionKey, false);
    }
  };

  const handleInitData = async () => {
    await sendSensorConfig("upTime", { upTime: 1 }, null, "Cập nhật thành công");
  };

  const handleSend = async () => {
    await sendSensorConfig("sum", { sum: FlowSum }, null, "Cập nhật thành công");
  }

  const handleSendUnit = async () => {
    await sendSensorConfig("unit", { unit: FlowUnit }, null, "Cập nhật thành công");
  }

  const handleCoordinateChange = (event) => {
    setCoordinateInput(event.target.value);
  };

  const handleSubmitCoordinate = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }

    const parsedCoordinate = parseCoordinateInput(coordinateInput);
    if (!parsedCoordinate) {
      alert('Vui lòng nhập tọa độ hợp lệ, ví dụ: 21.012721, 105.762814');
      return;
    }
    const { lat, lng } = parsedCoordinate;

    await sendSensorConfig(
      "coordinate",
      { Coor: currentSensor.id, lat, lng },
      () => {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step].lat = lat;
            draft[profs.step].lng = lng;
          })
        );
      },
      "Cập nhật tọa độ thành công"
    );
  };

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
    await sendSensorConfig("tracking", { tracking: currentSensor.tracking }, () => setIsEditing(false));
  };

  const handleSubmitAdj = async () => {
    await sendSensorConfig("adj", { adj: currentSensor.adj }, () => setIsEditingAdj(false));
  };

  const handleSubmitT = async () => {
    await sendSensorConfig("temp", { temp: currentSensor.temperature }, () => setIsEditingT(false));
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
    await sendSensorConfig(
      dataInput,
      { [dataInput]: !currentSensor[dataInput] },
      () => {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step][dataInput] = !draft[profs.step][dataInput];
          })
        );
      },
      "Cập nhật thành công"
    );
  }

  const handleNotificationChannelToggle = async (channel) => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }

    const currentChannels = {
      telegram: profs.info[profs.step]?.notificationChannels?.telegram !== false,
      fcm: profs.info[profs.step]?.notificationChannels?.fcm === true,
    };
    const nextChannels = {
      ...currentChannels,
      [channel]: !currentChannels[channel],
    };

    await sendSensorConfig(
      `notification-${channel}`,
      { notificationChannels: nextChannels },
      () => {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step].notificationChannels = nextChannels;
          })
        );
      },
      "Cập nhật kênh thông báo thành công"
    );
  }

  const handleSubmitHistory = async () => {
    if (!fromDate || !toDate) {
      return;
    }
    profs.handleData([fromDate, toDate, profs.info[profs.step].id]);
  };

  const handleOnOffWT = async () => {
    await sendSensorConfig(
      "temp-toggle",
      { temp: -currentSensor.temperature },
      () => {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step].temperature = -draft[profs.step].temperature;
          })
        );
      },
      "Cập nhật thành công"
    );
  }

  const handleOnOffWP = async () => {
    await sendSensorConfig(
      "wPress",
      { wPress: -currentSensor.wPress },
      () => {
        profs.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[profs.step].wPress = -draft[profs.step].wPress;
          })
        );
      }
    );
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
    const cur = profs.info[profs.step] || {};
    const highAlerts = Array.isArray(cur.highAlerts) ? cur.highAlerts : Array.from({ length: 7 }, () => "");
    await sendSensorConfig("highAlerts", { highAlerts }, null, "Lưu cảnh báo thành công");
  };

  const handleSubmitLowAlerts = async () => {
    const cur = profs.info[profs.step] || {};
    const lowAlerts = Array.isArray(cur.lowAlerts) ? cur.lowAlerts : Array.from({ length: 7 }, () => "");
    await sendSensorConfig("lowAlerts", { lowAlerts }, null, "Lưu áp thấp thành công");
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
    const cur = profs.info[profs.step] || {};
    const flowHighs = Array.isArray(cur.flowHighs) ? cur.flowHighs : Array.from({ length: 7 }, () => "");
    await sendSensorConfig("flowHighs", { flowHighs }, null, "Lưu cảnh báo lưu lượng thành công");
  };

  const handleSubmitFlowLow = async () => {
    const cur = profs.info[profs.step] || {};
    const flowLows = Array.isArray(cur.flowLows) ? cur.flowLows : Array.from({ length: 7 }, () => "");
    await sendSensorConfig("flowLows", { flowLows }, null, "Lưu lưu lượng thấp thành công");
  };

  // Save only alert times
  const handleSubmitTimes = async () => {
    const cur = profs.info[profs.step] || {};
    let alertTimes = Array.isArray(cur.alertTimes) ? cur.alertTimes : Array.from({ length: 7 }, () => '');
    alertTimes = alertTimes.map((t) => {
      if (typeof t === 'number') return t;
      if (typeof t === 'string' && t.includes(':')) {
        const [hh, mm] = t.split(':').map(Number);
        if (!Number.isNaN(hh) && !Number.isNaN(mm)) return hh * 60 + mm;
      }
      return t || '';
    });
    await sendSensorConfig("alertTimes", { alertTimes }, null, "Lưu thời gian cảnh báo thành công");
  };

  return (
    <div className="relative z-[60] inline-block text-left">
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
          className="absolute right-0 z-[70] mt-2 w-85 bg-teal-600 rounded-lg shadow-lg"
          style={{ maxHeight: "400px", overflowY: "auto", width: "min(500px, 90vw)", overflowX: "auto" }}
        >
          <ul className="py-3 px-4 space-y-3 max-h-96 overflow-y-auto">
            <li>
              <SetSample
                info={profs.info}
                setdataInfo={profs.setdataInfo}
                step={profs.step}
                user={user.user}
                role={user.role}
                pending={isActionPending("sample")}
                onPendingAction={setRemoteActionPending}
              />
            </li>
            <li>
              <SetInterval
                info={profs.info}
                setdataInfo={profs.setdataInfo}
                step={profs.step}
                user={user.user}
                role={user.role}
                pending={isActionPending("interval")}
                onPendingAction={setRemoteActionPending}
              />
            </li>
            <li>
              <div className="ml-1 flex justify-between justify-center">
                <div className='text-white rounded'>Khoảng xem biểu đồ:</div>
                <select
                  className="bg-teal-600 rounded text-white"
                  value={profs.detailChartDisplayInterval ?? 1}
                  onChange={(e) => profs.setDetailChartDisplayInterval?.(e.target.value)}
                >
                  {(profs.detailDisplayOptions || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </li>
            <li>
              <div className="ml-1 flex justify-between justify-center">
                <div className='text-white rounded'>Khoảng xem bảng:</div>
                <select
                  className="bg-teal-600 rounded text-white"
                  value={profs.detailTableDisplayInterval ?? 1}
                  onChange={(e) => profs.setDetailTableDisplayInterval?.(e.target.value)}
                >
                  {(profs.detailDisplayOptions || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
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
                <SettingInlinePending show={isActionPending("isWarning")} />
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
                <SettingInlinePending show={isActionPending("onP")} />
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
                <SettingInlinePending show={isActionPending("onF")} />
              </label>
            </li>
            <li>
              <div className="flex items-center gap-4 text-white">
                <span className="text-sm">Gửi cảnh báo:</span>
                {notificationChannelOptions.map((option) => {
                  const channels = profs.info[profs.step]?.notificationChannels || {};
                  const checked = option.key === "telegram"
                    ? channels.telegram !== false
                    : channels.fcm === true;

                  return (
                    <label key={option.key} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleNotificationChannelToggle(option.key)}
                        className="h-4 w-4 accent-teal-300"
                      />
                      {option.label}
                      <SettingInlinePending show={isActionPending(`notification-${option.key}`)} />
                    </label>
                  );
                })}
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
                      <SettingActionButton
                        onClick={handleSubmit}
                        isLoading={isActionPending("tracking")}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg"
                      >
                        OK
                      </SettingActionButton>
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
                      <SettingActionButton
                        onClick={handleSubmitAdj}
                        isLoading={isActionPending("adj")}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg"
                      >
                        OK
                      </SettingActionButton>
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
              <div className="flex justify-between items-center">
                <label htmlFor="input-value" className="text-white">
                  <input
                    type="checkbox"
                    checked={profs.info[profs.step].temperature && profs.info[profs.step].temperature >= 0}
                    onChange={handleOnOffWT}
                    className="w-5"
                  />
                  Cảnh báo nhiệt độ:
                  <SettingInlinePending show={isActionPending("temp-toggle")} />
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
                      <SettingActionButton
                        onClick={handleSubmitT}
                        isLoading={isActionPending("temp")}
                        className="px-4 py-2 bg-teal-500 text-white rounded-lg"
                      >
                        OK
                      </SettingActionButton>
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
            {/* 7-entry alert times and pressure alerts */}
            <li>
              <div className="text-white font-bold mb-2">Cảnh báo áp suất</div>
              <div className="grid grid-cols-3 gap-2 bg-teal-600 p-2 rounded">
                <div className="text-white font-semibold">Thời gian</div>
                <div className="text-white font-semibold">Áp thấp (m)</div>
                <div className="text-white font-semibold">Áp cao (m)</div>
              </div>

              <div className="mt-2">
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
                  const numeric = rawArr.map(toMinutes).filter((x) => typeof x === 'number').sort((a, b) => a - b);
                  const sorted = [...numeric];
                  while (sorted.length < 7) sorted.push(null);

                  return Array.from({ length: 7 }).map((_, idx) => {
                    const high = Array.isArray(cur.highAlerts) ? cur.highAlerts[idx] ?? '' : '';
                    const low = Array.isArray(cur.lowAlerts) ? cur.lowAlerts[idx] ?? '' : '';
                    const timeValue = sorted[idx];
                    return (
                      <div key={idx} className="grid grid-cols-3 gap-2 items-center mb-2">
                        <input
                          type="time"
                          value={timeValue === null ? '' : toHHMM(timeValue)}
                          onChange={(e) => {
                            const v = e.target.value;
                            profs.setdataInfo(prev =>
                              produce(prev, draft => {
                                const c = draft[profs.step];
                                if (!Array.isArray(c.alertTimes)) c.alertTimes = Array.from({ length: 7 }, () => '');
                                const curRaw = Array.isArray(c.alertTimes) ? c.alertTimes.slice() : Array.from({ length: 7 }, () => '');
                                const curMins = curRaw.map(toMinutes);
                                const nums = curMins.filter(x => typeof x === 'number').sort((a, b) => a - b);
                                if (!v) {
                                  nums.splice(idx, 1);
                                } else {
                                  const [hh, mm] = v.split(':').map(Number);
                                  const newMin = hh * 60 + mm;
                                  if (idx < nums.length) nums.splice(idx, 1, newMin);
                                  else nums.splice(idx, 0, newMin);
                                }
                                const newArr = [...nums];
                                while (newArr.length < 7) newArr.push('');
                                c.alertTimes = newArr.map(x => (typeof x === 'number' ? x : ''));
                              })
                            )
                          }}
                          className="px-2 py-1 rounded w-full"
                        />
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
                  });
                })()}
              </div>
              <div className="mt-3 flex space-x-3">
                <SettingActionButton onClick={handleSubmitTimes} isLoading={isActionPending("alertTimes")} className="flex-1 bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600">Lưu thời gian</SettingActionButton>
                <SettingActionButton onClick={handleSubmitLowAlerts} isLoading={isActionPending("lowAlerts")} className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Lưu áp thấp</SettingActionButton>
                <SettingActionButton onClick={handleSubmitAlerts} isLoading={isActionPending("highAlerts")} className="flex-1 bg-slate-500 text-white px-4 py-2 rounded hover:bg-slate-600">Lưu áp cao</SettingActionButton>
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
                <SettingActionButton onClick={handleSubmitFlowLow} isLoading={isActionPending("flowLows")} className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Lưu lưu lượng thấp</SettingActionButton>
                <SettingActionButton onClick={handleSubmitFlow} isLoading={isActionPending("flowHighs")} className="flex-1 bg-slate-500 text-white px-4 py-2 rounded hover:bg-slate-600">Lưu lưu lượng cao</SettingActionButton>
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
                <SettingActionButton
                  onClick={handleSend}
                  isLoading={isActionPending("sum")}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Gửi đi
                </SettingActionButton>
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
                <SettingActionButton
                  onClick={handleSendUnit}
                  isLoading={isActionPending("unit")}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Gửi đi
                </SettingActionButton>
              </div>
            </li>
            <li>
              <div className="pt-2 border-t border-teal-500/30 mb-2">
                <label className="text-white text-xs font-semibold block mb-1">
                  Chế độ hiển thị đồ thị:
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => profs.setViewMode('today')}
                    className={`flex-1 py-1 rounded text-[10px] font-bold transition ${
                      profs.viewMode === 'today'
                        ? 'bg-teal-600 text-white shadow'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Trong ngày (0h-24h)
                  </button>
                  <button
                    onClick={() => profs.setViewMode('past24h')}
                    className={`flex-1 py-1 rounded text-[10px] font-bold transition ${
                      profs.viewMode === 'past24h'
                        ? 'bg-teal-600 text-white shadow'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    24H qua (từ hiện tại)
                  </button>
                </div>
              </div>
            </li>
            <li>
              <DisplayOptionList
                title="Hiển thị trong số liệu tổng quan"
                options={overviewMetricOptions}
                selected={profs.displaySettings?.overviewMetrics || overviewMetricOptions.map((item) => item.key)}
                onToggle={(key) => profs.updateDisplaySettings?.("overviewMetrics", key)}
              />
            </li>
            <li>
              <DisplayOptionList
                title="Hiển thị trong bảng chi tiết"
                options={detailTableColumnOptions}
                selected={profs.displaySettings?.detailColumns || detailTableColumnOptions.map((item) => item.key)}
                onToggle={(key) => profs.updateDisplaySettings?.("detailColumns", key)}
              />
            </li>
            <li>
              <div className="rounded-lg border border-teal-400/40 bg-teal-700/30 p-3">
                <div className="mb-3 text-sm font-bold text-white">Tọa độ logger</div>
                <label className="text-xs font-semibold text-white">
                  Nhập vĩ độ, kinh độ
                  <input
                    type="text"
                    value={coordinateInput}
                    onChange={handleCoordinateChange}
                    placeholder="Ví dụ: 21.012721, 105.762814"
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-sm text-black"
                  />
                </label>
                <div className="mt-1 text-[11px] font-semibold text-teal-50/80">
                  Có thể nhập dạng: (21.012721, 105.762814)
                </div>
                <button
                  type="button"
                  onClick={() => setIsMapPickerOpen(true)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
                >
                  <FaMapMarkedAlt /> Chọn trên bản đồ
                </button>
                <SettingActionButton
                  onClick={handleSubmitCoordinate}
                  isLoading={isActionPending("coordinate")}
                  className="mt-3 w-full rounded bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                >
                  Lưu tọa độ
                </SettingActionButton>
              </div>

              <Suspense fallback={null}>
                <MapPicker
                  open={isMapPickerOpen}
                  initialLat={parseCoordinateInput(coordinateInput)?.lat ?? currentSensor?.lat}
                  initialLng={parseCoordinateInput(coordinateInput)?.lng ?? currentSensor?.lng}
                  title={`Chọn toạ độ cho ${currentSensor?.name || "logger"}`}
                  onCancel={() => setIsMapPickerOpen(false)}
                  onConfirm={({ lat, lng }) => {
                    setCoordinateInput(`${lat}, ${lng}`);
                    setIsMapPickerOpen(false);
                  }}
                />
              </Suspense>
            </li>
            <li>
              <div className="pt-2 border-t border-teal-500/30">
                <SettingActionButton
                  onClick={handleInitData}
                  isLoading={isActionPending("upTime")}
                  className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-xs transition flex items-center justify-center gap-1"
                >
                  🔄 Khởi tạo lại dữ liệu ban đầu
                </SettingActionButton>
              </div>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default SettingsButton;
