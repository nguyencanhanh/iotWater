import React, { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { sensorListGet } from "../../api/index"
import RealTimeLineChart, { Table } from "../chart/Chart";
import { DatePicker, Form } from 'antd';
import { rangePresets } from './Date';
import dayjs from 'dayjs';
import { generateLabelsAndData } from '../sensor/SensorList';
const { RangePicker } = DatePicker;


const ModalData = (props) => {
  const [dataModal, setDataModal] = useState([]);
  const [label, setLabel] = useState(generateLabelsAndData(15));
  const [interval, setInterval] = useState(15);

  const fetchSensors = async (interval) => {
    try {
      console.log(props.dateData)
      const res = await sensorListGet(localStorage.getItem("token"), { total: props.listInfor.length, interval: interval, timeGet: props.dateData });
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

  const handleRangeChange = async (fieldsValue) => {
    const timestampStart = fieldsValue.dateToGetData[0];
    const timestampEnd = fieldsValue.dateToGetData[1];
    const dateToGetData = [timestampStart, timestampEnd];
  };

  const handleIntervalChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setInterval(value);
    setLabel(generateLabelsAndData(value))
    fetchSensors(value)
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
            dateToGetData: props.dateData || [],
          }}
        >
          <Form.Item name="dateToGetData">
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              className="mt-6 w-1/5 min-w-[250px]"
              presets={[
                {
                  label: <span aria-label="Current Time to End of Day">Now ~ EOD</span>,
                  value: () => [dayjs(), dayjs().endOf('day')],
                },
                ...(rangePresets || []),
              ]}
              onChange={handleRangeChange}
            />
          </Form.Item>
        </Form>
        <div className="flex justify-between items-center mb-4">
          <div className="flex text-black rounded">Thời gian hiển thị:</div>
          <select
            className="bg-teal-600 rounded text-white h-10"
            value={props.value}
            onChange={props.handleIntervalChange} // Đảm bảo props có hàm này
          >
            <option value={15}>15 giây</option>
            <option value={60}>1 phút</option>
            <option value={300}>5 phút</option>
            <option value={600}>10 phút</option>
            <option value={900}>15 phút</option>
            <option value={1800}>30 phút</option>
            <option value={3600}>1 giờ</option>
          </select>
        </div>
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
              <RealTimeLineChart name={device} label={label} dataModal={dataModal} />
              <Table step={device.id} dataModal={dataModal} />
            </li>
          ))
        )}
      </ul>
    </Modal >
  )
};

export default ModalData;