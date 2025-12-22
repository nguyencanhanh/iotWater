import { ChartPrv } from "../components/chart/Chart";
import React, { useState } from "react";
import { useAuth } from '../context/authContext'
import { sensorListGet } from "../api/index"

function generateLabelsAndData(watch) {
    const labels = [];

    for (let i = 0; i < 1440; i += watch / 60) {
        const totalSeconds = i;
        const hour = Math.floor(totalSeconds / 60);
        const minute = i % 60
        labels.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
    return labels;
};

const Compare = () => {
    const { user, info } = useAuth()
    const [date1, setDate1] = useState("");
    const [date2, setDate2] = useState("");
    const [node1, setNode1] = useState("");
    const [node2, setNode2] = useState("");
    const [dataset, setDataset] = useState([])
    const [pram, setPram] = useState([]);
    const [pramFlow, setPramFlow] = useState([]);

    const handleCompare = async () => {
        if (date1 && date2 && node1 && node2) {
            const selectedNode1 = info.find(node => node.id === Number(node1));
            const selectedNode2 = info.find(node => node.id === Number(node2));
            try {
                const res = await sensorListGet(localStorage.getItem("token"), { total: 2, info: [selectedNode1, selectedNode2], user: user.user, date: [date1, date2] });
                if (res.data.success) {
                    console.log(res.data.sensors)
                    setDataset([
                        {
                            label: "Áp suất logger 1",
                            data: res.data.sensors[0].dataPressure,
                            borderColor: "#FF0000", // Màu xanh lá
                            tension: 0.1, // Độ cong của đường
                            borderWidth: 1,
                            pointRadius: 0, // Độ lớn điểm
                            pointBackgroundColor: "#FF0000", // Màu điể
                            yAxisID: "y1",
                            spanGaps: true
                        },
                        {
                            label: "Áp suất logger 2",
                            data: res.data.sensors[1].dataPressure,
                            borderColor: "#FF9933", // Màu xanh lá
                            tension: 0.1, // Độ cong của đường
                            borderWidth: 1,
                            pointRadius: 0, // Độ lớn điểm
                            pointBackgroundColor: "#FF9933", // Màu điể
                            yAxisID: "y1",
                            spanGaps: true
                        },
                        {
                            label: "Lưu lượng logger 1",
                            data: res.data.sensors[0].dataFlow,
                            borderColor: "#000000", // Màu xanh lá
                            tension: 0.1, // Độ cong của đường
                            borderWidth: 1,
                            pointRadius: 0, // Độ lớn điểm
                            pointBackgroundColor: "#000000", // Màu điể
                            yAxisID: "y2",
                            spanGaps: true
                        },
                        {
                            label: "Lưu lượng logger 2",
                            data: res.data.sensors[1].dataFlow,
                            borderColor: "#000080", // Màu xanh lá
                            tension: 0.1, // Độ cong của đường
                            borderWidth: 1,
                            pointRadius: 0, // Độ lớn điểm
                            pointBackgroundColor: "#000080", // Màu điể
                            yAxisID: "y2",
                            spanGaps: true
                        },
                    ])
                    setPram(res.data.pram)
                    setPramFlow(res.data.pramFlow)
                } else {
                    alert("Failed to fetch sensors");
                }
            } catch (error) {
                console.error("An unexpected error occurred:", error);
                alert(
                    error.response?.data?.error || "Something went wrong. Please try again."
                );
            }
        }
    }

    return (
        <div className="text-center mt-5">
            <h3 className="text-lg font-bold mb-4">Biểu đồ áp van</h3>

            {/* Bộ chọn ngày & node */}
            <div className="flex flex-wrap justify-center items-center gap-4 mb-6">
                {/* Ngày và node bên trái */}
                <div className="flex items-center gap-2">
                    <label className="font-medium text-sm">Logger 1:</label>
                    <input
                        type="date"
                        className="border rounded-lg px-2 py-1 text-sm"
                        value={date1}
                        onChange={(e) => setDate1(e.target.value)}
                    />
                    <select
                        className="border rounded-lg px-2 py-1 text-sm"
                        value={node1}
                        onChange={(e) => setNode1(e.target.value)}
                    >
                        <option value="" disabled>-- Chọn node --</option>
                        {info.map((logger) => (
                            <option key={logger.id} value={logger.id}>
                                {logger.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Nút so sánh ở giữa */}
                <button
                    onClick={handleCompare}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1 rounded-lg text-sm"
                >
                    So sánh
                </button>

                {/* Ngày và node bên phải */}
                <div className="flex items-center gap-2">
                    <label className="font-medium text-sm">Logger 2:</label>
                    <input
                        type="date"
                        className="border rounded-lg px-2 py-1 text-sm"
                        value={date2}
                        onChange={(e) => setDate2(e.target.value)}
                    />
                    <select
                        className="border rounded-lg px-2 py-1 text-sm"
                        value={node2}
                        onChange={(e) => setNode2(e.target.value)}
                    >
                        <option value="" disabled>-- Chọn node --</option>
                        {info.map((logger) => (
                            <option key={logger.id} value={logger.id}>
                                {logger.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Biểu đồ */}
            <ChartPrv
                label={generateLabelsAndData(60)}
                dataset={dataset}
            />
            <h3 className="text-lg font-bold mb-3 text-center">Bảng so sánh thông số</h3>

            <div className="overflow-x-auto border rounded-xl shadow-sm">
                <table className="min-w-full border-collapse text-center text-sm">
                    <thead className="bg-gray-100 font-semibold">
                        <tr>
                            <th className="border border-gray-300 p-2">Thông số</th>
                            <th className="border border-gray-300 p-2">Node 1 ({date1})</th>
                            <th className="border border-gray-300 p-2">Node 2 ({date2})</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white">
                        <tr>
                            <td className="border border-gray-300 p-2 font-medium">Áp suất Max (m)</td>
                            <td className="border border-gray-300 p-2">{pram[0]?.max}</td>
                            <td className="border border-gray-300 p-2">{ pram[1]?.max}</td>
                        </tr>
                        <tr className="bg-gray-50">
                            <td className="border border-gray-300 p-2 font-medium">Áp suất Min (m)</td>
                            <td className="border border-gray-300 p-2">{pram[0]?.min}</td>
                            <td className="border border-gray-300 p-2">{pram[1]?.min}</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-300 p-2 font-medium">Áp suất Avg (m)</td>
                            <td className="border border-gray-300 p-2">{pram[0]?.avg?.toFixed(1)}</td>
                            <td className="border border-gray-300 p-2">{pram[1]?.avg?.toFixed(1)}</td>
                        </tr>
                        <tr className="bg-gray-50">
                            <td className="border border-gray-300 p-2 font-medium">Lưu lượng Max(m³/h)</td>
                            <td className="border border-gray-300 p-2">{pramFlow[0]?.maxFlow}</td>
                            <td className="border border-gray-300 p-2">{pramFlow[1]?.maxFlow}</td>
                        </tr>
                        <tr className="bg-gray-50">
                            <td className="border border-gray-300 p-2 font-medium">Lưu lượng Min(m³/h)</td>
                            <td className="border border-gray-300 p-2">{pramFlow[0]?.minFlow}</td>
                            <td className="border border-gray-300 p-2">{pramFlow[1]?.minFlow}</td>
                        </tr>
                        <tr>
                            <td className="border border-gray-300 p-2 font-medium">Tổng sản lượng (m³)</td>
                            <td className="border border-gray-300 p-2">{pramFlow[0]?.total24?.toFixed(1)}</td>
                            <td className="border border-gray-300 p-2">{pramFlow[1]?.total24?.toFixed(1)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default Compare