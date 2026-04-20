import React, { useState, useEffect } from "react";
import { useAuth } from "../context/authContext";
import { Outlet, useNavigate } from "react-router-dom";
import Admin_Sidebar from "../components/dashboard/Admin_Sidebar";
import Nav from "../components/dashboard/Navbar";
// import Marquee from "../components/dashboard/Marquee";
import mqtt from "mqtt";
let client
let isConnecting = false;
const host = 'khca-s.static.good-dns.net';
// const port = 9001;
const connectUrl = `wss://${host}/mqtt`;
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
  
  if (loading) {
    return <div>Loading...</div>;
  }
  if (!user) {
    navigate("/login");
  }

  return (
    <div className="flex">
      <Admin_Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div
        className={`flex-1 transition-all ${isSidebarOpen ? "ml-64" : "ml-0"
          } bg-gray-100 h-screen`}
      >
        <Nav />
        <Outlet />
      </div>
      {/* <Marquee /> */}
    </div>
  );
};

export default AdminDashboard;
