import { useState, useEffect } from "react";
import { useAuth } from "../context/authContext";
import { Outlet, useNavigate } from "react-router-dom";
import Admin_Sidebar from "../components/dashboard/Admin_Sidebar";
import Nav from "../components/dashboard/Navbar";
// import Marquee from "../components/dashboard/Marquee";
import mqtt from "mqtt";
import { trafficHeartbeatPost } from "../api";
let client
let isConnecting = false;
// MQTT cua trinh duyet. Logger ngoai hien truong KHONG dung duong nay - chung noi
// thang toi mosquitto qua TCP 1883 o host cu, doi domain web khong anh huong gi toi chung.
// Khong dat VITE_MQTT_WS_URL thi tu bam theo domain dang mo trang, nho vay mot ban
// build chay duoc tren nhieu domain ma khong can build lai.
const getDefaultMqttUrl = () => {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/mqtt`;
};

const connectUrl = import.meta.env.VITE_MQTT_WS_URL || getDefaultMqttUrl();
const trafficSessionStorageKey = "traffic_session_id";

const getTrafficSessionId = () => {
  const current = sessionStorage.getItem(trafficSessionStorageKey);
  if (current) return current;
  const sessionId = window.crypto?.randomUUID?.()
    || `web_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(trafficSessionStorageKey, sessionId);
  return sessionId;
};

const getDeviceType = () => {
  if (typeof navigator.userAgentData?.mobile === "boolean") {
    return navigator.userAgentData.mobile ? "mobile" : "desktop";
  }
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(navigator.userAgent)
    ? "mobile"
    : "desktop";
};
let clientId = "";
export function getMqttClient() {
  // console.log(client, isConnecting)
  if (client) return client;
  if (isConnecting) return null;
  if(!localStorage.getItem("client_ID")){
    clientId = `mqtt_${Math.random().toString(16).slice(3)}`
    localStorage.setItem("client_ID", clientId)
  }
  else{
    clientId = localStorage.getItem("client_ID")
  }
  isConnecting = true;
  // console.log(isConnecting)
  client = mqtt.connect(connectUrl, {
    clientId: clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 5000,
    // Tai khoan CHI DOC. Lo ra trinh duyet la chap nhan duoc vi no khong gui
    // duoc gi len broker, va port 9001 cung khong con mo ra internet.
    ...(import.meta.env.VITE_MQTT_USERNAME ? {
      username: import.meta.env.VITE_MQTT_USERNAME,
      password: import.meta.env.VITE_MQTT_PASSWORD,
    } : {}),
  });

  client.on('connect', () => {
    console.log('MQTT connected (ONLY ONCE)');
    isConnecting = false;
  });

  client.on('close', () => {
    console.log('MQTT closed');
    isConnecting = false;
  });

  return client;
}

const AdminDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Theo dõi trạng thái sidebar
  const [trafficStats, setTrafficStats] = useState(null);
  let clientId = "";
  if(!localStorage.getItem("client_ID")){
    clientId = `mqtt_${Math.random().toString(16).slice(3)}`
    localStorage.setItem("client_ID", clientId)
  }
  else{
    clientId = localStorage.getItem("client_ID")
  }
  //   localStorage.setItem("client_ID", `mqtt_${localStorage.getItem("client_ID")}`)
  // }
  // const options = { clientId, clean: true, connectTimeout: 4000, reconnectPeriod: 5000 };
  useEffect(()=>{
    // client = mqtt.connect(connectUrl, options);
    // client.on('connect', () => {
    //   console.log('Connected to MQTT broker');
    // });
  //   client = mqtt.connect(connectUrl, options);
    getMqttClient()
  },[])

  useEffect(() => {
    if (!user) return undefined;
    const token = localStorage.getItem("token");
    const sessionId = getTrafficSessionId();
    const deviceType = getDeviceType();
    let canceled = false;

    const heartbeat = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await trafficHeartbeatPost(token, sessionId, deviceType);
        if (!canceled && response.data.success) setTrafficStats(response.data.stats);
      } catch {
        // Presence must not interrupt the main dashboard workflow.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") heartbeat();
    };

    heartbeat();
    const timer = window.setInterval(heartbeat, 2 * 60 * 1000);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      canceled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user]);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  if (!user) {
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Admin_Sidebar
        isOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        trafficStats={trafficStats}
      />
      <div
        className={`min-w-0 flex-1 transition-all duration-300 ${isSidebarOpen ? "md:ml-64" : "ml-0"}`}
      >
        <Nav />
        <main className="h-[calc(100vh-3rem)] overflow-auto">
          <Outlet />
        </main>
      </div>
      {/* <Marquee /> */}
    </div>
  );
};

export default AdminDashboard;
