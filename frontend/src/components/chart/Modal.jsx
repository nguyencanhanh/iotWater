import React, { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { sensorListGet } from "../../api/index"
import { ChartMadal } from './Chart';
import { TableModal, SensorDataDisplay } from './Table';
import { exportDataPost } from '../../api/index';
import { useAuth } from '../../context/authContext'
import {differenceInCalendarDays} from 'date-fns'

function generateLabelsAndData(watch, hourStart, listDate) {
  const minuteS = listDate[0].getMinutes()
  const labels = [];
  const verticalLines = [];
  let dateStep = 0
  let hour = hourStart
  for (let i = 0; i < watch; i++) {
    const minute = (minuteS + i * 5) % 60;
    if(i !== 0 && minute === 0) hour++;
    if(hour === 24) hour = 0
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
      labels.push(`${listDate[++dateStep].toISOString().split("T")[0]} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
    else{
      labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }
  return { labels, verticalLines };
}

function getLength(lengModal, listDate, start, end) {
  const lengDate = listDate.length;
  const minute_s = listDate[0].getMinutes();
  const minute_e = listDate[lengDate - 1].getMinutes();
  if (lengDate !== 1) {
    return lengModal * lengDate - lengModal * 2 + (24 - listDate[0].getHours() + listDate[lengDate - 1].getHours()) * 12 + Math.floor((minute_e - minute_s) / 5)
  }
  else {
    return (end - start) * 12 + Math.floor((minute_e - minute_s) / 5)
  }
}

function convertTime(timeConvert, watch) {
  return (timeConvert.getHours() * 3600 + timeConvert.getMinutes() * 60) / watch
}

function getDatesInRange(startDate, endDate) {
  const dateArray = [];
  const currentDate = new Date(startDate);
  while (differenceInCalendarDays(endDate, currentDate)) {
    dateArray.push(new Date(currentDate)); // YYYY-MM-DD
    currentDate.setDate(currentDate.getDate() + 1);
  }
  dateArray.push(new Date(endDate)); // YYYY-MM-DD
  return dateArray;
}


const ModalData = (props) => {
  const { user } = useAuth()
  const dateData = props.dateData;
  const name = props.idMap ? props.info[props.idMap[dateData[2]]].name : props.dateData[3];
  const adj = props.idMap ? props.info[props.idMap[dateData[2]]].adj : props.dateData[4];
  const [dataModal, setDataModal] = useState(null);
  const [fromDate, setFromDate] = useState(dateData[0]);
  const [toDate, setToDate] = useState(dateData[1]);
  const [offset, setOffset] = useState(Math.floor(convertTime(new Date(dateData[0]), 300)));
  const [listDate, setListDate] = useState(getDatesInRange(dateData[0], new Date(dateData[1])));
  const startDate = new Date(fromDate).getHours();
  const endDate = new Date(toDate).getHours();
  
  const [dataLabel, setDataLabel] = useState(generateLabelsAndData(getLength(288, listDate, startDate, endDate), startDate, listDate));
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
    const listDateTemp = getDatesInRange(startDate, endDate);
    try {
      setOffset(Math.floor(convertTime(new Date(fromDate), 300)))
      setDataLabel(generateLabelsAndData(getLength(288, listDateTemp, startDate.getHours(), endDate.getHours()), startDate.getHours(), listDateTemp));
      setListDate(listDateTemp);
    } catch (e){
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
        <div className="flex flex-wrap justify-between items-center mb-4">
          <div className="flex space-x-4 mb-4">
            <input
              type="datetime-local"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border px-2 py-1"
            />
            <span className="text-black">đến</span>
            <input
              type="datetime-local"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border px-2 py-1"
            />
            <button
              onClick={handleSubmitHistory}
              className="bg-teal-500 text-white px-3 py-1 rounded hover:bg-teal-600"
            >
              Ok
            </button>
          </div>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-teal-500 text-white rounded-lg"
          >
            Xuất excel
          </button>
        </div>
      )}
      <div className="mt-5 flex flex-wrap justify-center gap-4">
        <h2 className="text-lg font-semibold">{name}</h2>
        {!dataModal ? (
          <h1>Loading...</h1>
        ) : (
          <div className="w-full bg-gray-200 p-4 rounded-lg shadow">
            <SensorDataDisplay param={dataModal.param} sum={dataModal.sum}/>
            <ChartMadal
              length={288 * listDate.length}
              dataLabel={dataLabel}
              dataModal={dataModal}
            />
            <TableModal dataModal={dataModal} adj={adj} startDate={listDate} offset={offset} startHour={startDate} />
          </div>
        )}
      </div>
    </Modal >
  )
};

export default ModalData;