import React from 'react';
import { intervalUpdatePut } from '../../api/index';
import { produce } from "immer";

function SetSample(info) {
  const interval = info.info[info.step].interval
  const updateInterval = async (value) => {
    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), { sample: value, sen_id: info.info[info.step].id })
      if (res.data.success) {
        info.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[info.info[info.step].id].sample = value;
          })
        );
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
    updateInterval(valueX)
  };

  return (
    <div className="ml-1 flex justify-between justify-center">
      <div className='text-white rounded'>Thời gian lấy mẫu:</div>
      <select className="bg-teal-600 rounded text-white"
        value={info.info[info.step].sample}
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
