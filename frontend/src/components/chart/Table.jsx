import React, { useEffect, useState, useRef } from "react";
import { listDataTable } from "./Chart";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function formatTableTime(index, fromDate) {
  const start = new Date(fromDate);
  if (Number.isNaN(start.getTime())) return "";

  const currentDate = new Date(start.getTime() + index * FIVE_MINUTES_MS);
  const dateLabel = currentDate.toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  const timeLabel = currentDate.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ho_Chi_Minh",
  });

  return `${dateLabel} - ${timeLabel}`;
}

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export const SensorDataDisplay = (profs) => {
  const [openDetail, setOpenDetail] = useState(false);
  const param = profs.param || {};
  const dailyRows = Array.isArray(profs.sum) ? profs.sum : [];
  const total = Number.isFinite(Number(param.lastSum)) && Number.isFinite(Number(param.firstSum))
    ? (param.lastSum - param.firstSum).toFixed(1)
    : "Chưa có dữ liệu"
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
              <td className="border border-gray-300 px-4 py-2">{param.avgPressure?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{param.minPressure?.pressure?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{param.minPressure?.createAt}</td>
              <td className="border border-gray-300 px-4 py-2">{param.maxPressure?.pressure?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{param.maxPressure?.createAt}</td>
              <td className="border border-gray-300 px-4 py-2">{param.avgFlow?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{param.minFlow?.flow?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{param.minFlow?.createAt}</td>
              <td className="border border-gray-300 px-4 py-2">{param.maxFlow?.flow?.toFixed(1)}</td>
              <td className="border border-gray-300 px-4 py-2">{param.maxFlow?.createAt}</td>
            </tr>

            {/* Hiển thị chi tiết dữ liệu của từng ngày nếu mở */}
            {openDetail && dailyRows.map((item, index) => {
              const total = Number.isFinite(Number(item.lastSum)) && Number.isFinite(Number(item.firstSum))
                ? (item.lastSum - item.firstSum).toFixed(1)
                : "Chưa có dữ liệu"
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
                  <td className="border border-gray-300 px-4 py-2">{item.minFlow?.flow?.toFixed(1)}</td>
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
                    {formatTableTime(index, props.fromDate)}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5 leading-tight" style={{ width: "20%" }}>
                    {toFiniteNumber(props.dataModal.sensorH[index]) !== null ? (toFiniteNumber(props.dataModal.sensorH[index]) + props.adj).toFixed(1) : ""}
                  </td>
                  <td className="border border-gray-300 px-2 py-0 text-center w-1/5 leading-tight" style={{ width: "20%" }}>
                    {toFiniteNumber(props.dataModal.flowH[index]) !== null ? toFiniteNumber(props.dataModal.flowH[index]).toFixed(2) : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>)}
      </div>
    </div>

  );
}

// Bang co toi 1.440 dong/ngay (moi phut 1 dong) nhung khung chi hien ~8 dong: chi dung
// cac dong dang nhin thay, phan con lai thay bang khoang trong dung chieu cao de thanh
// cuon van dung do dai. Truoc day dung du 1.440 dong -> 7.000-10.000 phan tu moi logger.
const ROW_HEIGHT = 37; // h-9 (36px) + 1px vien duoi
const VISIBLE_HEIGHT = 8 * 40;
const OVERSCAN = 10;

const ScrollableTable = (device) => {
  const [tableData, setTableData] = useState(listDataTable[device.step]);
  const [scrollTop, setScrollTop] = useState(0);
  const tableContainerRef = useRef(null);
  const headerRef = useRef(null);
  const frameRef = useRef(0);
  const visibleColumns = device.visibleColumns || ["time", "pressure", "pressureCompare", "flow", "flowCompare", "battery"];
  const columns = [
    {
      key: "time",
      label: "Thời gian",
      render: (_row, sourceIndex, label) => (
        label || `${String(Math.floor(sourceIndex * device.watch / 3600)).padStart(2, "0")}:${String((sourceIndex * device.watch / 60) % 60).padStart(2, "0")}`
      ),
    },
    {
      key: "pressure",
      label: "Áp suất (m)",
      render: (row) => {
        const pressure = toFiniteNumber(row?.Pressure);
        return pressure !== null ? (pressure + device.adj).toFixed(1) : "";
      },
    },
    {
      key: "pressureCompare",
      label: "Cùng kì (m)",
      render: (_row, sourceIndex) => {
        const pressure = toFiniteNumber(device.data?.sensorYRest?.[sourceIndex]);
        return pressure !== null ? (pressure + device.adj).toFixed(1) : "";
      },
    },
    {
      key: "flow",
      label: "Lưu lượng (m3/h)",
      render: (row) => {
        const flow = toFiniteNumber(row?.flow);
        return flow !== null ? flow.toFixed(2) : "";
      },
    },
    {
      key: "flowCompare",
      label: "Cùng kì (m3/h)",
      render: (_row, sourceIndex) => {
        const flow = toFiniteNumber(device.data?.flowYRest?.[sourceIndex]);
        return flow !== null ? flow.toFixed(2) : "";
      },
    },
    {
      key: "battery",
      label: "Pin(%)",
      render: (row) => row?.battery != null ? `${row.battery}%` : "",
    },
  ].filter((column) => visibleColumns.includes(column.key));
  const sourceRows = device.tableRows || tableData;
  const rows = device.labels?.length
    ? device.labels.map((label, displayIndex) => {
      const sourceIndex = device.rowIndexes?.[displayIndex] ?? displayIndex;
      return {
        label,
        sourceIndex,
        row: sourceRows?.[sourceIndex],
      };
    })
    : Array.from({ length: sourceRows?.length || 0 }, (_item, sourceIndex) => ({
      label: null,
      sourceIndex,
      row: sourceRows?.[sourceIndex],
    }));

  useEffect(() => {
    if (!device.tableRows) setTableData(listDataTable[device.step]);
  }, [device.step, device.labels?.length]);

  useEffect(() => {
    // Đồng bộ thanh cuộn
    const syncScrollBar = () => {
      if (tableContainerRef.current && headerRef.current) {
        const container = tableContainerRef.current;
        const scrollWidth = container.offsetWidth - container.clientWidth;
        headerRef.current.style.paddingRight = `${scrollWidth}px`;
        container.scrollTop = (container.scrollHeight - container.clientHeight) * device.currentTimeDate;
        setScrollTop(container.scrollTop);
      }
    };
    syncScrollBar();
  }, [device.currentTimeDate, rows.length]);

  useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  // Gom cac su kien cuon trong 1 khung hinh de khong render lai qua nhieu lan.
  const handleScroll = (event) => {
    const next = event.currentTarget.scrollTop;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => setScrollTop(next));
  };

  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const lastRow = Math.min(rows.length, Math.ceil((scrollTop + VISIBLE_HEIGHT) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = rows.slice(firstRow, lastRow);
  const topSpace = firstRow * ROW_HEIGHT;
  const bottomSpace = (rows.length - lastRow) * ROW_HEIGHT;

  return (
    <div className="relative mt-3 w-full overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
      {/* Lớp phủ trong suốt bên trái để chặn cuộn */}
      <div
        className="absolute left-0 top-0 hidden h-full bg-transparent sm:block"
        style={{ width: "50%", pointerEvents: "auto" }}
        onWheel={(e) => e.stopPropagation()} // Chặn cuộn khi chuột ở bên trái
      />

      {/* Header cố định */}
      <div ref={headerRef} className="bg-slate-50">
        <table className="w-full table-fixed border-separate border-spacing-0">
          <thead>
            <tr className="text-center">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="border-b border-r border-slate-200 px-2 py-3 text-xs font-black uppercase tracking-wide text-slate-600 last:border-r-0 sm:px-3"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* Body cuộn, chỉ hiển thị 5 hàng */}
      <div
        ref={tableContainerRef}
        id={device.dataModal ? "M" + device.step : "" + device.step}
        className="overflow-y-auto bg-white"
        style={{ maxHeight: `${VISIBLE_HEIGHT}px` }}
        onScroll={handleScroll}
      >
        {!tableData && !rows.length ? (
          <h1 className="p-4 text-center text-sm font-bold text-slate-400">Loading...</h1>
        ) : (
          <table className="w-full table-fixed border-separate border-spacing-0">
            <tbody>
              {topSpace > 0 && (
                <tr aria-hidden="true" style={{ height: topSpace }}><td colSpan={columns.length} className="p-0" /></tr>
              )}
              {visibleRows.map(({ row, sourceIndex, label }, offset) => {
                const displayIndex = firstRow + offset;
                return (
                <tr
                  key={`${sourceIndex}-${displayIndex}`}
                  style={{ height: ROW_HEIGHT }}
                  // Xen mau theo vi tri that trong bang (khong dung odd/even vi chi dung 1 phan).
                  className={`text-sm font-semibold text-slate-700 hover:bg-teal-50/70 sm:text-base ${displayIndex % 2 ? "bg-slate-50/70" : "bg-white"}`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="border-b border-r border-slate-100 px-2 py-2 text-center last:border-r-0"
                    >
                      {column.render(row, sourceIndex, label, displayIndex)}
                    </td>
                  ))}
                </tr>
                );
              })}
              {bottomSpace > 0 && (
                <tr aria-hidden="true" style={{ height: bottomSpace }}><td colSpan={columns.length} className="p-0" /></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>

  );
};

export default ScrollableTable;
