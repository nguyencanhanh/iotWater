import React, { useState } from 'react';
import { addPrv_time, deletePrv_time } from '../../api/index';
// import AdjusterPressure from './AdjusterPressure'

export default function ValveScheduleControl(profs) {
    const [newTime, setNewTime] = useState('');
    const [newMin, setNewMin] = useState(5);
    const [newMax, setNewMax] = useState(10);

    const handleRemove = async (index) => {
        const timeRemove = schedules[index].time
        const updated = [...schedules];
        updated.splice(index, 1);
        profs.updateSchedules(updated);
        try {
            const res = await deletePrv_time(localStorage.getItem("token"), { user: profs.user, prv_name: profs.id, time: timeRemove });
            if (res.data.success) {
            } else {
                alert("Failed to remove prv");
            }
        } catch (error) {
            console.error("An unexpected error occurred:", error);
            alert(
                error.response?.data?.error || "Something went wrong. Please try again."
            );
        }
    };

    const handleChange = (index, field, value) => {
        const updated = [...schedules];
        updated[index][field] = Number(value);
        profs.updateSchedules(updated);
    };

    const handleTimeChange = (index, value) => {
        const updated = [...schedules];
        updated[index].time = value;
        profs.updateSchedules(updated);
    };

    const handleAdd = async () => {
        if (!newTime.match(/^\d{2}:\d{2}$/) || newMin < 0 || newMax < 0 || newMin > newMax) {
            alert('❌ Dữ liệu không hợp lệ!');
            return;
        }

        const duplicate = profs.schedules.find((s) => s.time === newTime);
        if (duplicate) {
            alert('⚠️ Mốc thời gian đã tồn tại!');
            return;
        }

        profs.updateSchedules([
            ...profs.schedules,
            { time: newTime, pressureMin: newMin, pressureMax: newMax },
        ]);
        try {
            const res = await addPrv_time(localStorage.getItem("token"), { user: profs.user, prv_name: profs.id, time: newTime, maxSetpoint: newMax, minSetpoint: newMin });
            if (res.data.success) {
                console.log(res.data)
            } else {
                alert("Failed to fetch prv");
            }
        } catch (error) {
            console.error("An unexpected error occurred:", error);
            alert(
                error.response?.data?.error || "Something went wrong. Please try again."
            );
        }
        setNewTime('');
        setNewMin(5);
        setNewMax(10);
    };

    return (
        <div className="sm:w-[560px] md:w-[600px] flex flex-col items-center bg-gray-200 rounded-lg shadow pl-4 pr-4">
            <h2 className="text-xl font-bold mb-4">Lịch điều chỉnh áp lực điểm cuối</h2>
            <div className="flex w-full justify-between items-center mb-4">
                <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="border p-1 rounded w-30"
                />
                <input
                    type="number"
                    step="0.1"
                    value={newMin}
                    onChange={(e) => setNewMin(Number(e.target.value))}
                    className="border p-1 rounded w-20"
                    placeholder="Min m"
                />
                <span className="text-xl font-semibold">→</span>
                <input
                    type="number"
                    step="0.1"
                    value={newMax}
                    onChange={(e) => setNewMax(Number(e.target.value))}
                    className="border p-1 rounded w-20"
                    placeholder="Max m"
                />
                <span className='ml-2 mr-2'>m</span>
                <button
                    onClick={handleAdd}
                    className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                >
                    Thêm
                </button>
            </div>
            {profs.schedules.map((item, index) => (
                <div key={index} className="flex w-full justify-between items-center mb-4">
                    <input
                        type="time"
                        value={item.time}
                        onChange={(e) => handleTimeChange(index, e.target.value)}
                        className="border p-1 rounded w-30"
                    />
                    <input
                        type="number"
                        step="0.1"
                        value={item.minSetpoint}
                        onChange={(e) => handleChange(index, 'minSetpoint', e.target.value)}
                        className="border p-1 rounded w-20"
                    />
                    <span className="text-xl font-semibold">→</span>
                    <input
                        type="number"
                        step="0.1"
                        value={item.maxSetpoint}
                        onChange={(e) => handleChange(index, 'maxSetpoint', e.target.value)}
                        className="border p-1 rounded w-20"
                    />
                    <span className='ml-2 mr-2'>m</span>
                    <button
                        onClick={() => handleRemove(index)}
                        className="px-4 py-1 bg-red-600 text-white rounded hover:bg-green-700"
                    >
                        Xoá
                    </button>
                </div>
            ))}
            <AdjusterPressure onSend={profs.sendCommandPrv}/>
        </div>
    );
}
