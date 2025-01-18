import React, { useState } from 'react';
import { client } from '../chart/Chart';
import { intervalUpdatePut } from '../../api/index';

function SetInterval(interval) {
  const [value, setValue] = useState(interval.interval);
  const options = [
    { "15 giay": 15 },
    { "1 phut": 60 },
    { "5 phut": 300 },
    { "10 phut": 600 },
    { "15 phut": 900 },
    { "30 phut": 1800 },
    { "1 gio": 3600 },
  ];

  const updateInterval = async (value, setValue) => {
    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), { interval: value })
      if (res.data.success) {
        console.log(res.data)
        setValue(Number(res.data.interval))
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  }

  const handleSelect = async (event) => {
    event.preventDefault();
    const valueX = Number(event.target.value);
    client.publish(
      'watter/setInterval',
      JSON.stringify({ sen_name: valueX }),
      (error) => {
        if (error) {
          alert('Xuất bản thất bại:', error.message);
        } else {
          updateInterval(valueX, setValue)
          alert('Xuất bản thành công.');
        }
      }
    )
  };

  return (
    <div className="ml-1 flex justify-between justify-center">
      <div className='text-white rounded'>Thời gian lấy mẫu:</div>
      <select className="bg-teal-600 rounded text-white"
        value={value}
        onChange={handleSelect}
      >
        <option value={15}>15 giay</option>
        <option value={60}>1 phut</option>
        <option value={300}>5 phut</option>
        <option value={600}>10 phut</option>
        <option value={900}>15 phut</option>
        <option value={1800}>30 phut</option>
        <option value={3600}>1 gio</option>
      </select>
    </div>
  );
}

export default SetInterval;
