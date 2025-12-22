import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, GeoJSON, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
// import mqtt from "mqtt";
import { useAuth } from "../../context/authContext";
import { intervalUpdatePut, sensorListGet, getGroup } from "../../api/index";
import ModalData from "../chart/Modal";
import { client } from "../../pages/AdminDashboard";
// import { produce } from "immer";
// import L from "leaflet";


const AlertMarker = ({ lat, lng, level }) => {
    const markerRef = useRef();
  
    useEffect(() => {
      if (!markerRef.current || !level || level === "normal") return;
  
      let visible = true;
      const interval = setInterval(() => {
        markerRef.current.setStyle({
          fillOpacity: visible ? 0.2 : 0.8,
        });
        visible = !visible;
      }, 500);
  
      return () => clearInterval(interval);
    }, [level]);
  
    if (!level || level === "normal") return null;
  
    const color = level === "danger" ? "red" : "orange";
  
    return (
      <CircleMarker
        ref={markerRef}
        center={[lat, lng]}
        radius={10}
        pathOptions={{ color, fillColor: color, fillOpacity: 0.8 }}
      />
    );
  };

function AdminSummary() {
    const { user, info } = useAuth();
    const [weatherData, setWeatherData] = useState(info);
    const [data, setData] = useState(null);
    // const [sensorLoading, setSensorLoading] = useState(false);
    const [newLat, setNewLat] = useState("");
    const [newLng, setNewLng] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    // const [selectedG, setSelectedG] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [showSettings, setShowSettings] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [dateData, setDateData] = useState([]);
    const [groups, setGroups] = useState([]);
    const [pipeLayer, setPipesLayer] = useState(null);
    const [metersLayer, setMetersLayer] = useState(null);
    const [warning, setWarning] = useState({})
    const topic = "iotwatter@2024";
    const topicWarning = "khca/warning"

    useEffect(() => {
        const fetchSensors = async () => {
            try {
                const res = await sensorListGet(localStorage.getItem("token"), { totalMap: info, user: user.user });
                if (res.data.success) {
                    setData(res.data.sensors);
                } else {
                    alert("Failed to fetch sensors");
                }
            } catch (error) {
                console.error("An unexpected error occurred:", error);
                alert(error.response?.data?.error || "Something went wrong. Please try again.");
            }
        };

        const fetchGroups = async () => {
            try {
                const res = await getGroup(localStorage.getItem("token"), user.user)
                setGroups(res.data.group)
            } catch (error) {
                console.error("An unexpected error occurred:", error);
                alert(
                    error.response?.data?.error || "Something went wrong. Please try again."
                );
            }
        }
        fetchGroups();
        fetchSensors();
    }, []);

    useEffect(() => {
        client.on("connect", () => console.log("Connected to MQTT broker"));
        client.on("message", (topicGet, messageData) => {
            if (topicGet === topic) {
                messageData = JSON.parse(messageData.toString());
                if (messageData.m !== 1 || messageData.n > info.length) return;
                setData((prevData) => ({
                    ...prevData,
                    [messageData.n]: {
                        Pressure: messageData.d.reduce((sum, msg) => sum + msg.p, 0) / messageData.d.length,
                        flow: messageData.d[messageData.d.length - 1].f
                    },
                }));
            }
            else if (topicGet === topicWarning) {
                console.log(messageData.toString())
                messageData = JSON.parse(messageData.toString());
                setWarning((prev) => ({
                    ...prev,
                    [messageData.n]: messageData.d
                }));
            }
        });
        client.subscribe(topic);
        client.subscribe(topicWarning, { qos: 2 })
        return () => client.end();
    }, []);

    useEffect(() => {
        fetch("/json/pipes1.json").then(res => res.json()).then(setPipesLayer);
        fetch("/json/pipes2.json").then(res => res.json()).then(setMetersLayer);
        // fetch("/json/pipes3.json").then(res => res.json()).then(setValvesLayer);
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
        endDate.setHours(24, 0, 0, 0);
        setDateData([startDate, endDate, point.id, point.name, point.adj]);
    };

    const changeGroupMap = (e) => {
        setWeatherData(info.filter((group) => group.group.toLowerCase().includes(e.target.value.toLowerCase())))
    }

    return (
        <div className="relative h-screen w-full">
            {/* Bản đồ ở lớp dưới */}
            <div className="absolute inset-0 z-0">
                <MapContainer center={[weatherData[0].lat, weatherData[0].lng]} zoom={15} className="h-full w-full" zoomControl={false}>
                    <TileLayer
                        url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                        subdomains={["mt1", "mt2", "mt3"]}
                    />
                    {/* ✅ HIỂN THỊ ĐƯỜNG ỐNG */}
                    {pipeLayer && (
                        <>
                            {/* Lớp phụ để bắt sự kiện click, nhưng không hiển thị gì */}
                            <GeoJSON
                                data={pipeLayer}
                                style={() => ({
                                    color: "#ffffff",
                                    weight: 40,
                                    opacity: 0, // Vô hình
                                })}
                                onEachFeature={(feature, layer) => {
                                    const name = feature.properties?.name || "Không tên";
                                    const desc = feature.properties?.description || "";
                                    layer.bindPopup(`<strong>${name}</strong><br/>${desc}`);
                                }}
                            />

                            {/* Lớp chính để hiển thị đường ống thật sự */}
                            <GeoJSON
                                data={pipeLayer}
                                style={(feature) => ({
                                    color: feature.properties?.stroke || "#0000FF",
                                    weight: feature.properties?.["stroke-width"] || 2,
                                    opacity: feature.properties?.["stroke-opacity"] || 1,
                                })}
                            />
                        </>
                    )}
                    {metersLayer && (
                        <>
                            {/* Lớp phụ để bắt click, vô hình nhưng rộng */}
                            <GeoJSON
                                data={metersLayer}
                                style={() => ({
                                    color: "#ffffff",       // Màu trắng để dễ phân biệt (nhưng opacity = 0)
                                    weight: 40,             // Rộng hơn để dễ click
                                    opacity: 0,             // Vô hình
                                })}
                                onEachFeature={(feature, layer) => {
                                    if (feature.properties?.name || feature.properties?.description) {
                                        const name = feature.properties.name || "Không tên";
                                        const desc = feature.properties.description || "";
                                        layer.bindPopup(`<strong>${name}</strong><br/>${desc}`);
                                    }
                                }}
                            />

                            {/* Lớp chính hiển thị thật sự */}
                            <GeoJSON
                                data={metersLayer}
                                style={(feature) => ({
                                    color: feature.properties?.stroke || "#0000FF", // fallback màu xanh dương
                                    weight: feature.properties?.["stroke-width"] || 2,
                                    opacity: feature.properties?.["stroke-opacity"] || 1,
                                })}
                            />
                        </>
                    )}
                    {/* {valvesLayer && (
                        <GeoJSON
                            data={valvesLayer}
                            style={{ color: "red", weight: 2, dashArray: "4" }}
                            onEachFeature={(f, layer) => layer.bindPopup(f.properties.name || "Van")}
                        />
                    )} */}


                    {weatherData &&
                        data &&
                        weatherData.map((point, index) => (
                            <React.Fragment key={point.id}>
                                <AlertMarker
                                    lat={point.lat}
                                    lng={point.lng}
                                    level={point.warning}
                                />
                                <Marker position={[point.lat, point.lng]}
                                    eventHandlers={{
                                        click: () => handleMarkerClick(point)
                                    }}
                                >
                                    <Tooltip permanent direction="top" className="w-150">
                                        <h3 className="font-semibold">{point.name}</h3>
                                        <table className="w-full">
                                            <tbody>
                                                <tr>
                                                    <td className="text-left text-gray-600 border border-gray-300">Áp suất</td>
                                                    <td className="text-left text-gray-600 border text-center border-gray-300">{(data[point.id]?.Pressure + point.adj)?.toFixed(2)} m</td>
                                                </tr>
                                                <tr>
                                                    <td className="text-left text-gray-600 border border-gray-300">Lưu lượng</td>
                                                    <td className="text-left text-gray-600 border text-center border-gray-300">{data[point.id]?.flow} m3/h</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </Tooltip>
                                </Marker>
                            </React.Fragment>
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
                        <label htmlFor="group" className="block mb-1">Chọn nhóm</label>
                        <select id="group" className="w-full p-2 border rounded" onChange={changeGroupMap}>
                            <option value="">Chọn nhóm</option>
                            <option value="">Tất cả</option>
                            {groups.map((point) => (
                                <option value={point}>{point}</option>
                            ))}
                        </select>
                    </div>
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
