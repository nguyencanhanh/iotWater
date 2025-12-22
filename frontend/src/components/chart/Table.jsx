import React, { useEffect, useState, useRef } from "react";
import { listDataTable } from "./Chart";

let startHour = 0;

function dateString(index, offset, startDate) {
  const minute = (startDate[0].getMinutes() + index * 5) % 60;
  if(index !== 0 && minute === 0) startHour++;
  if(startHour === 24) startHour = 0
  if (offset != null && startDate[Math.floor((index + offset) / 288)]) {
    return `${startDate[Math.floor((index + offset) / 288)].toISOString().split("T")[0]} - ${String(startHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
  }
  return `${String(startHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

export const SensorDataDisplay = (profs) => {
  const [openDetail, setOpenDetail] = useState(false);
  const total = profs.param.lastSum && profs.param.firstSum ? (profs.param.lastSum - profs.param.firstSum).toFixed(1) : "Chưa có dữ liệu"
  const toggleDetail = () => {
    setOpenDetail(!openDetail); // Toggle chi tiết
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Thông số cảm biến</h1>
      <div className="overflow-x-auto">
        <table className="table-auto w-full border-collapse border border-gray-300">
          <thead>
            <tr>
              <th className="border border-gray-300 px-4 py-2">Chi tiết</th>
              <th className="border border-gray-300 px-4 py-2">Sản lượng (m3)</th>
              <th className="border border-gray-300 px-4 py-2">Avg áp suất (m)</th>
              <th className="border border-gray-300 px-4 py-2">Min áp suất (m)</th>
              <th className="border border-gray-300 px-4 py-2">Thời gian min</th>
              <th className="border border-gray-300 px-4 py-2">Max áp suất (m)</th>
              <th className="border border-gray-300 px-4 py-2">Thời gian max</th>
              <th className="border border-gray-300 px-4 py-2">Avg lưu lượng (m3/h)</th>
              <th className="border border-gray-300 px-4 py-2">Min lưu lượng (m3/h)</th>
              <th className="border border-gray-300 px-4 py-2">Thời gian min</th>
              <th className="border border-gray-300 px-4 py-2">Max lưu lượng (m3/h)</th>
              <th className="border border-gray-300 px-4 py-2">Thời gian max</th>
            </tr>
          </thead>
          <tbody>
            {/* Hiển thị các giá trị tổng hợp của tất cả các ngày */}
            <tr className="hover:bg-gray-100">
              <td className="border border-gray-300 px-4 py-2">
                <button
                  onClick={toggleDetail}
                  className="text-blue-500 hover:text-blue-700 focus:outline-none"
                >
                  {openDetail ? 'Ẩn chi tiết' : 'Chi tiết'}
                </button>
              </td>
              <td className="border border-gray-300 px-4 py-2">{total}</td>
              <td className="border border-gray-300 px-4 py-2">{profs.param?.avgPressure?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{profs.param?.minPressure?.pressure?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{profs.param?.minPressure?.createAt}</td>
              <td className="border border-gray-300 px-4 py-2">{profs.param?.maxPressure?.pressure?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{profs.param?.maxPressure?.createAt}</td>
              <td className="border border-gray-300 px-4 py-2">{profs.param?.avgFlow?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{profs.param?.minFlow?.flow?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{profs.param?.minFlow?.createAt}</td>
              <td className="border border-gray-300 px-4 py-2">{profs.param?.maxFlow?.flow?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{profs.param?.maxFlow?.createAt}</td>
            </tr>

            {/* Hiển thị chi tiết dữ liệu của từng ngày nếu mở */}
            {openDetail && profs.sum.map((item, index) => {
              const total = item.lastSum && item.firstSum ? (item.lastSum - item.firstSum).toFixed(1) : "Chưa có dữ liệu"
              return (
                <tr key={index} className="hover:bg-gray-100">
                  <td className="border border-gray-300 px-4 py-2">{item._id.day}</td>
                  <td className="border border-gray-300 px-4 py-2">{total}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.avgPressure?.toFixed(1)}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.minPressure?.pressure?.toFixed(1)}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.minPressure?.createAt}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.maxPressure?.pressure?.toFixed(1)}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.maxPressure?.createAt}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.avgFlow?.toFixed(1)}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.minFlow?.flow.toFixed(1)}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.minFlow?.createAt}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.maxFlow?.flow?.toFixed(1)}</td>
                  <td className="border border-gray-300 px-4 py-2">{item.maxFlow?.createAt}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const TableModal = (props) => {
  const tableData = props.dataModal.sensorT;
  const tableContainerRef = useRef(null);
  const headerRef = useRef(null);
  startHour = props.startHour
  useEffect(() => {
    // Đồng bộ thanh cuộn
    const syncScrollBar = () => {
      if (tableContainerRef.current && headerRef.current) {
        const container = tableContainerRef.current;
        const scrollWidth = container.offsetWidth - container.clientWidth;
        headerRef.current.style.paddingRight = `${scrollWidth}px`;
      }
    };
    syncScrollBar();
  }, []);

  return (
    <div className="border border-gray-300 w-full">
      {/* Header cố định */}
      <div ref={headerRef} className="bg-gray-200">
        <table className="border-collapse w-full table-fixed">
          <thead>
            <tr className="text-sm text-center">
              <th className="border border-gray-300 px-3 py-2 w-1/4" style={{ width: "30%" }}>Thời gian</th>
              <th className="border border-gray-300 px-3 py-2 w-1/5" style={{ width: "20%" }}>Áp suất (m)</th>
              <th className="border border-gray-300 px-3 py-2 w-1/5" style={{ width: "20%" }}>Lưu lượng (m3/h)</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Body cuộn, chỉ hiển thị 5 hàng */}
      <div
        ref={tableContainerRef}
        className="overflow-y-auto"
        style={{ maxHeight: "calc(8 * 40px)" }} // Giới hạn chiều cao cho đúng 5 hàng
      >
        {!tableData ? (
          <h1>Loading...</h1>
        ) : (
          <table className="border-collapse w-full table-fixed">
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index} className="h-8 text-lg">
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/4 leading-tight" style={{ width: "30%" }}>
                    {dateString(index, props.offset, props.startDate)}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5 leading-tight" style={{ width: "20%" }}>
                    {props.dataModal.sensorH[index] !== null ? (props.dataModal.sensorH[index] + props.adj).toFixed(1) : ""}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5 leading-tight" style={{ width: "20%" }}>
                    {props.dataModal.flowH[index] !== null ? props.dataModal.flowH[index]?.toFixed(2) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>)}
      </div>
    </div>

  );
}

const ScrollableTable = (device) => {
  const [tableData, setTableData] = useState(listDataTable[device.step]);
  const tableContainerRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    setTableData(listDataTable[device.step]);
  }, [device.step]);

  useEffect(() => {
    // Đồng bộ thanh cuộn
    const syncScrollBar = () => {
      if (tableContainerRef.current && headerRef.current) {
        const container = tableContainerRef.current;
        const scrollWidth = container.offsetWidth - container.clientWidth;
        headerRef.current.style.paddingRight = `${scrollWidth}px`;
        container.scrollTop = (container.scrollHeight - container.clientHeight) * device.currentTimeDate;
      }
    };
    syncScrollBar();
  }, []);

  const handleScroll = () => {
    let mode = device.dataModal ? "M" : "";
    const scrollContainer = document.getElementById(mode + device.step);
    const scrollTop = scrollContainer.scrollTop;
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    if (!device.dataModal) {
      device.handle((prevStates) => {
        const updatedStates = [...prevStates];
        updatedStates[device.step] = Math.floor(scrollTop / (maxScroll / (86400 / device.watch - 5)));
        return updatedStates;
      });
    }
  };

  return (
    <div className="relative border border-gray-300 w-full">
      {/* Lớp phủ trong suốt bên trái để chặn cuộn */}
      <div
        className="absolute top-0 left-0 h-full bg-transparent"
        style={{ width: "50%", pointerEvents: "auto" }}
        onWheel={(e) => e.stopPropagation()} // Chặn cuộn khi chuột ở bên trái
      />

      {/* Header cố định */}
      <div ref={headerRef} className="bg-gray-200">
        <table className="border-collapse w-full table-fixed">
          <thead>
            <tr className="text-sm text-center">
              <th className="border border-gray-300 px-3 py-2 w-1/5">Thời gian</th>
              <th className="border border-gray-300 px-3 py-2 w-1/5">Áp suất (m)</th>
              <th className="border border-gray-300 px-3 py-2 w-1/5">Cùng kì (m)</th>
              <th className="border border-gray-300 px-3 py-2 w-1/5">Lưu lượng (m3/h)</th>
              <th className="border border-gray-300 px-3 py-2 w-1/5">Cùng kì (m3/h)</th>
              <th className="border border-gray-300 px-3 py-2 w-1/6">Pin(%)</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Body cuộn, chỉ hiển thị 5 hàng */}
      <div
        ref={tableContainerRef}
        id={device.dataModal ? "M" + device.step : "" + device.step}
        onScroll={handleScroll}
        className="overflow-y-auto"
        style={{ maxHeight: "calc(8 * 40px)" }}
      >
        {!tableData ? (
          <h1>Loading...</h1>
        ) : (
          <table className="border-collapse w-full table-fixed">
            <tbody>
              {tableData.map((row, index) => (
                <tr key={index} className="h-8 text-lg">
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5">
                    {`${String(Math.floor(index * device.watch / 3600)).padStart(2, "0")}:${String((index * device.watch / 60) % 60).padStart(2, "0")}`}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5">
                    {row ? (row?.Pressure + device.adj).toFixed(1) : ""}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5">
                    {typeof device.data.sensorYRest[index] === 'number' ? (device.data.sensorYRest[index] + device.adj).toFixed(1) : ""}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5">
                    {row?.flow ?? ""}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5">
                    {device.data.flowYRest[index] !== null ? device.data.flowYRest[index] : ""}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/6">
                    {row?.battery != null ? `${row.battery}%` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>

  );
};

export default ScrollableTable;
