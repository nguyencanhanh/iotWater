import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import mqtt from 'mqtt';
import { useAuth } from '../../context/authContext'
import { intervalUpdatePut, sensorListGet } from "../../api/index";

function AdminSummary() {
    const { user } = useAuth()
    const [weatherData, setWeatherData] = useState(user.sen_id);
    const dataA = []
    const [data, setData] = useState(null)
    const [newLat, setNewLat] = useState("");
    const [newLng, setNewLng] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [showSettings, setShowSettings] = useState(false); // State để kiểm soát việc hiển thị phần cài đặt
    const host = 'broker.hivemq.com';
    const port = 8884;
    const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
    const connectUrl = `wss://${host}:${port}/mqtt`;
    const topic = 'iotwatter@2024';
    let temperature = 0;
    let pressure = 0;
    const options = {
        clientId,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 5000,
    }
    const client = mqtt.connect(connectUrl, options);

    const fetchSensors = async () => {
        try {
            const res = await sensorListGet(localStorage.getItem("token"), { totalMap: user.total });
            if (res.data.success) {
                setData(res.data.sensors)
            } else {
                alert("Failed to fetch sensors");
            }
        } catch (error) {
            console.error("An unexpected error occurred:", error);
            alert(
                error.response?.data?.error || "Something went wrong. Please try again."
            );
        } finally {
            setSensorLoading(false);
        }
    };
    useEffect(() => {
        fetchSensors();
    }, []);
    useEffect(() => {
        client.on("connect", () => {
            console.log("Connected to MQTT broker");
        });
        client.on('message', async (topic, messageData) => {
            messageData = JSON.parse(messageData.toString());
            const sen_name = Number(messageData.sen_name);
            const msg_id = Number(messageData.msg_id)
            messageData.data.forEach(async (message) => {
                if (msg_id === 1) {
                    // medium temp and pressure
                    temperature += message.temperature;
                    pressure += message.Pressure;
                }
            })
            dataA[sen_name].temperature = temperature / messageData.data.length;
            dataA[sen_name].Pressure = pressure / messageData.data.length;
            setData(dataA)
        });
        client.subscribe(topic)
        return () => {
            client.end();
        };
    }, []);
    const updateCoordinates = async () => {
        if (selectedId === null || isNaN(newLat) || isNaN(newLng)) {
            setErrorMessage("Vui lòng nhập tọa độ hợp lệ!");
            return;
        }
        try {
            const res = await intervalUpdatePut(localStorage.getItem("token"), { Coor: selectedId, lat: newLat, lng: newLng })
        } catch (error) {
            if (error.res && !error.res.data.success) {
                alert(error.res.data.error);
            }
        }

        // Cập nhật lại tọa độ của điểm đo
        const updatedData = weatherData.map((point) =>
            point.id === selectedId
                ? { ...point, lat: parseFloat(newLat), lng: parseFloat(newLng) }
                : point
        );

        // Cập nhật lại trạng thái weatherData và reset các trường nhập liệu
        setWeatherData(updatedData);
        setNewLat("");
        setNewLng("");
        setErrorMessage(""); // Xóa thông báo lỗi
    };

    return (
        <div className="relative">
            {/* Nút cài đặt */}
            <button
                onClick={() => setShowSettings(!showSettings)}  // Chuyển trạng thái hiển thị phần cài đặt
                className="fixed top-4 right-4 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 z-50"
                style={{ zIndex: 999 }}
            >
                ⚙️
            </button>

            {/* Form nhập tọa độ (ẩn khi showSettings là false) */}
            {showSettings && (
                <div
                    className="absolute top-16 right-4 bg-white p-4 rounded shadow-lg z-50 w-64"
                    style={{ zIndex: 999 }}
                >
                    <h3 className="text-xl font-semibold mb-2">Cập nhật tọa độ trạm</h3>
                    <div className="mb-2">
                        <label htmlFor="station" className="block mb-1">Chọn trạm</label>
                        <select
                            id="station"
                            className="w-full p-2 border rounded"
                            onChange={(e) => setSelectedId(Number(e.target.value))}
                        >
                            <option value="">Chọn trạm</option>
                            {weatherData.map((point, index) => (
                                <option key={point.id} value={point.id}>
                                    {point.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="mb-2">
                        <label htmlFor="latitude" className="block mb-1">Vĩ độ</label>
                        <input
                            type="number"
                            id="latitude"
                            className="w-full p-2 border rounded"
                            placeholder="Nhập vĩ độ"
                            value={newLat}
                            onChange={(e) => setNewLat(e.target.value)}
                        />
                    </div>
                    <div className="mb-2">
                        <label htmlFor="longitude" className="block mb-1">Kinh độ</label>
                        <input
                            type="number"
                            id="longitude"
                            className="w-full p-2 border rounded"
                            placeholder="Nhập kinh độ"
                            value={newLng}
                            onChange={(e) => setNewLng(e.target.value)}
                        />
                    </div>
                    {errorMessage && <p className="text-red-500">{errorMessage}</p>}
                    <button
                        onClick={updateCoordinates}
                        className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
                    >
                        Cập nhật tọa độ
                    </button>
                </div>
            )}

            {/* Bản đồ */}
            {!data? (
                <div className="flex justify-center items-center h-screen">
                    <div>Loading...</div>
                </div>
            ) : (<MapContainer center={[21.028511, 105.804817]} zoom={15} className="h-screen w-full">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {weatherData.map((point, index) => (
                    <Marker key={index} position={[point.lat, point.lng]}>
                        <Tooltip permanent direction="top" className="bg-white text-black p-1 text-xs rounded shadow-md">
                            🌡 {data[point.id]?.temperature || 30}°C | 🌬 {data[point.id]?.Pressure.toFixed(2) || 1.1} Bar
                        </Tooltip>
                    </Marker>
                ))}
            </MapContainer>)}
        </div>
    );
}

export default AdminSummary;
