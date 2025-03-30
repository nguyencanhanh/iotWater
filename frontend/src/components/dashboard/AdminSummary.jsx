import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import mqtt from "mqtt";
import { useAuth } from "../../context/authContext";
import { intervalUpdatePut, sensorListGet } from "../../api/index";
import ModalData from "../chart/Modal";

function AdminSummary() {
    const { user, info } = useAuth();
    const [weatherData, setWeatherData] = useState(info);
    const [data, setData] = useState(null);
    const [sensorLoading, setSensorLoading] = useState(false);
    const [newLat, setNewLat] = useState("");
    const [newLng, setNewLng] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [dateData, setDateData] = useState([]);

    // MQTT Setup
    const host = "iotwater2024.mooo.com";
    const port = 9001;
    const clientId = `mqtt_${Math.random().toString(16).slice(3)}`;
    const connectUrl = `wss://${host}:${port}/mqtt`;
    const topic = "iotwatter@2024";
    const options = { clientId, clean: true, connectTimeout: 4000, reconnectPeriod: 5000 };
    const client = mqtt.connect(connectUrl, options);

    useEffect(() => {
        const fetchSensors = async () => {
            try {
                const res = await sensorListGet(localStorage.getItem("token"), { totalMap: info.length, user: user.user });
                if (res.data.success) {
                    setData(res.data.sensors);
                } else {
                    alert("Failed to fetch sensors");
                }
            } catch (error) {
                console.error("An unexpected error occurred:", error);
                alert(error.response?.data?.error || "Something went wrong. Please try again.");
            } finally {
                setSensorLoading(false);
            }
        };
        fetchSensors();
    }, []);

    useEffect(() => {
        client.on("connect", () => console.log("Connected to MQTT broker"));
        client.on("message", (topic, messageData) => {
            messageData = JSON.parse(messageData.toString());
            if(messageData.m !== 1 || messageData.n > info.length) return;
            setData((prevData) => ({
                ...prevData,
                [messageData.n]: {
                    Pressure: messageData.d.reduce((sum, msg) => sum + msg.p, 0) / messageData.d.length,
                },
            }));
        });
        client.subscribe(topic);
        return () => client.end();
    }, []);

    const updateCoordinates = async () => {
        if (selectedId === null || isNaN(newLat) || isNaN(newLng)) {
            setErrorMessage("Vui lòng nhập tọa độ hợp lệ!");
            return;
        }
        try {
            await intervalUpdatePut(localStorage.getItem("token"), { Coor: selectedId, lat: newLat, lng: newLng, user: user.user });
        } catch (error) {
            if (error.res && !error.res.data.success) {
                alert(error.res.data.error);
            }
        }
        setWeatherData((prevData) =>
            prevData.map((point) =>
                point.id === selectedId ? { ...point, lat: parseFloat(newLat), lng: parseFloat(newLng) } : point
            )
        );
        setNewLat("");
        setNewLng("");
        setErrorMessage("");
    };

    const handleMarkerClick = (point) => {
        setShowModal(true);
        const startDate = new Date();
        const endDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(24);
        setDateData([startDate, endDate, point.id]);
    };

    return (
        <div className="relative h-screen w-full">
            {/* Bản đồ ở lớp dưới */}
            <div className="absolute inset-0 z-0">
                <MapContainer center={[weatherData[0].lat, weatherData[0].lng]} zoom={15} className="h-full w-full" zoomControl={false}>
                    <TileLayer
                        url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                        subdomains={["mt1", "mt2", "mt3"]}
                    />
                    {weatherData &&
                        data &&
                        weatherData.map((point, index) => (
                            <Marker key={index} position={[point.lat, point.lng]}
                                eventHandlers={{
                                    click: () => handleMarkerClick(point)
                                }}
                            >
                                <Tooltip permanent direction="top" className="w-150">
                                    <h3 className="text-lg font-semibold">{point.name}</h3>
                                    <table className="w-full">
                                        <tbody>
                                            <tr>
                                                <td className="text-left text-gray-600 text-lg border border-gray-300">Áp suất</td>
                                                <td className="text-left text-gray-600 text-lg border border-gray-300">{data[point.id]?.Pressure?.toFixed(2)} m</td>
                                            </tr>
                                            <tr>
                                                <td className="text-left text-gray-600 text-lg border border-gray-300">Lưu lượng</td>
                                                <td className="text-left text-gray-600 text-lg border border-gray-300">m3/h</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </Tooltip>
                            </Marker>
                        ))}
                </MapContainer>
            </div>

            {/* Nút cài đặt */}
            <button
                onClick={() => setShowSettings(!showSettings)}
                className="fixed top-12 right-4 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 z-10"
            >
                ⚙️
            </button>

            {/* Form nhập tọa độ */}
            {showSettings && (
                <div className="absolute top-16 right-4 bg-white p-4 rounded shadow-lg z-10 w-64">
                    <h3 className="text-xl font-semibold mb-2">Cập nhật tọa độ trạm</h3>
                    <div className="mb-2">
                        <label htmlFor="station" className="block mb-1">Chọn trạm</label>
                        <select id="station" className="w-full p-2 border rounded" onChange={(e) => setSelectedId(Number(e.target.value))}>
                            <option value="">Chọn trạm</option>
                            {weatherData.map((point) => (
                                <option key={point.id} value={point.id}>{point.name}</option>
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
                    <button onClick={updateCoordinates} className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
                        Cập nhật tọa độ
                    </button>
                </div>
            )}
            {showModal ? <ModalData info={weatherData} dateData={dateData} isOpen={showModal} handleCancel={() => setShowModal(false)} /> : null}
        </div>
    );
}

export default AdminSummary;
