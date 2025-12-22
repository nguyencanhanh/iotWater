import React, { useState, useEffect } from "react";
import { useAuth } from "../context/authContext";
import { Outlet, useNavigate } from "react-router-dom";
import Admin_Sidebar from "../components/dashboard/Admin_Sidebar";
import Nav from "../components/dashboard/Navbar";
// import Marquee from "../components/dashboard/Marquee";
import mqtt from "mqtt";
export let client

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
  const host = "iotwater2024.mooo.com";
  const port = 9001;
  const connectUrl = `wss://${host}:${port}/mqtt`;
  const options = { clientId, clean: true, connectTimeout: 4000, reconnectPeriod: 5000 };
  // useEffect(()=>{
  //   client = mqtt.connect(connectUrl, options);
  // },[])
  client = mqtt.connect(connectUrl, options);
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
