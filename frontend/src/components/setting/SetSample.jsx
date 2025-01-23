import React, { useState } from 'react';
import { client } from '../chart/Chart';
import { intervalUpdatePut } from '../../api/index';

function SetSample(sample) {
  const [value, setValue] = useState(sample.sample);
  const interval = sample.interval
  const updateInterval = async (value, setValue) => {
    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), { sample: value })
      if (res.data.success) {
        setValue(Number(res.data.sample))
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
    if(valueX > interval || (interval % valueX)){
      alert('Chọn không hợp lệ');
      return;
    }
    client.publish(
      'watterChange@2024',
      JSON.stringify({ sample: valueX }),
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

export default SetSample;
