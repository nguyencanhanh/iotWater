import React from "react";
import { NavLink } from "react-router-dom";
import { FaBuilding, FaTachometerAlt, FaTools, FaUser, FaBars } from "react-icons/fa";

const Admin_Sidebar = ({ isOpen, toggleSidebar }) => {
  return (
    <div>
      {/* Sidebar */}
      <div
        className={`bg-gray-800 text-white h-screen fixed top-0 left-0 bottom-0 transition-transform transform ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } w-64`}
      >
        <div className="bg-teal-600 h-12 flex items-center justify-center">
          <h3 className="text-2xl text-center">WATER</h3>
        </div>
        <div className="px-4 space-y-2">
          <NavLink
            to="/admin-dashboard"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
            end
          >
            <FaTachometerAlt />
            <span>Trang chủ</span>
          </NavLink>
          <NavLink
            to="/admin-dashboard/table"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaUser />
            <span>Bảng</span>
          </NavLink>
          <NavLink
            to="/admin-dashboard/sensors"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaBuilding />
            <span>Biểu đồ</span>
          </NavLink>
          <NavLink
            to="/admin-dashboard/setting"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaTools />
            <span>Cài đặt</span>
          </NavLink>
        </div>
      </div>

      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-4 z-50 bg-teal-600 text-white p-2 rounded-md shadow-md"
      >
        <FaBars />
      </button>
    </div>
  );
};

export default Admin_Sidebar;
