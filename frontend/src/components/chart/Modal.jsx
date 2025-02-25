import React, { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { sensorListGet } from "../../api/index"
import { DatePicker, Form } from 'antd';
import RealTimeLineChart, { TimeComparison } from './Chart';
import { generateLabelsAndData } from '../sensor/SensorList';
import ScrollableTable from './Table';
import { exportDataPost } from '../../api/index';

const ModalData = (props) => {
  const dateData = [props.dateData.startOf('day'), props.dateData.endOf('day')];
  const total = props.listInfor.length;
  const [dataModal, setDataModal] = useState(null);
  const [timeTracking, setTimeTracking] = useState([]);
  const [timeTrackingB, setTimeTrackingB] = useState([]);
  const label = generateLabelsAndData();
  const [scrollPosition, setScrollPosition] = useState(Array(total).fill(0));
  return (
    <div>
      canhanh
    </div>
  )

  const fetchSensors = async (date) => {
    try {
      const res = await sensorListGet(localStorage.getItem("token"), { total: total, timeGet: date, tracking: props.tracking, trackingB: props.trackingB });
      if (res.data.success) {
        const data = res.data.sensors
        setDataModal(data)
        setTimeTracking(res.data.timeTrackingRet)
        setTimeTrackingB(res.data.timeTrackingRetB)
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
    fetchSensors(dateData);
  }, []);

  const handleDateChange = (date) => {
    if (date) {
      const dateToGetData = [date.startOf('day'), date.endOf('day')];
      fetchSensors(dateToGetData)
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await exportDataPost(localStorage.getItem("token"), { timeGet: dateData });
      if (res.data.success) {
        const response = res.data;
        const url = window.URL.createObjectURL(new Blob([response.excelBuffer]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "export.xlsx");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  }


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
        <button
          onClick={handleExportExcel}
          className="px-4 py-2 bg-teal-500 text-white rounded-lg"
        >
          Xuất excel
        </button>
      </div>
      <ul className="mt-5 flex flex-wrap justify-center gap-4">
        {!dataModal ? (
          <h1>Loading...</h1>
        ) : (
          props.listInfor.map((device) => (
            <li
              className="flex flex-col items-center w-full sm:w-[600px] md:w-[600px] bg-gray-200 p-4 rounded-lg shadow"
              key={device.id}
            >
              <TimeComparison step={device.id} init={timeTracking} initB={timeTrackingB} dataModal={1} />
              <RealTimeLineChart name={device} label={label} dataModal={dataModal} scrollPosition={scrollPosition} />
              <ScrollableTable step={device.id} handle={setScrollPosition} dataModal={dataModal} />
            </li>
          ))
        )}
      </ul>
    </Modal >
  )
};

export default ModalData;