import React, { useState, useEffect } from "react";
import { changePrv } from "../../api";
import { useAuth } from '../../context/authContext'
import { constructFromSymbol } from "date-fns/constants";

const modes = [
    "Tự động",
    "Chạy theo áp điểm cuối",
    "Chạy theo áp sau van",
    "Mềm",
    "Tắt"
]

const modeAutos = [
    "Tắt",
    "Theo từng giờ",
    "Theo nhiệt độ lớn nhất",
    "Theo nhiệt độ trung bình"
]

function smallestMissing(arr) {
    for (let i = 0; i < 7; i++) {
        if (!arr.includes(i)) return i;
    }
}

export default function SettingsPanel({ defaultData }) {
    const { user } = useAuth()
    const [info, setInfo] = useState(defaultData);
    useEffect(() => {
        console.log(info, defaultData)
    }, [])
    // groups: array of { days: [0..6] } representing which weekdays belong to which group
    const [groups, setGroups] = useState(() => {
        const diff = []
        for (const x of defaultData.dayMap) {
            if (!diff.includes(x)) diff.push(x);
        }
        return diff
    });
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [newGroupDays, setNewGroupDays] = useState([]);
    const [duration, setDuration] = useState(localStorage.getItem('tCtr') || 5);
    const [value, setValue] = useState(info.low || 10);

    const increase = () => {
        setDuration((prev) => {
            const newVal = Math.min(prev + 1, 999);
            localStorage.setItem('tCtr', newVal);
            return newVal;
        });
    };

    const decrease = () => {
        setDuration((prev) => {
            const newVal = Math.max(prev - 1, 1);
            localStorage.setItem('tCtr', newVal);
            return newVal;
        });
    };

    const sendCommand = async (field, cmd) => {
        if (user.role === 'trial') {
            alert('Chức năng này không khả dụng cho tài khoản dùng thử')
            return;
        }
        try {
            const res = await changePrv(localStorage.getItem("token"), { info: { cmd: cmd, id: info.id }, field: field });
            if (res.data.success) {
                // console.log("oke")
            }
        } catch (error) {
            console.error("An unexpected error occurred:", error);
            alert(
                error.response?.data?.error || "Something went wrong. Please try again."
            );
        }
    };

    const handleChangeMode = async (e, field) => {
        if (user.role === 'trial') {
            alert('Chức năng này không khả dụng cho tài khoản dùng thử')
            return;
        }
        try {
            const res = await changePrv(localStorage.getItem("token"), { info: { id: info.id, [field]: e }, field: field });
            if (res.data.success) {
                setInfo({ ...info, [field]: e });
            }
        } catch (error) {
            console.error("An unexpected error occurred:", error);
            alert(
                error.response?.data?.error || "Something went wrong. Please try again."
            );
        }
    }

    const handleSendData = async (e, field) => {
        if (user.role === 'trial') {
            alert('Chức năng này không khả dụng cho tài khoản dùng thử')
            return;
        }
        try {
            const res = await changePrv(localStorage.getItem("token"), { info: { id: info.id, [field]: e }, field: field });
            if (res.data.success) {
                setInfo({ ...info, [field]: e })
            }
        } catch (error) {
            console.error("An unexpected error occurred:", error);
            alert(
                error.response?.data?.error || "Something went wrong. Please try again."
            );
        }
    }

    const handleChange = (field, value, index, isArray) => {
        if (isArray) {
            setInfo(prev => ({
                ...prev,
                [field]: prev[field].map((v, i) => (i === index ? value : v))
            }));
        } else {
            setInfo(prev => ({
                ...prev,
                [field]: value
            }));
        }
    };

    const handleChangeValue = async (e) => {
        if (user.role === 'trial') {
            alert('Chức năng này không khả dụng cho tài khoản dùng thử')
            return;
        }
        try {
            const res = await changePrv(localStorage.getItem("token"), { info: { id: info.id, low: Number(e.target.value) }, field: "low" });
            if (res.data.success) {
                setInfo({ ...info, low: Number(e.target.value) });
            }
        } catch (error) {
            console.error("An unexpected error occurred:", error);
            alert(
                error.response?.data?.error || "Something went wrong. Please try again."
            );
        }
    };
    const handleArrayChange = (field, index, value) => {
        if (user.role === 'trial') {
            alert('Chức năng này không khả dụng cho tài khoản dùng thử')
            return;
        }
        const newArr = [...info[field]];
        newArr[index] = parseFloat(value);
        setInfo({ ...info, [field]: newArr });
    };

    const handleTimeChange = (index, value) => {
        if (user.role === 'trial') {
            alert('Chức năng này không khả dụng cho tài khoản dùng thử')
            return;
        }
        const [hourStr, minStr] = value.split(":");
        const hours = parseInt(hourStr, 10);
        const minutes = parseInt(minStr, 10);
        if (isNaN(hours) || isNaN(minutes)) return;
        const totalMinutes = hours * 60 + minutes;

        const newTime = [...info.timeAlarm];
        newTime[index] = totalMinutes;
        setInfo({ ...info, timeAlarm: newTime });
    };

    const handleSubmitField = async (field, data, id) => {
        if (user.role === 'trial') {
            alert('Chức năng này không khả dụng cho tài khoản dùng thử')
            return;
        }
        // build dayMap from current groups: for each weekday (0..6) store group index or -1
        // const buildDayMap = () => {
        //     const map = new Array(7).fill(-1);
        //     groups.forEach((g, gi) => {
        //         (g.days || []).forEach(d => {
        //             if (d >= 0 && d <= 6) map[d] = gi;
        //         });
        //     });
        //     return map;
        // };

        try {
            // const infoToSend = { ...info, dayMap: buildDayMap() };
            // console.log(info, data)
            const res = await changePrv(localStorage.getItem("token"), { info: { [field]: data, id: info.id, index: id }, field: field });
            if (res.data.success) {
            }
        } catch (error) {
            console.error("An unexpected error occurred:", error);
            alert(
                error.response?.data?.error || "Something went wrong. Please try again."
            );
        }
    };

    const renderInputRow = (label, field, infoData, type = "text", submitHandler) => {
        const isMulti = Array.isArray(infoData);
        const info = isMulti ? infoData : [infoData]
        const types = isMulti ? (Array.isArray(type) ? type : infoData.map(() => "text")) : [type];
        return (
            <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                <label style={{ width: "30%", fontWeight: "bold", minWidth: "150px" }}>{label}</label>
                <div style={{ display: "flex", gap: "6px", width: "calc(70% - 80px)" }}>
                    {info.map((f, idx) => (
                        <input
                            key={`${field}_${idx}`}
                            type={types[idx] || "text"}
                            value={f}
                            onChange={(e) => handleChange(field, e.target.value, idx, isMulti)}
                            style={{
                                flex: 1,
                                width: "60px",
                                minWidth: "0", // fix auto grow bug
                                padding: "6px 10px",
                                border: "1px solid #ccc",
                                borderRadius: "4px",
                            }}
                        />
                    ))}
                </div>


                <button
                    onClick={submitHandler || (() => handleSubmitField(field, infoData))}
                    style={{
                        marginLeft: "10px",
                        backgroundColor: "#007bff",
                        color: "#fff",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "4px",
                        whiteSpace: "nowrap",
                    }}
                >
                    Lưu
                </button>
            </div>

        );
    };
    const handleAddWeeklyGroup = () => {
        if (user.role === 'trial') {
            alert('Chức năng này không khả dụng cho tài khoản dùng thử')
            return;
        }
        setNewGroupDays([]);
        setShowAddPanel(true);
    };

    const toggleNewDay = (day) => {
        setNewGroupDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    }

    const createGroupFromSelection = () => {
        if (newGroupDays.length === 0) {
            alert('Vui lòng chọn ít nhất một ngày');
            return;
        }
        // const chosen = Array.from(new Set(newGroupDays));
        console.log(newGroupDays)
        const groupIndex = smallestMissing(groups);

        // remove chosen days from other groups, then add new group
        // const cleaned = groups.map(g => ({ days: g.days.filter(d => !chosen.includes(d)) }));
        // cleaned.push({ days: chosen });

        // append 7 slots for new group in info arrays
        const newInfo = { ...info };
        const defaults = { time: 0, p: 0, pb: 0 };
        // newInfo.timeAlarm = Array.isArray(newInfo.timeAlarm) ? [...newInfo.timeAlarm] : [];
        newInfo.pConfig = Array.isArray(newInfo.pConfig) ? [...newInfo.pConfig] : [];
        newInfo.pBot = Array.isArray(newInfo.pBot) ? [...newInfo.pBot] : [];
        newInfo.dayMap = Array.isArray(newInfo.dayMap) ? [...newInfo.dayMap] : [];

        for (let i = 0; i < 7; i++) {
            // newInfo.timeAlarm.push(defaults.time);
            newInfo.pConfig.push(defaults.p);
            newInfo.pBot.push(defaults.pb);
        }

        // rebuild dayMap as a 7-element array mapping weekday -> groupIndex (or -1)
        // const rebuilt = new Array(7).fill(-1);
        newGroupDays.forEach((g) => {
            newInfo.dayMap[g] = groupIndex;
        });
        setGroups(prev => [...prev, smallestMissing(prev)]);
        setInfo(newInfo);
        setShowAddPanel(false);
        setNewGroupDays([]);
        console.log(newInfo.dayMap)
        handleSubmitField("dayMap", newInfo.dayMap)
    }

    const cancelCreateGroup = () => {
        setShowAddPanel(false);
        setNewGroupDays([]);
    }

    // Delete a group and release its days back to unassigned
    const handleDeleteGroup = (groupIndex) => {
        if (user.role === 'trial') {
            alert('Chức năng này không khả dụng cho tài khoản dùng thử')
            return;
        }

        // remove the group from groups list
        const newGroups = groups.filter((_, i) => i !== groupIndex);

        // remove the group's 7 slots from per-slot arrays
        const start = groupIndex * 7;
        const newInfo = { ...info };
        // newInfo.timeAlarm = Array.isArray(newInfo.timeAlarm) ? [...newInfo.timeAlarm] : [];
        newInfo.pConfig = Array.isArray(newInfo.pConfig) ? [...newInfo.pConfig] : [];
        newInfo.pBot = Array.isArray(newInfo.pBot) ? [...newInfo.pBot] : [];
        // info.dayMap is now a 7-element weekday->groupIndex map; we'll rebuild it below

        // splice out per-slot data for the removed group
        // newInfo.timeAlarm.splice(start, 7);
        newInfo.pConfig.splice(start, 7);
        newInfo.pBot.splice(start, 7);

        // If no groups remain, restore default single group with all days and ensure arrays length 7
        if (newGroups.length === 0) {
            const rInfo = { ...newInfo };
            // while (rInfo.timeAlarm.length < 7) rInfo.timeAlarm.push(0);
            while (rInfo.pConfig.length < 7) rInfo.pConfig.push(0);
            while (rInfo.pBot.length < 7) rInfo.pBot.push(0);
            rInfo.dayMap = new Array(7).fill(0); // assign all days to group 0
            setInfo(rInfo);
            // setGroups([{ days: [0,1,2,3,4,5,6] }]);
            setGroups([1])
            return;
        }

        // rebuild dayMap (weekday -> groupIndex) from newGroups
        for (let d = 0; d < 7; d++) {
            if (newInfo.dayMap[d] === groupIndex) {
                newInfo.dayMap[d] = 0;
            }
        }

        // ensure per-slot arrays length match newGroups.length * 7
        const expected = Math.max(1, newGroups.length) * 7;
        // while (newInfo.timeAlarm.length < expected) newInfo.timeAlarm.push(0);
        while (newInfo.pConfig.length < expected) newInfo.pConfig.push(0);
        while (newInfo.pBot.length < expected) newInfo.pBot.push(0);
        // if (newInfo.timeAlarm.length > expected) newInfo.timeAlarm = newInfo.timeAlarm.slice(0, expected);
        if (newInfo.pConfig.length > expected) newInfo.pConfig = newInfo.pConfig.slice(0, expected);
        if (newInfo.pBot.length > expected) newInfo.pBot = newInfo.pBot.slice(0, expected);
        setInfo(newInfo);
        setGroups(newGroups);
        handleSubmitField('dayMap', newInfo.dayMap)
        // console.log(newInfo.dayMap)
    };

    // Toggle a single weekday in a group (ensures partition)
    const handleToggleDayInGroup = (groupIndex, day) => {
        if (user.role === 'trial') {
            alert('Chức năng này không khả dụng cho tài khoản dùng thử')
            return;
        }
        const newInfo = { ...info };
        if (groupIndex === 0 && newInfo.dayMap[day] !== 0) {
            newInfo.dayMap[day] = 0
        }
        else if (newInfo.dayMap[day] === groupIndex) {
            newInfo.dayMap[day] = 0;
        }
        else if (newInfo.dayMap[day] === 0) {
            newInfo.dayMap[day] = groupIndex;
        }
        setInfo(newInfo);
        handleSubmitField('dayMap', newInfo.dayMap)
    };

    // useEffect(() => {
    //     // If info.dayMap is the new 7-element format mapping weekday->groupIndex, initialize groups from it
    //     if (info && Array.isArray(info.dayMap) && info.dayMap.length === 7) {
    //         // find max group index
    //         const maxIdx = info.dayMap.reduce((m, v) => (v > m ? v : m), -1);
    //         const groupCount = Math.max(1, maxIdx + 1);
    //         const newGroups = Array.from({ length: groupCount }, () => ({ days: [] }));
    //         for (let d = 0; d < 7; d++) {
    //             const gi = info.dayMap[d];
    //             if (gi >= 0 && gi < groupCount) newGroups[gi].days.push(d);
    //         }
    //         // if no groups had any days, default to one group with all days
    //         const finalGroups = newGroups.some(g => g.days.length > 0) ? newGroups : [{ days: [0,1,2,3,4,5,6] }];
    //         setGroups(finalGroups);
    //         // ensure per-slot arrays have expected length (groups.length * 7)
    //         const expected = Math.max(1, finalGroups.length) * 7;
    //         const ta = Array.isArray(info.timeAlarm) ? [...info.timeAlarm] : [];
    //         const pc = Array.isArray(info.pConfig) ? [...info.pConfig] : [];
    //         const pb = Array.isArray(info.pBot) ? [...info.pBot] : [];
    //         let changed = false;
    //         while (ta.length < expected) { ta.push(0); changed = true; }
    //         while (pc.length < expected) { pc.push(0); changed = true; }
    //         while (pb.length < expected) { pb.push(0); changed = true; }
    //         if (changed) setInfo(prev => ({ ...prev, timeAlarm: ta, pConfig: pc, pBot: pb }));
    //         return;
    //     }

    //     // ensure arrays exist and have at least 7 entries
    //     if (info) {
    //         const ta = Array.isArray(info.timeAlarm) ? [...info.timeAlarm] : [];
    //         const pc = Array.isArray(info.pConfig) ? [...info.pConfig] : [];
    //         const pb = Array.isArray(info.pBot) ? [...info.pBot] : [];
    //         const dm = Array.isArray(info.dayMap) ? [...info.dayMap] : [];
    //         let changed = false;
    //         while (ta.length < 7) { ta.push(0); changed = true; }
    //         while (pc.length < 7) { pc.push(0); changed = true; }
    //         while (pb.length < 7) { pb.push(0); changed = true; }
    //         while (dm.length < 7) { dm.push(-1); changed = true; }
    //         if (changed) setInfo(prev => ({ ...prev, timeAlarm: ta, pConfig: pc, pBot: pb, dayMap: dm }));
    //     }
    // }, []);

    // ensure info arrays length matches groups.length * 7 whenever groups change
    // useEffect(() => {
    //     if (!info) return;
    //     const expected = Math.max(1, groups.length) * 7;
    //     const newInfo = { ...info };
    //     newInfo.timeAlarm = Array.isArray(newInfo.timeAlarm) ? [...newInfo.timeAlarm] : [];
    //     newInfo.pConfig = Array.isArray(newInfo.pConfig) ? [...newInfo.pConfig] : [];
    //     newInfo.pBot = Array.isArray(newInfo.pBot) ? [...newInfo.pBot] : [];
    //     newInfo.dayMap = Array.isArray(newInfo.dayMap) ? [...newInfo.dayMap] : [];

    //     // while (newInfo.timeAlarm.length < expected) newInfo.timeAlarm.push(0);
    //     while (newInfo.pConfig.length < expected) newInfo.pConfig.push(0);
    //     while (newInfo.pBot.length < expected) newInfo.pBot.push(0);
    //     while (newInfo.dayMap.length < expected) newInfo.dayMap.push(-1);

    //     // if (newInfo.timeAlarm.length > expected) newInfo.timeAlarm = newInfo.timeAlarm.slice(0, expected);
    //     if (newInfo.pConfig.length > expected) newInfo.pConfig = newInfo.pConfig.slice(0, expected);
    //     if (newInfo.pBot.length > expected) newInfo.pBot = newInfo.pBot.slice(0, expected);
    //     if (newInfo.dayMap.length > expected) newInfo.dayMap = newInfo.dayMap.slice(0, expected);

    //     setInfo(newInfo);
    // }, [groups]);

    const renderAlarms = () => {
        const times = info.timeAlarm || [];
        const weekdayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

        // Helper to save only the 7-slot slice for a specific group and field
        // const handleSaveGroupField = async (gIdx, field) => {
        //     if (user.role === 'trial') {
        //         alert('Chức năng này không khả dụng cho tài khoản dùng thử');
        //         return;
        //     }
        //     // Build dayMap for all groups (as in handleSubmitField)
        //     // const buildDayMap = () => {
        //     //     const map = new Array(7).fill(-1);
        //     //     groups.forEach((g, gi) => {
        //     //         (g.days || []).forEach(d => {
        //     //             if (d >= 0 && d <= 6) map[d] = gi;
        //     //         });
        //     //     });
        //     //     return map;
        //     // };
        //     try {
        //         // Only update the 7 slots for this group, but backend expects full arrays
        //         // const infoToSend = {
        //         //     ...info,
        //         //     dayMap: buildDayMap(),
        //         // };
        //         await changePrv(localStorage.getItem("token"), { info: , field });
        //         alert('Đã lưu ' + (field === 'timeAlarm' ? 'thời gian' : field === 'pConfig' ? 'áp suất offline' : 'áp suất điểm cuối') + ' nhóm ' + (gIdx + 1));
        //     } catch (error) {
        //         console.error("An unexpected error occurred:", error);
        //         alert(
        //             error.response?.data?.error || "Something went wrong. Please try again."
        //         );
        //     }
        // };

        return (
            <div style={{ marginTop: "30px" }}>
                <h3>Thời gian và áp suất chế độ offline</h3>
                {/* Only show the add group button */}
                <div style={{ display: "flex", gap: "10px", marginTop: "10px", marginBottom: "12px", alignItems: "center" }}>
                    <button
                        onClick={handleAddWeeklyGroup}
                        style={{
                            marginLeft: "auto",
                            backgroundColor: "#ffc107",
                            color: "#000",
                            border: "none",
                            padding: "6px 12px",
                            borderRadius: "4px",
                        }}
                    >
                        Thêm nhóm
                    </button>
                </div>

                {showAddPanel && (
                    <div style={{ border: '1px solid #eee', padding: 8, marginBottom: 12, borderRadius: 6 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {weekdayNames.map((w, idx) => {
                                return (
                                    <label key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
                                        <input type="checkbox" checked={newGroupDays.includes(idx)} onChange={() => toggleNewDay(idx)} />
                                        <span style={{ opacity: 0.7 }}>{w}</span>
                                    </label>
                                )
                            })}
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                            <button onClick={createGroupFromSelection} style={{ backgroundColor: '#007bff', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4 }}>Tạo nhóm</button>
                            <button onClick={cancelCreateGroup} style={{ backgroundColor: '#6c757d', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4 }}>Hủy</button>
                        </div>
                    </div>
                )}

                {/* Mỗi nhóm hiển thị tách biệt */}
                {groups.map((gIdx) => {
                    return (
                        <div key={gIdx} style={{ border: "1px solid #ddd", padding: "10px", borderRadius: "6px", marginBottom: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <strong>Nhóm {gIdx + 1}</strong>
                                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                    {/* weekday toggles for quick remapping */}
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {weekdayNames.map((w, dayIdx) => {
                                            const assigned = info.dayMap[dayIdx]
                                            return (
                                                <button
                                                    key={dayIdx}
                                                    onClick={() => handleToggleDayInGroup(gIdx, dayIdx)}
                                                    style={{
                                                        padding: '4px 6px',
                                                        borderRadius: 4,
                                                        border: assigned == gIdx ? '1px solid #007bff' : '1px solid #ccc',
                                                        background: assigned == gIdx ? '#e6f0ff' : '#fff'
                                                    }}
                                                >
                                                    {w}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Save buttons for each field */}
                                    {gIdx === 0 ? (
                                        <button
                                            onClick={() => handleSubmitField('timeAlarm', info.timeAlarm)}
                                            style={{
                                                backgroundColor: "#007bff",
                                                color: "#fff",
                                                border: "none",
                                                padding: "6px 12px",
                                                borderRadius: "4px",
                                                fontWeight: 'bold',
                                            }}
                                        >
                                            Lưu thời gian
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleDeleteGroup(gIdx)}
                                            style={{
                                                backgroundColor: "#e74c3c",
                                                color: "#fff",
                                                border: "none",
                                                padding: "6px 10px",
                                                borderRadius: "4px",
                                            }}
                                        >
                                            Xóa nhóm
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleSubmitField('pConfig', info.pConfig, gIdx)}
                                        style={{
                                            backgroundColor: "#28a745",
                                            color: "#fff",
                                            border: "none",
                                            padding: "6px 12px",
                                            borderRadius: "4px",
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        Lưu áp suất offline
                                    </button>
                                    <button
                                        onClick={() => handleSubmitField('pBot', info.pBot, gIdx)}
                                        style={{
                                            backgroundColor: "#28a745",
                                            color: "#fff",
                                            border: "none",
                                            padding: "6px 12px",
                                            borderRadius: "4px",
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        Lưu áp suất điểm cuối
                                    </button>
                                </div>
                            </div>

                            {/* Header cột */}
                            <div style={{ display: "flex", fontWeight: "bold", marginBottom: "6px", gap: "10px" }}>
                                {gIdx === 0 && <div style={{ flex: 1 }}>Thời gian</div>}
                                <div style={{ flex: 1 }}>Áp suất offline (m)</div>
                                <div style={{ flex: 1 }}>Áp suất điểm cuối(m)</div>
                            </div>

                            {/* always render 7 rows per group (slots) */}
                            {Array.from({ length: 7 }).map((_, slotIdx) => {
                                const globalIdx = gIdx * 7 + slotIdx;
                                const time = times[globalIdx] !== undefined ? times[globalIdx] : 0;
                                const hour = String(Math.floor(time / 60)).padStart(2, "0");
                                const minute = String(time % 60).padStart(2, "0");
                                const timeStr = `${hour}:${minute}`;
                                const pressure = info.pConfig && info.pConfig[globalIdx] !== undefined ? info.pConfig[globalIdx] : 0;
                                const pressureB = info.pBot && info.pBot[globalIdx] !== undefined ? info.pBot[globalIdx] : 0;
                                const dayLabel = "";

                                return (
                                    <div key={globalIdx} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "center" }}>
                                        {gIdx === 0 && (
                                            <input
                                                type="time"
                                                value={timeStr}
                                                onChange={(e) => handleTimeChange(globalIdx, e.target.value)}
                                                style={{
                                                    flex: 1,
                                                    padding: "6px",
                                                    border: "1px solid #ccc",
                                                    borderRadius: "4px",
                                                }}
                                            />
                                        )}
                                        <input
                                            type="number"
                                            value={pressure}
                                            onChange={(e) => handleArrayChange("pConfig", globalIdx, e.target.value)}
                                            style={{
                                                flex: 1,
                                                padding: "6px",
                                                border: "1px solid #ccc",
                                                borderRadius: "4px",
                                            }}
                                        />
                                        <input
                                            type="number"
                                            value={pressureB}
                                            onChange={(e) => handleArrayChange("pBot", globalIdx, e.target.value)}
                                            style={{
                                                flex: 1,
                                                padding: "6px",
                                                border: "1px solid #ccc",
                                                borderRadius: "4px",
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div
            style={{
                maxWidth: "1200px",
                margin: "30px auto",
                padding: "20px",
                border: "1px solid #ccc",
                borderRadius: "8px",
                fontFamily: "Arial, sans-serif",
            }}
        >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "left", marginBottom: "20px" }}>
                <h3 style={{ fontSize: '24px', fontWeight: 'bold' }}>Cài đặt thiết bị</h3>
                <button
                    style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                    onClick={async () => {
                        try {
                            const res = await changePrv(localStorage.getItem("token"), { info: { id: info.id }, field: "rst" });
                            if (res.data.success) {
                                alert("Van điều áp đã reset thành công vui lòng đợi");
                            }
                        } catch (error) {
                            console.error("An unexpected error occurred:", error);
                            alert(
                                error.response?.data?.error || "Something went wrong. Please try again."
                            );
                        }
                    }}
                >
                    Reset
                </button>
                <button
                    style={{
                        padding: '10px 20px',
                        fontSize: '16px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer'
                    }}
                    onClick={async () => {
                        try {
                            const res = await changePrv(localStorage.getItem("token"), { info: { id: info.id }, field: "init" });
                            if (res.data.success) {
                                alert("Van điều áp đã init thành công vui lòng đợi");
                            }
                        } catch (error) {
                            console.error("An unexpected error occurred:", error);
                            alert(
                                error.response?.data?.error || "Something went wrong. Please try again."
                            );
                        }
                    }}
                >
                    Khởi tạo
                </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

                {/* {renderInputRow("Chế độ chạy van", "mode", info.mode, "number")} */}

                <div className="flex gap-4 ">
                    <label style={{ width: "40%", fontWeight: "bold" }} className="px-4 py-2">Bật/tắt khoảng mở bơm</label>
                    {/* Nút 1 */}
                    <button
                        onClick={() => {
                            handleSendData([1 - info.onOff[0], info.onOff[1]], "onOff")
                            // handleSubmitField("onOff")
                        }}
                        className={`px-4 py-2 rounded ${info.onOff[0] ? "bg-green-500 text-white" : "bg-gray-300 text-black"
                            }`}
                    >
                        {info.onOff[0] ? "Bật" : "Tắt"}
                    </button>

                    {/* Nút 2 */}
                    <button
                        onClick={() => {
                            handleSendData([info.onOff[0], 1 - info.onOff[1]], "onOff")
                            // handleSubmitField("onOff")
                        }}
                        className={`px-4 py-2 rounded ${info.onOff[1] ? "bg-green-500 text-white" : "bg-gray-300 text-black"
                            }`}
                    >
                        {info.onOff[1] ? "Bật" : "Tắt"}
                    </button>
                </div>
            </div>
            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>
                    <div className="flex gap-4">
                        <label style={{ width: "30%", fontWeight: "bold" }}>Chọn chế độ:</label>
                        <select
                            value={info.mode}
                            onChange={(e) => handleChangeMode(parseInt(e.target.value), "mode")}
                            className="block mb-2 mt-2 border border-gray-300 rounded-md shadow-sm bg-white"
                        >
                            {modes.map((mode, idx) => (
                                <option key={idx} value={idx}>
                                    {mode}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <div style={{ flex: 1 }}>
                    <div className="flex gap-4">
                        <label style={{ width: "30%", fontWeight: "bold" }}>Thời tiết:</label>
                        <select
                            value={info.temperature || 0}
                            onChange={(e) => handleChangeMode(Number(e.target.value), "temperature")}
                            className="block mb-2 mt-2 border border-gray-300 rounded-md shadow-sm bg-white"
                        >
                            {modeAutos.map((mode, idx) => (
                                <option key={idx} value={idx}>
                                    {mode}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("Tên", "name", info.name)}</div>
                <div style={{ flex: 1 }}>{renderInputRow("Khoảng thời gian điều khiển(s)", "timeNextControl", info.timeNextControl, "number")}</div>
            </div>

            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("ID điểm cuối", "idMatch", info.idMatch, "number")}</div>
                <div style={{ flex: 1 }}>{renderInputRow("Số lit mỗi xung", "unit", info.unit, "number")}</div>
            </div>

            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("Giới hạn", "percent", info.percent, "number")}</div>
                <div style={{ flex: 1 }}>{renderInputRow("Giới hạn áp cao", "maxSet", info.maxSet, "number")}</div>
            </div>

            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("Giới hạn áp thấp (ngày)", "minSetAM", info.minSetAM, "number")}</div>
                <div style={{ flex: 1 }}>{renderInputRow("Giới hạn áp thấp (đêm)", "minSet", info.minSet, "number")}</div>
            </div>

            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("Giới hạn thời gian mở van", "timeout1", info.timeout1, "number")}</div>
                <div style={{ flex: 1 }}>{renderInputRow("Giới hạn thời gian đóng van", "timeout2", info.timeout2, "number")}</div>
            </div>
            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("Giới hạn thời gian mở mềm", "timeoutO", info.timeoutO, "number")}</div>
                <div style={{ flex: 1 }}>{renderInputRow("Giới hạn thời gian đóng mềm", "timeoutC", info.timeoutC, "number")}</div>
            </div>
            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("Giới hạn sai số", "range", info.range, ["number", "number"])}</div>
                <div style={{ flex: 1 }}>
                    <div className="flex gap-4">
                        <label style={{ width: "30%", fontWeight: "bold" }}>Mức độ bám:</label>
                        <input
                            type="range"
                            min="0"
                            max="40"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}   // chỉ cập nhật UI khi kéo
                            onMouseUp={(e) => handleChangeValue(e)}      // chỉ gọi khi thả chuột
                            onTouchEnd={(e) => handleChangeValue(e)}     // chỉ gọi khi thả tay trên mobile
                            style={{ width: '300px' }}
                        />
                        <span className="font-bold text-lg w-12 text-center">{value}/40</span>
                    </div>
                </div>
            </div>

            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>
                    <div className="flex gap-4">
                        <label style={{ width: "30%", fontWeight: "bold" }}>Chế độ đóng:</label>
                        <button
                            onClick={() => {
                                if (info.flowClose > 1000) return;
                                handleSendData(Number(info.flowClose) + 1000, "flowClose")
                            }}
                            className={`px-4 py-2 text-sm rounded ${info.flowClose > 1000 ? "bg-blue-600 text-white" : "bg-gray-300 text-black"}`}
                        >
                            Giờ
                        </button>
                        <button
                            onClick={() => {
                                if (info.flowClose < 1000) return;
                                handleSendData(Number(info.flowClose) - 1000, "flowClose")
                            }}
                            className={`px-4 py-2 text-sm rounded ${info.flowClose < 1000 ? "bg-blue-600 text-white" : "bg-gray-300 text-black"}`}
                        >
                            Lưu lượng
                        </button>
                    </div>
                </div>
                <div style={{ flex: 1 }}>
                    <div className="flex gap-4">
                        <label style={{ width: "30%", fontWeight: "bold" }}>Chế độ mở:</label>
                        <button
                            onClick={() => {
                                if (info.flowOpen > 1000) return;
                                handleSendData(Number(info.flowOpen) + 1000, "flowOpen")
                            }}
                            className={`px-4 py-2 text-sm rounded ${info.flowOpen > 1000 ? "bg-blue-600 text-white" : "bg-gray-300 text-black"}`}
                        >
                            Giờ
                        </button>
                        <button
                            onClick={() => {
                                if (info.flowOpen < 1000) return;
                                handleSendData(Number(info.flowOpen) - 1000, "flowOpen")
                            }}
                            className={`px-4 py-2 text-sm rounded ${info.flowOpen < 1000 ? "bg-blue-600 text-white" : "bg-gray-300 text-black"}`}
                        >
                            Lưu lượng
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("Thời gian đóng van", "tFlowClose", info.tFlowClose, "time")}</div>
                <div style={{ flex: 1 }}>{renderInputRow("Thời gian mở van", "tFlowOpen", info.tFlowOpen, "time")}</div>
            </div>

            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("Lưu lượng đóng van vào đêm", "flowClose", info.flowClose > 1000 ? info.flowClose - 1000 : info.flowClose, "number")}</div>
                <div style={{ flex: 1 }}>{renderInputRow("Lưu lượng mở van vào ngày", "flowOpen", info.flowOpen > 1000 ? info.flowOpen - 1000 : info.flowOpen, "number")}</div>
            </div>

            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("Thời gian, áp cần đạt 1", "open1", info.open1, ["time", "time", "number"])}</div>
                <div style={{ flex: 1 }}>{renderInputRow("Thời gian, áp cần đạt 2", "open2", info.open2, ["time", "time", "number"])}</div>
            </div>

            <div style={{ display: "flex", marginTop: "20px", gap: "20px" }}>
                <div style={{ flex: 1 }}>{renderInputRow("Bắt đầu giới hạn ngày", "time_bot", info.time_bot, "time")}</div>
                <div style={{ flex: 1 }}>{renderInputRow("Kết thúc giới hạn ngày", "time_top", info.time_top, "time")}</div>
            </div>
            {renderAlarms()}
            <h3 className="text-lg font-bold">Điều chỉnh van thủ công</h3>
            <div className="flex items-center justify-center p-4">

                <div className="flex flex-wrap justify-center gap-40">
                    {/* Nút MỞ và ĐÓNG */}
                    <button
                        onClick={() => sendCommand("status", `1 ${duration * 10}`)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
                    >
                        MỞ VAN
                    </button>
                    <button
                        onClick={() => sendCommand("status", `2 ${duration * 10}`)}
                        className="bg-red-500 hover:bg-yellow-600 text-white font-semibold px-4 py-2 rounded"
                    >
                        ĐÓNG VAN
                    </button>

                    {/* Cụm nút điều chỉnh thời gian */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={decrease}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded"
                        >
                            -
                        </button>

                        <span className="text-xl font-bold w-16 text-center">
                            {duration}s
                        </span>

                        <button
                            onClick={increase}
                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded"
                        >
                            +
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
