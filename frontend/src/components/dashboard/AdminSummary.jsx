import React, { lazy, Suspense, useEffect, useMemo, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Tooltip, GeoJSON, CircleMarker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../map/leafletIconFix";
import { FaBullhorn, FaCheckCircle, FaChevronLeft, FaChevronRight, FaExclamationTriangle, FaGlobeAsia, FaHistory, FaPaperPlane, FaSyncAlt, FaTrashAlt, FaUnlink } from "react-icons/fa";

// import mqtt from "mqtt";
import { useAuth } from "../../context/authContext";
import { mapPointImageUrl, sensorListGet, getGroup, warningHistoryTodayGet, homeMessagesGet, homeMessagePost, homeMessageDelete, generalSettingsGet } from "../../api/index";
import ModalData from "../chart/Modal";
import MapPointLayer from "../map/MapPointLayer";
import MapPointControl from "../map/MapPointControl";
import MapPointForm from "../map/MapPointForm";
import useMapPoints from "../map/useMapPoints";
import { getMqttClient } from "../../pages/AdminDashboard";

const IncidentReportPanel = lazy(() => import("../map/IncidentReportPanel"));
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

const StatusCard = ({ label, value, icon, colorClass }) => (
    <div className="flex items-center gap-3 rounded border border-gray-200 bg-white p-3 shadow-sm">
        <div className={`flex h-9 w-9 items-center justify-center rounded text-white ${colorClass}`}>
            {icon}
        </div>
        <div>
            <div className="text-sm text-gray-700">{label}</div>
            <div className="text-lg font-bold leading-tight text-gray-900">{value}</div>
        </div>
    </div>
);

const MARKER_TOOLTIP_MIN_ZOOM = 15;
const DEFAULT_MAP_CENTER = [21.2731, 106.1946];
const WARNING_HISTORY_PAGE_SIZE = 20;

const getDateInputValue = (date = new Date()) => {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const MapZoomTracker = ({ onZoomChange }) => {
    const map = useMapEvents({
        zoomend: () => onZoomChange(map.getZoom()),
    });

    useEffect(() => {
        onZoomChange(map.getZoom());
    }, [map, onZoomChange]);

    return null;
};

const formatMetric = (value, digits = 2) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(digits) : "--";
};

const formatHistoryTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--:--";
    return date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

const formatMessageTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "--/-- --:--";
    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const isSameHomeMessages = (current = [], next = []) => (
    current.length === next.length
    && current.every((item, index) => {
        const nextItem = next[index];
        return item?._id === nextItem?._id
            && item?.sender === nextItem?.sender
            && item?.message === nextItem?.message
            && item?.createAt === nextItem?.createAt;
    })
);

const warningTypeLabels = {
    lost_signal: "Mất tín hiệu",
    pressure_high: "Áp cao",
    pressure_low: "Áp thấp",
    pressure_target: "Chưa đạt áp",
    temperature_high: "Nhiệt độ",
    warning: "Cảnh báo",
};

const getWarningTypeLabel = (type) => warningTypeLabels[type] || "Cảnh báo";

const getNameFromWarningMessage = (message = "") => {
    const match = String(message).match(/(?:cảm biến|logger)\s+(.+?)\s+vào lúc/i);
    return match?.[1]?.trim() || "";
};

const getHistorySensorLabel = (item) => {
    const sensorId = Number(item.sensorId);
    if (Number.isFinite(sensorId) && item.sensorName) return `${sensorId} - ${item.sensorName}`;
    if (Number.isFinite(sensorId)) return `Logger ${sensorId}`;
    if (item.sensorName) return item.sensorName;
    return getNameFromWarningMessage(item.message) || "Không rõ logger";
};

const getHistoryGroupLabel = (item) => (
    item.group && item.group !== "Không có" ? item.group : "Chưa xác định"
);

function AdminSummary() {
    const { user, info } = useAuth();
    user.user = 0;
    const [weatherData, setWeatherData] = useState(info);
    const [data, setData] = useState(null);
    // const [sensorLoading, setSensorLoading] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState("");
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isMessagePanelOpen, setIsMessagePanelOpen] = useState(false);
    const [panelTab, setPanelTab] = useState("status");
    const [mapZoom, setMapZoom] = useState(MARKER_TOOLTIP_MIN_ZOOM);
    const [mapTooltipMinZoom, setMapTooltipMinZoom] = useState(MARKER_TOOLTIP_MIN_ZOOM);
    const [warningHistory, setWarningHistory] = useState([]);
    const [warningHistoryLoading, setWarningHistoryLoading] = useState(false);
    const [warningHistoryLoadingMore, setWarningHistoryLoadingMore] = useState(false);
    const [warningHistoryHasMore, setWarningHistoryHasMore] = useState(false);
    const [warningHistorySkip, setWarningHistorySkip] = useState(0);
    const [warningHistoryDate, setWarningHistoryDate] = useState(getDateInputValue());
    const [homeMessages, setHomeMessages] = useState([]);
    const [homeMessagesLoading, setHomeMessagesLoading] = useState(false);
    const [messageSender, setMessageSender] = useState("");
    const [messageText, setMessageText] = useState("");
    const [messageSending, setMessageSending] = useState(false);
    const [messageStatus, setMessageStatus] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [dateData, setDateData] = useState([]);
    const [groups, setGroups] = useState([]);
    const [pipeLayer, setPipesLayer] = useState(null);
    const [showMapPoints, setShowMapPoints] = useState(true);
    const [showHotspots, setShowHotspots] = useState(false);
    const [addPointMode, setAddPointMode] = useState(false);
    const [pointFormOpen, setPointFormOpen] = useState(false);
    const [editingPoint, setEditingPoint] = useState(null);
    const [draftLocation, setDraftLocation] = useState(null);
    const [reportPanelOpen, setReportPanelOpen] = useState(false);
    const [metersLayer, setMetersLayer] = useState(null);
    const [warning, setWarning] = useState({})
    const warningHistoryRequestRef = useRef(false);
    const homeMessagesLoadedRef = useRef(false);
    const client = getMqttClient();
    const topic = "iotwatter@2024";
    const topicWarning = "khca/warning"

    const canEditMapPoints = user?.role !== "trial";
    const mapPoints = useMapPoints({ user: user.user, canEdit: canEditMapPoints });

    // Khu vuc cho su co: gop nhom logger co san voi nhom da dung o cac diem truoc do.
    const incidentGroups = useMemo(() => [...new Set([
        ...groups.map((item) => item?.name).filter(Boolean),
        ...mapPoints.groups,
    ])].sort((a, b) => a.localeCompare(b, "vi")), [groups, mapPoints.groups]);

    useEffect(() => {
        if (showHotspots) mapPoints.loadHotspots();
    }, [showHotspots, mapPoints.points.length]);

    const handlePickLocation = (location) => {
        setDraftLocation(location);
        setEditingPoint(null);
        setPointFormOpen(true);
        setAddPointMode(false);
    };

    const handleEditPoint = (point) => {
        setEditingPoint(point);
        setDraftLocation({ lat: point.lat, lng: point.lng });
        setPointFormOpen(true);
    };

    const handleSubmitPoint = async (payload) => {
        const saved = await mapPoints.savePoint(payload, editingPoint);
        if (!saved) return;
        // Vua tao xong thi giu form mo o che do sua, de nguoi dung dinh anh luon.
        if (editingPoint) {
            setPointFormOpen(false);
            setEditingPoint(null);
            setDraftLocation(null);
        } else {
            setEditingPoint(saved);
        }
        if (showHotspots) mapPoints.loadHotspots();
    };

    // Doi toa do tu trong form (dan link Google Maps / lay vi tri hien tai).
    const handleCoordinateChange = (coordinate) => {
        setDraftLocation(coordinate);
        setEditingPoint((prev) => (prev ? { ...prev, ...coordinate } : prev));
    };

    const handleUploadImages = async (point, files) => {
        const updated = await mapPoints.uploadImages(point, files);
        if (updated) setEditingPoint(updated);
    };

    const handleDeleteImage = async (point, name) => {
        const updated = await mapPoints.removeImage(point, name);
        if (updated) setEditingPoint(updated);
    };

    const handleDeletePoint = async (point) => {
        if (!window.confirm(`Xoá điểm "${point.title}"?`)) return;
        const removed = await mapPoints.removePoint(point);
        if (!removed) return;
        setPointFormOpen(false);
        setEditingPoint(null);
        setDraftLocation(null);
        if (showHotspots) mapPoints.loadHotspots();
    };

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
        const sensors = Array.isArray(info) ? info : [];
        setWeatherData(
            selectedGroup
                ? sensors.filter((sensor) => sensor.group === selectedGroup)
                : sensors
        );
    }, [info, selectedGroup]);

    useEffect(() => {
        // client.on("connect", () => console.log("Connected to MQTT broker"));
        client.on("message", (topicGet, messageData) => {
            if (topicGet === topic) {
                messageData = JSON.parse(messageData.toString());
                if (messageData.m !== 1) return;
                setData((prevData) => ({
                    ...prevData,
                    [messageData.n]: {
                        Pressure: messageData.d.reduce((sum, msg) => sum + msg.p, 0) / messageData.d.length,
                        flow: messageData.d[messageData.d.length - 1].f,
                        createAt: new Date().toISOString(),
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
        // return () => client.end();
    }, []);

    useEffect(() => {
        fetch("/json/pipes1.json").then(res => res.json()).then(setPipesLayer).catch(err => console.error("pipes1.json:", err));
        // fetch("/json/pipes2.json").then(res => res.json()).then(setMetersLayer).catch(err => console.error("pipes2.json:", err));
    }, []);

    useEffect(() => {
        let canceled = false;
        const fetchGeneralSettings = async () => {
            try {
                const res = await generalSettingsGet(localStorage.getItem("token"), user.user);
                const zoom = Number(res.data.setting?.mapTooltipMinZoom);
                if (!canceled && res.data.success && Number.isFinite(zoom)) {
                    setMapTooltipMinZoom(Math.min(Math.max(Math.round(zoom), 1), 22));
                }
            } catch (error) {
                if (!canceled) {
                    console.error("Không tải được cài đặt zoom bản đồ:", error);
                    setMapTooltipMinZoom(MARKER_TOOLTIP_MIN_ZOOM);
                }
            }
        };

        fetchGeneralSettings();
        return () => {
            canceled = true;
        };
    }, [user.user]);

    useEffect(() => {
        let canceled = false;
        const fetchWarningHistory = async () => {
            warningHistoryRequestRef.current = true;
            setWarningHistoryLoading(true);
            setWarningHistoryHasMore(false);
            setWarningHistorySkip(0);
            try {
                const res = await warningHistoryTodayGet(
                    localStorage.getItem("token"),
                    user.user,
                    selectedGroup,
                    {
                        date: warningHistoryDate,
                        limit: WARNING_HISTORY_PAGE_SIZE,
                        skip: 0,
                    }
                );
                if (!canceled && res.data.success) {
                    const histories = res.data.histories || [];
                    setWarningHistory(histories);
                    setWarningHistoryHasMore(Boolean(res.data.hasMore));
                    setWarningHistorySkip(Number(res.data.nextSkip) || histories.length);
                }
            } catch (error) {
                if (!canceled) {
                    console.error("Không lấy được lịch sử cảnh báo:", error);
                    setWarningHistory([]);
                    setWarningHistoryHasMore(false);
                    setWarningHistorySkip(0);
                }
            } finally {
                if (!canceled) {
                    setWarningHistoryLoading(false);
                    warningHistoryRequestRef.current = false;
                }
            }
        };

        fetchWarningHistory();
        return () => {
            canceled = true;
            warningHistoryRequestRef.current = false;
        };
    }, [selectedGroup, user.user, warningHistoryDate]);

    useEffect(() => {
        let canceled = false;
        homeMessagesLoadedRef.current = false;
        const fetchHomeMessages = async () => {
            if (!homeMessagesLoadedRef.current) setHomeMessagesLoading(true);
            try {
                const res = await homeMessagesGet(localStorage.getItem("token"), user.user);
                if (!canceled && res.data.success) {
                    const nextMessages = res.data.messages || [];
                    setHomeMessages((current) => (
                        isSameHomeMessages(current, nextMessages) ? current : nextMessages
                    ));
                }
            } catch (error) {
                if (!canceled) {
                    console.error("Không lấy được tin nhắn trang chủ:", error);
                    setHomeMessages((current) => current.length ? [] : current);
                }
            } finally {
                if (!canceled) {
                    homeMessagesLoadedRef.current = true;
                    setHomeMessagesLoading(false);
                }
            }
        };

        fetchHomeMessages();
        const timer = setInterval(fetchHomeMessages, 30000);
        return () => {
            canceled = true;
            clearInterval(timer);
        };
    }, [user.user]);

    const handleMarkerClick = (point) => {
        setShowModal(true);
        const startDate = new Date();
        const endDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(24, 0, 0, 0);
        setDateData([startDate, endDate, point.id, point.name, point.adj]);
    };

    const changeGroupMap = (e) => {
        setSelectedGroup(e.target.value);
    }

    const loadMoreWarningHistory = async () => {
        if (warningHistoryRequestRef.current || warningHistoryLoading || warningHistoryLoadingMore || !warningHistoryHasMore) return;

        warningHistoryRequestRef.current = true;
        setWarningHistoryLoadingMore(true);
        try {
            const res = await warningHistoryTodayGet(
                localStorage.getItem("token"),
                user.user,
                selectedGroup,
                {
                    date: warningHistoryDate,
                    limit: WARNING_HISTORY_PAGE_SIZE,
                    skip: warningHistorySkip,
                }
            );
            if (res.data.success) {
                const histories = res.data.histories || [];
                setWarningHistory((prev) => [...prev, ...histories]);
                setWarningHistoryHasMore(Boolean(res.data.hasMore));
                setWarningHistorySkip(Number(res.data.nextSkip) || warningHistorySkip + histories.length);
            }
        } catch (error) {
            console.error("Không tải thêm được lịch sử cảnh báo:", error);
        } finally {
            setWarningHistoryLoadingMore(false);
            warningHistoryRequestRef.current = false;
        }
    };

    const handleWarningHistoryScroll = (event) => {
        const element = event.currentTarget;
        const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
        if (distanceToBottom < 48) {
            loadMoreWarningHistory();
        }
    };

    const handleSendHomeMessage = async (event) => {
        event.preventDefault();
        const sender = messageSender.trim();
        const message = messageText.trim();
        if (!sender || !message) {
            setMessageStatus("Vui lòng nhập người gửi và nội dung.");
            return;
        }

        setMessageSending(true);
        setMessageStatus("");
        try {
            const res = await homeMessagePost(localStorage.getItem("token"), {
                user: user.user,
                sender,
                message,
            });
            if (res.data.success) {
                setHomeMessages((prev) => [res.data.message, ...prev]);
                setMessageText("");
                setMessageStatus("Đã gửi thông báo.");
            }
        } catch (error) {
            setMessageStatus(error.response?.data?.error || "Không gửi được thông báo.");
        } finally {
            setMessageSending(false);
        }
    };

    const handleDeleteHomeMessage = async (messageId) => {
        if (!messageId) return;
        const confirmed = window.confirm("Xoá tin nhắn này?");
        if (!confirmed) return;

        setMessageStatus("");
        try {
            const res = await homeMessageDelete(localStorage.getItem("token"), messageId);
            if (res.data.success) {
                setHomeMessages((prev) => prev.filter((item) => item._id !== messageId));
                setMessageStatus("Đã xoá tin nhắn.");
            }
        } catch (error) {
            setMessageStatus(error.response?.data?.error || "Không xoá được tin nhắn.");
        }
    };

    const getWarningLevel = (point) => warning[point.id] || point.warning;
    const isSensorConnected = (point) => {
        const latest = data?.[point.id];
        if (!latest) return false;

        const pressure = Number(latest.Pressure);
        const flow = Number(latest.flow);
        const hasValidValue = Number.isFinite(pressure) || Number.isFinite(flow);
        const lastTime = new Date(latest.createAt).getTime();
        if (!hasValidValue || !Number.isFinite(lastTime)) return false;

        // Phai dua vao "interval" (chu ky logger DAY du lieu len, giay), khong phai
        // "watch" (chu ky LAY MAU, mac dinh 60s va khong doi khi nguoi dung sua interval).
        // Logger dat interval 1800 (30 phut) van bi bao do vi 60*3 = 180s luon thua
        // nguong san 15 phut. Cong thuc nay khop voi isConnected() ben server.
        const pushPeriodSec = Number(point.interval) || Number(point.watch) || 60;
        const maxAgeMs = Math.max(pushPeriodSec * 2 * 1000, 15 * 60 * 1000);
        return Date.now() - lastTime <= maxAgeMs;
    };
    const totalSensors = weatherData?.length || 0;
    const connectedSensors = weatherData?.filter((point) => isSensorConnected(point)).length || 0;
    const lostSensors = Math.max(totalSensors - connectedSensors, 0);
    const warningSensors = weatherData?.filter((point) => {
        const level = getWarningLevel(point);
        return level && level !== "normal";
    }).length || 0;
    const showMarkerTooltip = mapZoom >= mapTooltipMinZoom;
    // weatherData co the la null o lan render dau (info chua tai xong).
    const firstSensor = Array.isArray(weatherData) ? weatherData[0] : null;
    const mapCenter = Number.isFinite(Number(firstSensor?.lat)) && Number.isFinite(Number(firstSensor?.lng))
        ? [Number(firstSensor.lat), Number(firstSensor.lng)]
        : DEFAULT_MAP_CENTER;

    return (
        <div className="relative h-full min-h-[calc(100vh-3.5rem)] w-full overflow-hidden">
            {/* Bản đồ ở lớp dưới */}
            <div className="absolute inset-0 z-0">
                <MapContainer center={mapCenter} zoom={15} className="h-full w-full" zoomControl={false}>
                    <MapZoomTracker onZoomChange={setMapZoom} />
                    <TileLayer
                        url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                        subdomains={["mt1", "mt2", "mt3"]}
                    />
                    <TileLayer
                        url="https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}"
                        subdomains={["mt1", "mt2", "mt3"]}
                    />
                    {/* ✅ HIỂN THỊ ĐƯỜNG ỐNG */}
                    {pipeLayer && (
                        <>
                            {/* Lớp phụ để bắt sự kiện click, nhưng không hiển thị gì */}
                            <GeoJSON
                                key={`pipe-hit-${addPointMode}`}
                                data={pipeLayer}
                                style={() => ({
                                    color: "#ffffff",
                                    weight: 40,
                                    opacity: 0, // Vô hình
                                    // Khi đang thêm điểm, lớp bắt click này phải nhường click cho bản đồ.
                                    interactive: !addPointMode,
                                })}
                                onEachFeature={(feature, layer) => {
                                    const name = feature.properties?.name || "Không tên";
                                    const desc = feature.properties?.description || "";
                                    layer.bindPopup(`<strong>${name}</strong><br/>${desc}`);
                                }}
                            />

                            {/* Lớp chính để hiển thị đường ống thật sự */}
                            <GeoJSON
                                key={`pipe-line-${addPointMode}`}
                                data={pipeLayer}
                                style={(feature) => ({
                                    color: feature.properties?.stroke || "#0000FF",
                                    weight: feature.properties?.["stroke-width"] || 2,
                                    opacity: feature.properties?.["stroke-opacity"] || 1,
                                    interactive: !addPointMode,
                                })}
                            />
                        </>
                    )}
                    {metersLayer && (
                        <>
                            {/* Lớp phụ để bắt click, vô hình nhưng rộng */}
                            <GeoJSON
                                key={`meter-hit-${addPointMode}`}
                                data={metersLayer}
                                style={() => ({
                                    color: "#ffffff",       // Màu trắng để dễ phân biệt (nhưng opacity = 0)
                                    weight: 40,             // Rộng hơn để dễ click
                                    opacity: 0,             // Vô hình
                                    interactive: !addPointMode,
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
                                key={`meter-line-${addPointMode}`}
                                data={metersLayer}
                                style={(feature) => ({
                                    color: feature.properties?.stroke || "#0000FF", // fallback màu xanh dương
                                    weight: feature.properties?.["stroke-width"] || 2,
                                    opacity: feature.properties?.["stroke-opacity"] || 1,
                                    interactive: !addPointMode,
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
                        weatherData.map((point) => {
                            const connected = isSensorConnected(point);
                            const latest = data?.[point.id];
                            const pressure = Number(latest?.Pressure) + Number(point.adj || 0);
                            const flow = Number(latest?.flow);
                            const warningLevel = getWarningLevel(point);
                            const isWarning = warningLevel && warningLevel !== "normal";
                            const tooltipStateClass = !connected
                                ? "animate-pulse border-red-500 bg-red-50 shadow-red-300"
                                : isWarning
                                    ? "animate-pulse border-amber-500 bg-amber-50 shadow-amber-300"
                                    : "border-transparent bg-white";

                            return (
                                <React.Fragment key={point.id}>
                                    <AlertMarker
                                        lat={point.lat}
                                        lng={point.lng}
                                        level={warningLevel}
                                    />
                                    <Marker position={[point.lat, point.lng]}
                                        key={`sensor-${point.id}-${addPointMode}`}
                                        interactive={!addPointMode}
                                        eventHandlers={{
                                            click: () => handleMarkerClick(point)
                                        }}
                                    >
                                        {showMarkerTooltip && (
                                            <Tooltip permanent direction="top" className="w-150">
                                                <div className={`rounded-md border-2 p-1 shadow ${tooltipStateClass}`}>
                                                    <h3 className="font-semibold">{point.name}</h3>
                                                    <table className="w-full">
                                                        <tbody>
                                                            {/* <tr>
                                                            <td className="text-left text-gray-600 border border-gray-300">Trạng thái</td>
                                                            <td className={`border border-gray-300 text-center ${connected ? "text-green-600" : "text-red-600"}`}>
                                                                {connected ? "Kết nối" : "Mất tín hiệu"}
                                                            </td>
                                                        </tr> */}
                                                            <tr>
                                                                <td className="text-left text-gray-600 border border-gray-300">Áp suất</td>
                                                                <td className="text-left text-gray-600 border text-center border-gray-300">{connected ? `${formatMetric(pressure)} m` : "--"}</td>
                                                            </tr>
                                                            <tr>
                                                                <td className="text-left text-gray-600 border border-gray-300">Lưu lượng</td>
                                                                <td className="text-left text-gray-600 border text-center border-gray-300">{connected ? `${formatMetric(flow)} m3/h` : "--"}</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </Tooltip>
                                        )}
                                    </Marker>
                                </React.Fragment>
                            );
                        })}
                    <MapPointLayer
                        points={mapPoints.points}
                        hotspots={mapPoints.hotspots}
                        showPoints={showMapPoints}
                        showHotspots={showHotspots}
                        addMode={addPointMode}
                        canEdit={canEditMapPoints}
                        onPickLocation={handlePickLocation}
                        onEdit={handleEditPoint}
                        imageUrl={mapPointImageUrl}
                    />
                </MapContainer>
            </div>

            {addPointMode && (
                <div className="pointer-events-none absolute inset-0 z-[5] ring-4 ring-inset ring-teal-400/70" />
            )}


            <MapPointForm
                open={pointFormOpen}
                point={editingPoint}
                lat={draftLocation?.lat}
                lng={draftLocation?.lng}
                groups={incidentGroups}
                types={mapPoints.types}
                saving={mapPoints.saving}
                creatingType={mapPoints.creatingType}
                onClose={() => {
                    setPointFormOpen(false);
                    setEditingPoint(null);
                    setDraftLocation(null);
                }}
                onSubmit={handleSubmitPoint}
                onDelete={handleDeletePoint}
                onCreateType={mapPoints.createType}
                onCoordinateChange={handleCoordinateChange}
                onUploadImages={handleUploadImages}
                onDeleteImage={handleDeleteImage}
                imageUrl={mapPointImageUrl}
            />

            <Suspense fallback={null}>
                <IncidentReportPanel
                    open={reportPanelOpen}
                    user={user.user}
                    groups={incidentGroups}
                    types={mapPoints.types}
                    onClose={() => setReportPanelOpen(false)}
                />
            </Suspense>

            <div className="absolute right-4 top-4 z-10 flex max-h-[calc(100vh-5rem)] flex-col items-end gap-3 overflow-y-auto overflow-x-hidden pb-4">
                <div
                    className={`transition-[width] duration-300 ${isPanelOpen ? "w-[330px] max-w-[calc(100vw-2rem)]" : "w-11"}`}
                >
                    <div className={`relative w-full overflow-hidden rounded-lg bg-gray-50 shadow-lg transition-[padding] duration-300 ${isPanelOpen ? "p-4" : "p-1"}`}>
                        <div className={`${isPanelOpen ? "mb-3" : ""} flex items-center gap-2`}>
                            <button
                                onClick={() => setIsPanelOpen((prev) => !prev)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-teal-600 text-white shadow hover:bg-teal-700"
                                title={isPanelOpen ? "Thu bảng trạng thái" : "Mở bảng trạng thái"}
                            >
                                {isPanelOpen ? <FaChevronRight /> : <FaChevronLeft />}
                            </button>
                            <div className={`${isPanelOpen ? "flex" : "hidden"} min-w-0 flex-1 items-center justify-between gap-2`}>
                                <h3 className="truncate text-lg font-bold text-gray-800">Trạng thái cảm biến</h3>
                                <span className="shrink-0 rounded bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-700">
                                    {selectedGroup || "Tất cả nhóm"}
                                </span>
                            </div>
                        </div>
                        <div className={isPanelOpen ? "block" : "hidden"}>
                            <div className="mb-3">
                                <label htmlFor="group" className="mb-1 block text-sm font-semibold text-gray-700">Xem theo nhóm</label>
                                <select
                                    id="group"
                                    value={selectedGroup}
                                    className="min-h-10 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                                    onChange={changeGroupMap}
                                >
                                    <option value="">Tất cả</option>
                                    {groups.map((group) => (
                                        <option key={group} value={group}>{group}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-3 grid grid-cols-2 rounded-lg bg-gray-200 p-1 text-sm font-bold">
                                <button
                                    onClick={() => setPanelTab("status")}
                                    className={`rounded-md px-3 py-2 ${panelTab === "status" ? "bg-white text-teal-700 shadow-sm" : "text-gray-600"}`}
                                >
                                    Tổng quan
                                </button>
                                <button
                                    onClick={() => setPanelTab("history")}
                                    className={`rounded-md px-3 py-2 ${panelTab === "history" ? "bg-white text-teal-700 shadow-sm" : "text-gray-600"}`}
                                >
                                    Lịch sử ({warningHistory.length}{warningHistoryHasMore ? "+" : ""})
                                </button>
                            </div>

                            {panelTab === "status" ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <StatusCard
                                        label="Tổng số"
                                        value={totalSensors}
                                        icon={<FaGlobeAsia />}
                                        colorClass="bg-cyan-500"
                                    />
                                    <StatusCard
                                        label="Mất tín hiệu"
                                        value={lostSensors}
                                        icon={<FaUnlink />}
                                        colorClass="bg-red-500"
                                    />
                                    <StatusCard
                                        label="Kết nối"
                                        value={connectedSensors}
                                        icon={<FaCheckCircle />}
                                        colorClass="bg-green-500"
                                    />
                                    <StatusCard
                                        label="Cảnh báo"
                                        value={warningSensors}
                                        icon={<FaExclamationTriangle />}
                                        colorClass="bg-amber-500"
                                    />
                                </div>
                            ) : (
                                <div className="rounded-lg border border-gray-200 bg-white">
                                    <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                            <FaHistory className="text-teal-600" />
                                            Lịch sử cảnh báo
                                        </div>
                                        {warningHistoryLoading && <FaSyncAlt className="animate-spin text-xs text-teal-600" />}
                                    </div>
                                    <div className="border-b border-gray-100 px-3 py-2">
                                        <label className="block text-xs font-bold text-gray-600">
                                            Chọn ngày
                                            <input
                                                type="date"
                                                value={warningHistoryDate}
                                                max={getDateInputValue()}
                                                onChange={(event) => setWarningHistoryDate(event.target.value || getDateInputValue())}
                                                className="mt-1 h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                                            />
                                        </label>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto" onScroll={handleWarningHistoryScroll}>
                                        {warningHistory.length ? warningHistory.map((item, index) => {
                                            const danger = item.level === "danger" || item.type === "lost_signal";
                                            return (
                                                <div key={`${item.sensorId || "sensor"}-${item.createAt}-${index}`} className="border-b border-gray-100 px-3 py-2 last:border-b-0">
                                                    <div className="mb-1 flex items-center justify-between gap-2">
                                                        <span className="text-xs font-bold text-gray-500">{formatHistoryTime(item.createAt)}</span>
                                                        <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-bold ${danger ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                                            {getWarningTypeLabel(item.type)}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm font-bold text-gray-900">
                                                        {getHistorySensorLabel(item)}
                                                    </div>
                                                    <div className="text-xs font-semibold text-gray-500">
                                                        Nhóm: {getHistoryGroupLabel(item)}
                                                    </div>
                                                    <div className="mt-1 text-xs leading-5 text-gray-700">
                                                        {item.message}
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="px-3 py-6 text-center text-sm font-semibold text-gray-400">
                                                Ngày này chưa có cảnh báo nào.
                                            </div>
                                        )}
                                        {warningHistoryLoadingMore && (
                                            <div className="flex items-center justify-center gap-2 px-3 py-3 text-xs font-bold text-teal-700">
                                                <FaSyncAlt className="animate-spin" />
                                                Đang tải thêm cảnh báo...
                                            </div>
                                        )}
                                        {warningHistory.length > 0 && !warningHistoryHasMore && !warningHistoryLoadingMore && (
                                            <div className="px-3 py-3 text-center text-xs font-bold text-gray-400">
                                                Đã hết cảnh báo của ngày này.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div
                    className={`transition-[width] duration-300 ${isMessagePanelOpen ? "w-[330px] max-w-[calc(100vw-2rem)]" : "w-11"}`}
                >
                    <div className={`relative w-full overflow-hidden rounded-lg bg-gray-50 shadow-lg transition-[padding] duration-300 ${isMessagePanelOpen ? "p-4" : "p-1"}`}>
                        <div className={`${isMessagePanelOpen ? "mb-3" : ""} flex items-center gap-2`}>
                            <button
                                onClick={() => setIsMessagePanelOpen((prev) => !prev)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-sky-600 text-white shadow hover:bg-sky-700"
                                title={isMessagePanelOpen ? "Thu bảng tin nhắn" : "Mở bảng tin nhắn"}
                            >
                                {isMessagePanelOpen ? <FaChevronRight /> : <FaChevronLeft />}
                            </button>
                            <div className={`${isMessagePanelOpen ? "flex" : "hidden"} min-w-0 flex-1 items-center justify-between gap-2`}>
                                <h3 className="truncate text-lg font-bold text-gray-800">Tin nhắn thông báo</h3>
                                <span className="shrink-0 rounded bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">
                                    {homeMessages.length} tin
                                </span>
                            </div>
                        </div>
                        <div className={isMessagePanelOpen ? "space-y-3" : "hidden"}>
                            <form onSubmit={handleSendHomeMessage} className="rounded-lg border border-gray-200 bg-white p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                        <FaBullhorn className="text-sky-600" />
                                        Thông báo nội bộ
                                    </div>
                                    {homeMessagesLoading && <FaSyncAlt className="animate-spin text-xs text-sky-600" />}
                                </div>
                                <input
                                    value={messageSender}
                                    onChange={(e) => setMessageSender(e.target.value)}
                                    className="mb-2 h-9 w-full rounded border border-gray-300 px-3 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                    placeholder="Người gửi"
                                    maxLength={80}
                                />
                                <textarea
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    className="min-h-20 w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                    placeholder="Nhập nội dung thông báo..."
                                    maxLength={1000}
                                />
                                <div className="mt-2 flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-gray-500">{messageStatus}</span>
                                    <button
                                        type="submit"
                                        disabled={messageSending}
                                        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded bg-sky-600 px-3 text-sm font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <FaPaperPlane className="text-xs" />
                                        {messageSending ? "Đang gửi" : "Gửi"}
                                    </button>
                                </div>
                            </form>

                            <div className="rounded-lg border border-gray-200 bg-white">
                                <div className="max-h-72 overflow-y-auto">
                                    {homeMessages.length ? homeMessages.map((item) => (
                                        <div key={item._id || `${item.sender}-${item.createAt}`} className="border-b border-gray-100 px-3 py-2 last:border-b-0">
                                            <div className="mb-1 flex items-center justify-between gap-2">
                                                <span className="min-w-0 truncate text-sm font-bold text-gray-900">{item.sender || "Người gửi"}</span>
                                                <span className="shrink-0 text-[11px] font-bold text-gray-400">{formatMessageTime(item.createAt)}</span>
                                                <button
                                                    onClick={() => handleDeleteHomeMessage(item._id)}
                                                    className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50 hover:text-red-700"
                                                    title="Xoá tin nhắn"
                                                >
                                                    <FaTrashAlt className="text-xs" />
                                                </button>
                                            </div>
                                            <div className="whitespace-pre-line text-xs leading-5 text-gray-700">
                                                {item.message}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="px-3 py-6 text-center text-sm font-semibold text-gray-400">
                                            Chưa có tin nhắn thông báo nào.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <MapPointControl
                    stats={mapPoints.stats}
                    loading={mapPoints.loading}
                    error={mapPoints.error}
                    canEdit={canEditMapPoints}
                    showPoints={showMapPoints}
                    onTogglePoints={setShowMapPoints}
                    showHotspots={showHotspots}
                    onToggleHotspots={setShowHotspots}
                    addMode={addPointMode}
                    onToggleAddMode={setAddPointMode}
                    typeFilter={mapPoints.typeFilter}
                    onTypeFilter={mapPoints.setTypeFilter}
                    statusFilter={mapPoints.statusFilter}
                    onStatusFilter={mapPoints.setStatusFilter}
                    onReload={mapPoints.reload}
                    types={mapPoints.types}
                    onOpenReport={() => setReportPanelOpen(true)}
                />
            </div>
            {showModal ? <ModalData info={weatherData} dateData={dateData} isOpen={showModal} handleCancel={() => setShowModal(false)} /> : null}
        </div>
    );
}

export default AdminSummary;
