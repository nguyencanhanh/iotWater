import React, { useState } from "react";
import { useAuth } from "../context/authContext";
import { Outlet, useNavigate } from "react-router-dom";
import Admin_Sidebar from "../components/dashboard/Admin_Sidebar";
import Nav from "../components/dashboard/Navbar";

const AdminDashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Theo dõi trạng thái sidebar

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
        className={`flex-1 transition-all ${
          isSidebarOpen ? "ml-64" : "ml-0"
        } bg-gray-100 h-screen`}
      >
        <Nav />
        <Outlet />
      </div>
    </div>
  );
};

export default AdminDashboard;
