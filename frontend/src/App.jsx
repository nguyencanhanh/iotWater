import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard"
import AdminSummary from "./components/dashboard/AdminSummary"
import SensorList from "./components/sensor/SensorList"
import AddSensor from './components/sensor/AddSensor';
import EmployeeDashboard from "./pages/EmployeeDashboard"
import PrivateRoutes from './utils/PrivateRoutes'
import RoleBaseRoutes from './utils/RoleBaseRoutes'
import SettingGroup from './components/setting/SettingGroup';
import GroupSensor from './components/sensor/GroupSensor';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<Navigate to="/admin-dashboard" />} />
        <Route path='/login' element={<Login />} />

        <Route path='/admin-dashboard' element={
          <PrivateRoutes>
            <RoleBaseRoutes requiredRole={['admin', 'trial']} >
              <AdminDashboard />
            </RoleBaseRoutes>
          </PrivateRoutes>
        }>
          <Route index element={<AdminSummary/>}></Route>
          <Route path='/admin-dashboard/sensors' element={<GroupSensor/>}></Route>
          <Route path='/admin-dashboard/sensors/:group' element={<SensorList/>}></Route>
          <Route path='/admin-dashboard/add-sensors' element={<AddSensor/>}></Route>
          <Route path='/admin-dashboard/setting' element={<SettingGroup/>}></Route>

        </Route>
        <Route path="/employee-dashboard" element={<EmployeeDashboard />}></Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
