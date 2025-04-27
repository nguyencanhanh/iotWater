import React, { useState, useEffect } from 'react';
import { getAlarm, addAlarm, deleteAlarm } from "../../api";
import { useAuth } from '../../context/authContext'

const ScheduleManager = ({sen_name}) => {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState('');
  const [time, setTime] = useState('');
  const [flow, setFlow] = useState('');

  const fetchAlarm = async () => {
      try {
        const res = await getAlarm(localStorage.getItem("token"), { user: user.user, sen_name: sen_name })
        console.log(res.data.data)
        setJobs(res.data.data)
      } catch (error) {
        console.error("An unexpected error occurred:", error);
        alert(
          error.response?.data?.error || "Something went wrong. Please try again."
        );
      }
    }

  useEffect(() => {
    fetchAlarm();
  }, []);

  const addJob = async () => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    if (!jobId || !time || !flow || jobs.length > 5) return;
    try {
      const res = await addAlarm(localStorage.getItem("token"), { 
        user: user.user,
        name: jobId,
        id: sen_name,
        time: time,
        flow: flow
    })
    if(res.data.success){
      setJobs(prev => [...prev, { name:jobId, time, flow: parseFloat(flow) }]);
      setJobId('');
      setTime('');
      setFlow('');
    }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  }

  const deleteJob = async (id) => {
    if (user.role === 'trial') {
      alert('Chức năng này không khả dụng cho tài khoản dùng thử')
      return;
    }
    try {
      const res = await deleteAlarm(localStorage.getItem("token"), { user: user.user, sen_name: sen_name, name: id })
      if(res.data.success){
        setJobs(prev => prev.filter(job => job.name !== id));
      }
    } catch (error) {
      console.error("An unexpected error occurred:", error);
      alert(
        error.response?.data?.error || "Something went wrong. Please try again."
      );
    }
  };

  return (
    <div className="p-8 flex flex-col items-center">
      <h2 className="text-2xl font-bold text-white mb-6">Cài đặt cảnh báo lưu lượng</h2>

      {/* Form thêm job - 1 hàng */}
      <div className="w-full max-w-3xl flex items-center gap-4 mb-8">
        <input
          type="text"
          placeholder="Tên cảnh báo"
          value={jobId}
          onChange={e => setJobId(e.target.value)}
          className="w-20 flex-1 p-2 rounded bg-transparent border border-gray-300 text-white placeholder-gray-400"
        />
        <input
          type="time"
          value={time}
          onChange={e => setTime(e.target.value)}
          className="w-32 p-2 rounded bg-transparent border border-gray-300 text-white placeholder-gray-400"
        />
        <input
          type="number"
          placeholder="Lưu lượng"
          value={flow}
          onChange={e => setFlow(e.target.value)}
          className="w-20 p-2 rounded bg-transparent border border-gray-300 text-white placeholder-gray-400"
        />
        <button
          onClick={addJob}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded"
        >
          Thêm
        </button>
      </div>

      {/* Bảng jobs */}
      <table className="w-full max-w-3xl text-white table-auto border-collapse">
        <thead>
          <tr className="border-b border-gray-400">
            <th className="text-left py-2">Tên cảnh báo</th>
            <th className="text-left py-2">Thời gian</th>
            <th className="text-left py-2">Lưu lượng</th>
            <th className="text-left py-2">Hoạt động</th>
          </tr>
        </thead>
        <tbody>
          {jobs?.map(({ name, time, flow }) => (
            <tr key={name} className="border-b border-gray-300 hover:bg-gray-100 hover:text-black">
              <td className="py-2">{name}</td>
              <td className="py-2">{time}</td>
              <td className="py-2">{flow}</td>
              <td className="py-2">
                <button
                  onClick={() => deleteJob(name)}
                  className="text-red-500 hover:underline"
                >
                  Xoá
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScheduleManager;
