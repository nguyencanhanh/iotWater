import React, { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { sensorListGet } from "../../api/index"
import { ChartMadal } from './Chart';
import { TableModal, SensorDataDisplay } from './Table';
import { exportDataPost, getLoggerImageUrl } from '../../api/index';
import { useAuth } from '../../context/authContext'

const FIVE_MINUTES_MS = 5 * 60 * 1000;

const toValidDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateLabel = (date) => date.toLocaleDateString("sv-SE", {
  timeZone: "Asia/Ho_Chi_Minh",
});

const toDateTimeLocalValue = (value) => {
  const date = toValidDate(value);
  if (!date) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
};

function generateLabelsAndData(fromDate, toDate) {
  const start = toValidDate(fromDate);
  const end = toValidDate(toDate);
  const labels = [];
  const verticalLines = [];

  if (!start || !end || end < start) return { labels, verticalLines };

  const pointCount = Math.floor((end.getTime() - start.getTime()) / FIVE_MINUTES_MS) + 1;
  for (let i = 0; i < pointCount; i++) {
    const currentDate = new Date(start.getTime() + i * FIVE_MINUTES_MS);
    const hour = currentDate.getHours();
    const minute = currentDate.getMinutes();

    if(hour === 0 && minute === 0){
      verticalLines.push({
        type: "line",
        mode: "vertical",
        scaleID: "x",
        value: i,
        borderColor: "rgba(255, 0, 0, 0.5)",
        borderWidth: 2,
        borderDash: [5, 5],
      });
      labels.push(`${formatDateLabel(currentDate)} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
    else{
      labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return { labels, verticalLines };
}

const ModalData = (props) => {
  const { user } = useAuth()
  const userId = Number(user?.user ?? 0);
  const dateData = props.dateData;
  const name = props.idMap ? props.info[props.idMap[dateData[2]]].name : props.dateData[3];
  const adj = props.idMap ? props.info[props.idMap[dateData[2]]].adj : props.dateData[4];
  const sensorId = dateData[2];
  const [dataModal, setDataModal] = useState(null);
  const [showImage, setShowImage] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [fromDate, setFromDate] = useState(() => toDateTimeLocalValue(dateData[0]));
  const [toDate, setToDate] = useState(() => toDateTimeLocalValue(dateData[1]));
  
  const [dataLabel, setDataLabel] = useState(generateLabelsAndData(fromDate, toDate));
  const fetchSensors = async () => {
    try {
      const res = await sensorListGet(localStorage.getItem("token"), { sen_name: dateData[2], timeGet: [fromDate, toDate], user: user.user });
      if (res.data.success) {
        const data = res.data
        setDataModal(data);
      } else {
        alert("Failed to fetch sensors");
      }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  };

  useEffect(() => {
    fetchSensors();
  }, []);

  const handleSubmitHistory = async () => {
    if (!fromDate || !toDate) {
      return;
    }
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    try {
      setDataLabel(generateLabelsAndData(startDate, endDate));
    } catch (error){
      console.error("An unexpected error occurred:", error);
    } finally {
      fetchSensors();
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await exportDataPost(
        localStorage.getItem("token"),
        { sen_name: dateData[2], adj: adj, date: [fromDate, toDate], user: user.user },
      );

      if (res.data) {
        const url = window.URL.createObjectURL(res.data);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${name}_${fromDate}_${toDate}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("❌ Lỗi xuất file Excel:", error);
      alert("Lỗi khi tải file Excel!");
    }
  };


  return (
    <Modal
      centered
      open={props.isOpen}
      onCancel={props.handleCancel}
      width="100%"
      footer={null}
    >
      {!props.idMap ? (
        <></>
      ) : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="min-h-11 min-w-[240px] rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
            <span className="text-sm font-semibold text-black">đến</span>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="min-h-11 min-w-[240px] rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
            <button
              onClick={handleSubmitHistory}
              className="min-h-11 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600"
            >
              Xem dữ liệu
            </button>
          </div>
          <button
            onClick={handleExportExcel}
            className="min-h-11 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Xuất excel
          </button>
        </div>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{name}</h2>
          {!imageError && (
            <button
              onClick={() => setShowImage(true)}
              className="text-teal-600 hover:text-teal-800 text-xl"
              title="Xem ảnh logger"
            >
              📷
            </button>
          )}
        </div>
        {!dataModal ? (
          <h1>Loading...</h1>
        ) : (
          <div className="w-full bg-gray-200 p-4 rounded-lg shadow">
            <SensorDataDisplay param={dataModal.param} sum={dataModal.sum}/>
            <ChartMadal
              length={dataLabel.labels.length}
              dataLabel={dataLabel}
              dataModal={dataModal}
            />
            <TableModal dataModal={dataModal} adj={adj} fromDate={fromDate} />
          </div>
        )}
      </div>

      {/* Popup xem ảnh logger */}
      <Modal
        open={showImage}
        onCancel={() => setShowImage(false)}
        footer={null}
        title={`📷 Ảnh Logger: ${name}`}
        centered
        width={600}
      >
        <div className="flex justify-center items-center p-4">
          <img
            src={getLoggerImageUrl(sensorId, userId)}
            alt={`Logger ${name}`}
            className="max-w-full max-h-[60vh] object-contain rounded-lg"
            onError={() => { setImageError(true); setShowImage(false); alert('Logger này chưa có ảnh'); }}
          />
        </div>
      </Modal>
    </Modal >
  )
};

export default ModalData;
