import React from 'react';
import { DatePicker, Form } from 'antd';  // Sử dụng đúng import từ 'antd'
const { RangePicker } = DatePicker;  // Đảm bảo sử dụng đúng đối tượng mà bạn muốn sử dụng

const DateToGetData = (props) => {
  const handleDateChange = (date) => {
    if (date) {
      const dateToGetData = [date.startOf('day'), date.endOf('day')]; // Lấy khoảng thời gian từ 00:00 đến 23:59 của ngày chọn
      props.handleData(date); // Gửi dữ liệu về callback khi chọn xong
    }
  };

  return (
    <Form name="time_related_controls" className="relative">
      <Form.Item name="dateToGetData">
        <DatePicker  // Sử dụng đúng component DatePicker từ antd
          showTime={false} // Không hiển thị thời gian
          format="YYYY-MM-DD"
          className="mt-6 w-1/5 min-w-[250px]"
          onChange={handleDateChange} // Xử lý logic ngay khi chọn ngày
        />
      </Form.Item>
    </Form>
  );
};

export default DateToGetData;
