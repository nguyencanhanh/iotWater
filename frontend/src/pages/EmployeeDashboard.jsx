import React from 'react'
// import SideBar from '../EmployeeDashboard/SideBar'
// import Nav from '../components/dashBoard/Nav'
import { Outlet } from 'react-router-dom'

function EmployeeDashboard() {
  return (
    <div className='flex'>
      <SideBar />
      <div className='flex-1 ml-64 bg-gray-100 h-screen'>
        <Nav />
        <Outlet />
      </div>
      admin
    </div>
  )
}

export default EmployeeDashboard