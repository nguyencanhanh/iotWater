import React, { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { sensorListGet } from "../../api/index"
// import RealTimeLineChart, { Table } from "../chart/Chart";
import { DatePicker, Form } from 'antd';
// import { rangePresets } from './Date';
// import dayjs from 'dayjs';
// const { RangePicker } = DatePicker;

function generateLabelsAndData(interval, dateData) {
  const labels = [];
  const totalSecondsInDay = 24 * 60 * 60;

  for (let i = 0; i < totalSecondsInDay; i += interval) {
    const totalSeconds = i;
    const hour = Math.floor(totalSeconds / 3600);
    const minute = Math.floor((totalSeconds % 3600) / 60);
    const second = totalSeconds % 60;
    if (interval === 3600) {
      labels.push(`${String(hour).padStart(2, "0")}`);
    }
    else if (interval === 15) {
      labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`);
    }
    else {
      labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);

    }
  }
  return labels;
};

const ModalData = (props) => {
  const [dataModal, setDataModal] = useState([]);
  const [label, setLabel] = useState(generateLabelsAndData(15, props.dateData));
  const [interval, setInterval] = useState(15);

  const fetchSensors = async (interval) => {
    try {
      console.log(props.dateData)
      const res = await sensorListGet(localStorage.getItem("token"), { total: props.listInfor.length, interval: interval, timeGet: [props.dateData.startOf('day'), props.dateData.endOf('day')] });
      if (res.data.success) {
        const data = res.data.sensors
        setDataModal(data)
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

  const handleDateChange = (date) => {
    if (date) {
      
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
      <div className="flex flex-wrap justify-between items-center mb-4">
        <Form
          className="relative"
          initialValues={{
            dateToGetData: props.dateData,
          }}
        >
          <Form.Item name="dateToGetData">
            <DatePicker  // Sử dụng đúng component DatePicker từ antd
              showTime={false} // Không hiển thị thời gian
              format="YYYY-MM-DD"
              className="mt-6 w-1/5 min-w-[250px]"
              onChange={handleDateChange} // Xử lý logic ngay khi chọn ngày
            />
          </Form.Item>
        </Form>
      </div>
      <ul className="mt-5 flex flex-wrap justify-center gap-4">
        {dataModal.length === 0 ? (
          <h1>Loading...</h1>
        ) : (
          console.log(dataModal),
          props.listInfor.map((device) => (
            <li
              className="flex flex-col items-center w-full sm:w-[600px] md:w-[600px] bg-gray-200 p-4 rounded-lg shadow"
              key={device.id}
            >
              {/* <RealTimeLineChart name={device} label={label} dataModal={dataModal} /> */}
              {/* <Table step={device.id} dataModal={dataModal} /> */}
            </li>
          ))
        )}
      </ul>
    </Modal >
  )
};

export default ModalData;