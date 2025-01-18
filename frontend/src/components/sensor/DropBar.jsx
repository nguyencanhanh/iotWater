import React from 'react';
import { exportDataPost } from '../../api/index';

function Dropdown() {

  const options = [
    { "10m": 10 },
    { "30m": 30 },
    { "1h": 60 },
    { "1d": 1440 },
  ];

  const handleSelect = async (event) => {
    if(event.target.value === 'Xuất Excel'){
      return;
    }
    event.preventDefault();
    try {
      const res = await exportDataPost(localStorage.getItem("token"), {type: event.target.value});
      if (res.data.success) {
        // Handle success
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        alert(error.res.data.error);
      }
    }
  };

  return (
    <select className="px-1 py-1 bg-teal-600 rounded text-white"
      value=""
      onChange={handleSelect}
    >
      <option value="">Xuất Excel</option>
      {options.map((option, index) => {
        const key = Object.keys(option)[0];
        return (
          <option key={index} value={option[key]}>
            {key}
          </option>
        );
      })}
    </select>
  );
}

export default Dropdown;
