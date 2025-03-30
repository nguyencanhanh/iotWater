import React, { useEffect, useState, useRef } from "react";
import { listDataTable } from "./Chart";

export const TableModal = (props) => {
  const tableData = props.dataModal.sensorT;
  const tableContainerRef = useRef(null);
  const headerRef = useRef(null);

  const handleScroll = () => {
    const scrollContainer = document.getElementById("M");
    const scrollTop = scrollContainer.scrollTop;
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
    props.setScrollPosition(Math.floor(scrollTop * props.lengScrol / maxScroll));
  }
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
              <th className="border border-gray-300 px-3 py-2 w-1/5" style={{ width: "20%" }}>Cùng kì (m)</th>
              <th className="border border-gray-300 px-3 py-2 w-1/5" style={{ width: "20%" }}>Lưu lượng (m3/h)</th>
              <th className="border border-gray-300 px-3 py-2 w-1/5" style={{ width: "20%" }}>Cùng kì (m3/h)</th>
              {/* <th className="border border-gray-300 px-3 py-2 w-1/5">Nhiệt độ(°C)</th> */}
              {/* <th className="border border-gray-300 px-3 py-2 w-1/6" style={{ width: "10%" }}>Pin(%)</th> */}
            </tr>
          </thead>
        </table>
      </div>

      {/* Body cuộn, chỉ hiển thị 5 hàng */}
      <div
        ref={tableContainerRef}
        id={"M"}
        onScroll={handleScroll}
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
                    {`${props.startDate[Math.floor(index / 288)].toISOString().split("T")[0]} - ${String(Math.floor(((index + props.startHour * 12) % 288) / 12)).padStart(2, "0")}:${String((index * 5) % 60).padStart(2, "0")}`}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5 leading-tight" style={{ width: "20%" }}>
                    {props.dataModal.sensorH[index] !== null ? props.dataModal.sensorH[index]?.toFixed(1) : ""} {/* Áp suất 2 (Bar) */}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5 leading-tight" style={{ width: "20%" }}>
                    {props.dataModal.sensorY[index] !== null ? props.dataModal.sensorY[index]?.toFixed(1) : ""}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5 leading-tight" style={{ width: "20%" }}>
                    {/* {props.dataModal.sensorH[index] !== null ? props.dataModal.sensorH[index]?.toFixed(1) : ""} Áp suất 2 (Bar) */}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5 leading-tight" style={{ width: "20%" }}>
                    {/* {props.dataModal.sensorY[index] !== null ? props.dataModal.sensorY[index]?.toFixed(1) : ""} */}
                  </td>
                  {/* <td className="border border-gray-300 px-2 py-0 text-center w-1/5 leading-tight">
                    {row?.temperature ?? ""}
                  </td> */}
                  {/* <td className="border border-gray-300 px-2 py-0 text-center w-1/6 leading-tight" style={{ width: "10%" }}>
                    {row?.battery != null ? `${row.battery}%` : ""}
                  </td> */}
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
        container.scrollTop = (container.scrollHeight - container.clientHeight) * device.currentTimeDate[device.step];
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
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5">{row?.Pressure ?? ""}</td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5">
                    {device.data[device.step].sensorYRest[index] !== null ? device.data[device.step].sensorYRest[index] : ""}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5">
                    {/* {device.data[device.step].sensorYRest[index] !== null ? device.data[device.step].sensorYRest[index] : ""} */}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5">
                    {/* {device.data[device.step].sensorYRest[index] !== null ? device.data[device.step].sensorYRest[index] : ""} */}
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
