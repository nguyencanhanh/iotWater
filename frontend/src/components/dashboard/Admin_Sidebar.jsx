import { NavLink } from "react-router-dom";
import { FaChartBar, FaMapMarkedAlt, FaFileContract, FaTools, FaChevronLeft, FaChevronRight, FaExchangeAlt, FaTint, FaClipboardList, FaDatabase, FaDesktop, FaMobileAlt, FaRobot, FaBroadcastTower } from "react-icons/fa";
import PropTypes from "prop-types";

const Admin_Sidebar = ({ isOpen, toggleSidebar, trafficStats }) => {
  return (
    <div>
      {/* Sidebar */}
      <div
        className={`fixed top-0 bottom-0 z-50 flex h-screen w-64 transform flex-col bg-gray-800 text-white transition-transform ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="bg-teal-600 h-12 flex items-center justify-center">
          <h3 className="text-2xl text-center">WATER</h3>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto px-4 py-2">
          <NavLink
            to="/admin-dashboard"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
            end
          >
            <FaMapMarkedAlt />
            <span>Trang chủ</span>
          </NavLink>
          {/* <NavLink
            to="/admin-dashboard/table"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaUser />
            <span>Bảng</span>
          </NavLink> */}
          <NavLink
            to="/admin-dashboard/sensors"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaChartBar />
            <span>Biểu đồ</span>
          </NavLink>
          <NavLink
            to="/admin-dashboard/compare"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaExchangeAlt />
            <span>So sánh biểu đồ</span>
          </NavLink>
          <NavLink
            to="/admin-dashboard/dma"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaTint />
            <span>Thất thoát DMA</span>
          </NavLink>
          <NavLink
            to="/admin-dashboard/report"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaClipboardList />
            <span>Báo cáo</span>
          </NavLink>
          <NavLink
            to="/admin-dashboard/chatbot"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaRobot />
            <span>Trợ lý AI</span>
          </NavLink>
          <NavLink
            to="/admin-dashboard/monitor"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaBroadcastTower />
            <span>Giám sát AI</span>
          </NavLink>
          <NavLink
            to="/admin-dashboard/external-loggers"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaDatabase />
            <span>Logger ngoài</span>
          </NavLink>
          <NavLink
            to="/admin-dashboard/prv"
            className={({ isActive }) =>
              `${isActive ? "bg-teal-600" : ""} flex items-center space-x-4 py-2.5 px-4 rounded`
            }
          >
            <FaFileContract />
            <span>Van điều áp</span>
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
        <div className="border-t border-white/10 bg-gray-900/70 px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-300">
            <span>Lượt truy cập</span>
            <span className="text-white">{trafficStats?.visits?.total ?? 0}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-2" title="Truy cập từ điện thoại">
              <FaMobileAlt className="text-cyan-300" />
              <span className="min-w-0 truncate text-gray-300">Điện thoại</span>
              <span className="ml-auto font-bold text-white">{trafficStats?.visits?.mobile ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-2" title="Truy cập từ máy tính">
              <FaDesktop className="text-amber-300" />
              <span className="min-w-0 truncate text-gray-300">Máy tính</span>
              <span className="ml-auto font-bold text-white">{trafficStats?.visits?.desktop ?? 0}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between rounded-md bg-emerald-500/10 px-2 py-2 text-xs">
            <span className="flex items-center gap-2 font-bold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Đang online
            </span>
            <span className="font-bold text-white">{trafficStats?.online?.total ?? 0}</span>
          </div>
          <div className="mt-1 flex justify-between px-1 text-[11px] text-gray-400">
            <span>Điện thoại: {trafficStats?.online?.mobile ?? 0}</span>
            <span>Máy tính: {trafficStats?.online?.desktop ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Toggle Button - Luôn đi theo sidebar */}
      <button
        onClick={toggleSidebar}
        className="fixed top-14 z-50 rounded-md bg-teal-600 p-2 text-white shadow-md transition-all"
        style={{
          left: isOpen ? "16rem" : "0.5rem", // 16rem = 64px sidebar
          transform: isOpen ? "translateX(0)" : "translateX(0)"
        }}
      >
        {isOpen ? <FaChevronLeft /> : <FaChevronRight />}
      </button>
    </div>
  );
};

Admin_Sidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggleSidebar: PropTypes.func.isRequired,
  trafficStats: PropTypes.shape({
    visits: PropTypes.shape({
      total: PropTypes.number,
      mobile: PropTypes.number,
      desktop: PropTypes.number,
    }),
    online: PropTypes.shape({
      total: PropTypes.number,
      mobile: PropTypes.number,
      desktop: PropTypes.number,
    }),
  }),
};

export default Admin_Sidebar;
