import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { getGroupInfo } from "../../api";
import { useAuth } from '../../context/authContext';

function GroupSensor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  user.user = 0

  const [dataGroup, setDataGroup] = useState({});
  const [currentData, setCurrentData] = useState([]);
  const [groupOrder, setGroupOrder] = useState([]);
  const [sensorOrders, setSensorOrders] = useState({});

  // Swap states
  const [swapMode, setSwapMode] = useState(false);  // Bật tắt swap
  const [swapSelect, setSwapSelect] = useState(null);

  const fetchSensors = async () => {
    try {
      const res = await getGroupInfo(localStorage.getItem("token"), 0);
      if (res.data.success) {
        setCurrentData(res.data.valueSenS);
        // dataSensorOnline = res.data.dataSensorOnline;
        // console.log("dataSensorOnline", dataSensorOnline);
        const dg = res.data.data || {};
        setDataGroup(dg);

        const savedGroupOrder = localStorage.getItem(`groupOrder_${user.user}`);
        const keys = Object.keys(dg);

        const initialGroupOrder = savedGroupOrder
          ? JSON.parse(savedGroupOrder).filter(k => keys.includes(k))
            .concat(keys.filter(k => !JSON.parse(savedGroupOrder).includes(k)))
          : keys;

        setGroupOrder(initialGroupOrder);

        const initSensorOrders = {};
        keys.forEach(g => {
          const saved = localStorage.getItem(`sensorOrder_${user.user}_${g}`);
          if (saved) {
            try { initSensorOrders[g] = JSON.parse(saved); }
            catch { initSensorOrders[g] = dg[g].map(s => s.id); }
          } else {
            initSensorOrders[g] = dg[g].map(s => s.id);
          }
        });

        setSensorOrders(initSensorOrders);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchSensors(); }, []);

  const saveGroupOrder = (order) => {
    setGroupOrder(order);
    localStorage.setItem(`groupOrder_${user.user}`, JSON.stringify(order));
  };

  const saveSensorOrder = (group, order) => {
    setSensorOrders(prev => {
      const next = { ...prev, [group]: order };
      localStorage.setItem(`sensorOrder_${user.user}_${group}`, JSON.stringify(order));
      return next;
    });
  };

  const getOrderedSensors = (group) => {
    const arr = dataGroup[group] || [];
    const order = sensorOrders[group] || [];
    const mapById = Object.fromEntries(arr.map(s => [s.id, s]));
    return order.map(id => mapById[id]).filter(Boolean);
  };

  // -----------------------------------------------------
  // SWAP FUNCTION
  // -----------------------------------------------------

  const swapItem = (item) => {
    if (!swapMode) return; // nếu không bật chế độ swap → bỏ qua

    // Nếu đang chọn cái đầu tiên
    if (!swapSelect) {
      setSwapSelect(item);
      return;
    }

    // Swap group ↔ group
    if (swapSelect.type === "group" && item.type === "group") {
      const a = swapSelect.group;
      const b = item.group;
      if (a !== b) {
        const newOrder = [...groupOrder];
        const ia = newOrder.indexOf(a);
        const ib = newOrder.indexOf(b);
        [newOrder[ia], newOrder[ib]] = [newOrder[ib], newOrder[ia]];
        saveGroupOrder(newOrder);
      }
    }

    // Swap sensor ↔ sensor
    if (swapSelect.type === "sensor" && item.type === "sensor") {
      if (swapSelect.group === item.group) {
        const group = item.group;
        const order = [...sensorOrders[group]];

        const ia = order.indexOf(swapSelect.id);
        const ib = order.indexOf(item.id);

        [order[ia], order[ib]] = [order[ib], order[ia]];
        saveSensorOrder(group, order);
      }
    }

    setSwapSelect(null);
  };

  // Nhấn group để điều hướng
  const handleGroupClick = (group) => {
    if (swapMode) return; // đang bật swap → không navigate
    if (swapSelect) return; // đang chọn swap → không navigate

    const sensorIDs = getOrderedSensors(group);
    const sensorMap = {};
    sensorIDs.forEach((s, i) => sensorMap[s.id] = i);

    navigate(`/admin-dashboard/sensors/${group}`, {
      state: { sensorIDs, sensorMap }
    });
  };

  return (
    <div>

      {/* ------------------ BUTTON TOGGLE SWAP ------------------ */}

      <table className="border-collapse border border-gray-300 w-full p-5">
        <thead>
          <tr className="bg-gray-200">
          {swapMode && (<td></td>)}
            <th className="border border-gray-300 p-2">ID</th>
            <th className="border border-gray-300 p-2">Tên cảm biến</th>
            <th className="border border-gray-300 p-2">Áp suất</th>
            <th className="border border-gray-300 p-2">Lưu lượng</th>
            <th className="border border-gray-300 p-2">Nhiệt Độ</th>
            <th className="border border-gray-300 p-2">
              <div>
                <button
                  onClick={() => {
                    setSwapMode(!swapMode);
                    setSwapSelect(null);
                  }}
                  className="rounded bg-blue-500 text-white font-semibold"
                >
                  sắp xếp
                </button>
              </div>
              Pin
            </th>
          </tr>
        </thead>

        <tbody>
          {groupOrder.map((group) => (
            <React.Fragment key={group}>

              {/* ---------------- GROUP ROW ---------------- */}
              <tr
                className={`cursor-pointer ${swapSelect?.group === group ? "bg-yellow-100" : "bg-blue-100 hover:bg-blue-200"}`}
                onClick={() => handleGroupClick(group)}
              >
                {swapMode && (
                  <td
                    className="border border-gray-300 text-center p-2 font-bold"
                    onClick={(e) => {
                      e.stopPropagation();
                      swapItem({ type: "group", group });
                    }}
                  >
                    {swapSelect?.type === "group" && swapSelect.group === group ? "●" : "⇅"}
                  </td>
                )}

                <td className="border border-gray-300 p-2 font-bold" colSpan={swapMode ? 6 : 7}>
                  {group}
                </td>
              </tr>

              {/* ---------------- SENSOR LIST ---------------- */}
              {getOrderedSensors(group).map(sensor => (
                <tr key={sensor.id} className={`hover:bg-gray-100 cursor-pointer ${swapSelect?.id === sensor.id ? "bg-yellow-100" : ""}`}>

                  {swapMode && (
                    <td
                      className="border border-gray-300 text-center p-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        swapItem({ type: "sensor", group, id: sensor.id });
                      }}
                    >
                      {swapSelect?.type === "sensor" && swapSelect.id === sensor.id ? "●" : "⇅"}
                    </td>
                  )}

                  <td className="border border-gray-300 text-center p-2">{sensor.id}</td>
                  <td className="border border-gray-300 p-2">{sensor.name}</td>
                  <td className="border border-gray-300 text-center p-2">
                    {(currentData[sensor.id]?.Pressure + sensor.adj).toFixed(1)}
                  </td>
                  <td className="border border-gray-300 text-center p-2">
                    {currentData[sensor.id]?.flow}
                  </td>
                  <td className="border border-gray-300 text-center p-2">
                    {currentData[sensor.id]?.temperature || 25}
                  </td>
                  <td className="border border-gray-300 text-center p-2">
                    {currentData[sensor.id]?.battery}%
                  </td>
                </tr>
              ))}

            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default GroupSensor;
