import React from 'react';
import dayjs from 'dayjs';
import { DatePicker, Form } from 'antd';
const { RangePicker } = DatePicker;

export const rangePresets = [
  {
    label: 'Last 15 minutes',
    value: [dayjs().add(-15, 'm'), dayjs()],
  },
  {
    label: 'Last 30 minutes',
    value: [dayjs().add(-30, 'm'), dayjs()],
  },
  {
    label: 'Last 1 hour',
    value: [dayjs().add(-1, 'h'), dayjs()],
  },
  {
    label: 'Last 8 hours',
    value: [dayjs().add(-8, 'h'), dayjs()],
  },
  {
    label: 'Last 1 day',
    value: [dayjs().add(-1, 'd'), dayjs()],
  },
  {
    label: 'Last 7 Days',
    value: [dayjs().add(-7, 'd'), dayjs()],
  },
  {
    label: 'Last 14 Days',
    value: [dayjs().add(-14, 'd'), dayjs()],
  },
  {
    label: 'Last 30 Days',
    value: [dayjs().add(-30, 'd'), dayjs()],
  },
];

const DateToGetData = (props) => {
  const handleRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      const [timestampStart, timestampEnd] = dates;
      const dateToGetData = [timestampStart, timestampEnd];
      props.handleData(dateToGetData); // Gửi dữ liệu về callback khi chọn xong
    }
  };

  return (
    <Form
      name="time_related_controls"
      className="relative"
    >
      <Form.Item name="dateToGetData">
        <RangePicker
          showTime
          format="YYYY-MM-DD HH:mm:ss"
          className="mt-6 w-1/5 min-w-[250px]"
          presets={[
            {
              label: <span aria-label="Current Time to End of Day">Now ~ EOD</span>,
              value: () => [dayjs(), dayjs().endOf('day')], // 5.8.0+ support function
            },
            ...rangePresets,
          ]}
          onChange={handleRangeChange} // Xử lý logic ngay khi chọn giá trị
        />
      </Form.Item>
    </Form>
  );
};

export default DateToGetData;
