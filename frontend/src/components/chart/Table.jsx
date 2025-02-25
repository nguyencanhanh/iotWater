import React, { useEffect, useState, useRef } from "react";
import { listDataTable } from "./Chart";

const ScrollableTable = (device) => {
  const [tableData, setTableData] = useState(listDataTable[device.step]);
  const tableContainerRef = useRef(null);
  const headerRef = useRef(null);

  useEffect(() => {
    if (!device.dataModal) {
      setTableData(listDataTable[device.step]);
    } else {
      setTableData(device.dataModal[device.step]?.sensorT || []);
    }
  }, [device.step, device.dataModal]);

  useEffect(() => {
    // Đồng bộ thanh cuộn
    const syncScrollBar = () => {
      if (tableContainerRef.current && headerRef.current) {
        const container = tableContainerRef.current;
        const scrollWidth = container.offsetWidth - container.clientWidth;
        headerRef.current.style.paddingRight = `${scrollWidth}px`;
        container.scrollTop = (container.scrollHeight - container.clientHeight) * device.currentTimeDate - 95;
      }
    };
    syncScrollBar();
  }, []);

  const handleScroll = () => {
    let mode = device.dataModal ? "M" : "";
    const scrollContainer = document.getElementById(mode + device.step);
    const scrollTop = scrollContainer.scrollTop;
    const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;

    device.handle((prevStates) => {
      const updatedStates = [...prevStates];
      updatedStates[device.step] = Math.floor(scrollTop / (maxScroll / 1435));
      return updatedStates;
    });
  };

  return (
    <div className="border border-gray-300 w-full">
      {/* Header cố định */}
      <div ref={headerRef} className="bg-gray-200">
        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th className="border border-gray-300 px-4 py-2 w-1/4">Thời gian</th>
              <th className="border border-gray-300 px-4 py-2 w-1/4">Áp suất (Bar)</th>
              <th className="border border-gray-300 px-4 py-2 w-1/4">Nhiệt độ (°C)</th>
              <th className="border border-gray-300 px-4 py-2 w-1/4">Pin (%)</th>
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
        style={{ maxHeight: "calc(5 * 40px)" }} // Giới hạn chiều cao cho đúng 5 hàng
      >
        <table className="border-collapse w-full">
          <tbody>
            {tableData.map((row, index) => (
              <tr key={index} className="h-5 text-xs">
                <td className="border border-gray-300 px-2 py-0 text-center w-1/4 leading-tight">
                  {`${String(Math.floor(index / 60)).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}`}
                </td><td className="border border-gray-300 px-2 py-0 text-center w-1/4 leading-tight">
                  {row?.Pressure?.toFixed(2) ?? ""}
                </td><td className="border border-gray-300 px-2 py-0 text-center w-1/4 leading-tight">
                  {row?.temperature ?? ""}
                </td><td className="border border-gray-300 px-2 py-0 text-center w-1/4 leading-tight">
                  {row?.battery != null ? `${row.battery}%` : ""}
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  );
};

export default ScrollableTable;
