import React, { useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { getGroupInfo, updateGroupOrderPost, updateSensorOrderPost } from "../../api/index";
import { useAuth } from '../../context/authContext';

const buildGroupOrder = (serverOrder = [], groupedData = {}) => {
  const visibleGroups = Object.keys(groupedData).filter((group) => (groupedData[group] || []).length > 0);
  return [...new Set([...(Array.isArray(serverOrder) ? serverOrder : []), ...visibleGroups])]
    .filter((group) => visibleGroups.includes(group));
};

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

        const initialGroupOrder = buildGroupOrder(res.data.groupOrder, dg);
        setGroupOrder(initialGroupOrder);

        const initSensorOrders = {};
        initialGroupOrder.forEach(g => {
          initSensorOrders[g] = (dg[g] || []).map(s => s.id);
        });

        setSensorOrders(initSensorOrders);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchSensors(); }, []);

  const saveGroupOrder = (order) => {
    setGroupOrder(order);
    updateGroupOrderPost(localStorage.getItem("token"), {
      user: user.user,
      order,
    }).catch((e) => {
      console.error("Failed to save group order to database:", e);
      fetchSensors();
    });
  };

  const saveSensorOrder = async (group, order) => {
    setSensorOrders(prev => {
      return { ...prev, [group]: order };
    });
    try {
      await updateSensorOrderPost(localStorage.getItem("token"), {
        user: user.user,
        order: order
      });
    } catch (e) {
      console.error("Failed to save sensor order to database:", e);
    }
  };

  const getOrderedSensors = (group) => {
    const arr = dataGroup[group] || [];
    const order = sensorOrders[group] || [];
    if (!order.length) return arr;
    const mapById = new Map(arr.map(s => [String(s.id), s]));
    const usedIds = new Set();
    const ordered = order.map(id => {
      usedIds.add(String(id));
      return mapById.get(String(id));
    }).filter(Boolean);
    const remaining = arr.filter(sensor => !usedIds.has(String(sensor.id)));
    return [...ordered, ...remaining];
  };

  const formatMeterSum = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number === 0) return "";
    return number.toFixed(1);
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
        if (ia < 0 || ib < 0) return;
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

        if (ia < 0 || ib < 0) return;
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
            <th className="border border-gray-300 p-2 w-44">Số tổng đồng hồ</th>
            {/* <th className="border border-gray-300 p-2">Nhiệt Độ</th> */}
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

                <td className="border border-gray-300 p-2 font-bold" colSpan={6}>
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
                  <td className="border border-gray-300 text-center p-2 w-44">
                    {formatMeterSum(currentData[sensor.id]?.sum)}
                  </td>
                  {/* <td className="border border-gray-300 text-center p-2">
                    {currentData[sensor.id]?.temperature || ""}
                  </td> */}
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
