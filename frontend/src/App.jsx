import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from "./pages/Login";
import PrivateRoutes from './utils/PrivateRoutes'
import RoleBaseRoutes from './utils/RoleBaseRoutes'

// Moi trang nang duoc tach thanh chunk rieng, chi tai khi nguoi dung mo den.
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"))
const AdminSummary = lazy(() => import("./components/dashboard/AdminSummary"))
const SensorList = lazy(() => import("./components/sensor/SensorList"))
const AddSensor = lazy(() => import('./components/sensor/AddSensor'))
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"))
const GroupSensor = lazy(() => import('./components/sensor/GroupSensor'))
const PrvControl = lazy(() => import('./pages/PrvControl'))
const Compare = lazy(() => import('./pages/Compare'))
const DmaLoss = lazy(() => import('./pages/DmaLoss'))
const Report = lazy(() => import('./pages/Report'))
const SettingsHub = lazy(() => import('./pages/SettingsHub'))
const ExternalLoggers = lazy(() => import('./pages/ExternalLoggers'))
const Chatbot = lazy(() => import('./pages/Chatbot'))

const RouteFallback = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
      <span className="text-sm font-semibold text-slate-500">Đang tải…</span>
    </div>
  </div>
)

function App() {

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
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
            <Route path='/admin-dashboard/setting' element={<SettingsHub/>}></Route>
            <Route path='/admin-dashboard/prv' element={<PrvControl/>}></Route>
            <Route path='/admin-dashboard/compare' element={<Compare/>}></Route>
            <Route path='/admin-dashboard/report' element={<Report/>}></Route>
            <Route path='/admin-dashboard/chatbot' element={<Chatbot/>}></Route>
            <Route path='/admin-dashboard/dnp-setting' element={<SettingsHub defaultTab="dnp"/>}></Route>
            <Route path='/admin-dashboard/dma' element={<DmaLoss/>}></Route>
            <Route path='/admin-dashboard/external-loggers' element={<ExternalLoggers/>}></Route>
          </Route>
          <Route path="/employee-dashboard" element={<EmployeeDashboard />}></Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
