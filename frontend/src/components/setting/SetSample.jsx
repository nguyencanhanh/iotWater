import React, { useState } from 'react';
import { intervalUpdatePut } from '../../api/index';
import { produce } from "immer";

function SetSample(info) {
  const interval = info.info[info.step].interval
  const [loading, setLoading] = useState(false);
  const isPending = loading || info.pending;

  const updateInterval = async (value) => {
    setLoading(true);
    try {
      const res = await intervalUpdatePut(localStorage.getItem("token"), { sample: value, sen_id: info.info[info.step].id, user: info.user, configAction: "sample" })
      if (res.data.success) {
        if (res.data.pending) info.onPendingAction?.("sample");
        info.setdataInfo(prevData =>
          produce(prevData, draft => {
            draft[info.step].sample = value;
          })
        );
      }
    } catch (error) {
      alert(error?.response?.data?.error || "Logger chưa phản hồi cấu hình");
    } finally {
      setLoading(false);
    }
  }

  const handleSelect = async (event) => {
    event.preventDefault();
    const valueX = Number(event.target.value);
    if(valueX > interval || (interval % valueX)){
      alert('Chọn không hợp lệ');
      return;
    }
    if(info.role === 'trial'){
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    await updateInterval(valueX)
  };

  return (
    <div className="ml-1 flex items-center justify-between gap-2">
      <div className='text-white rounded'>Thời gian lấy mẫu:</div>
      <select className="bg-teal-600 rounded text-white"
        value={info.info[info.step].sample}
        onChange={handleSelect}
        disabled={loading}
      >
        <option value={60}>1 phut</option>
        <option value={300}>5 phut</option>
        <option value={600}>10 phut</option>
        <option value={900}>15 phut</option>
        <option value={1800}>30 phut</option>
        <option value={3600}>1 gio</option>
        <option value={7200}>2 gio</option>
        <option value={10800}>3 gio</option>
      </select>
      {isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
    </div>
  );
}

export default SetSample;
