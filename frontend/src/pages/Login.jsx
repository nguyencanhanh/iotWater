import React, { useState } from 'react'
import { loginPost } from '../api/index';
import { useAuth } from '../context/authContext'
import { useNavigate } from 'react-router-dom'

function Login() {
  const [email, setEmail] = useState(localStorage.getItem("Login") || "cnbg@gmail.com")
  const [password, setPassword] = useState(localStorage.getItem("password") || "2")
  const [error, setError] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await loginPost({ email, password })
      if (res.data.success) {
        login(res.data.user)
        localStorage.setItem("token", res.data.token)
        localStorage.setItem("Login", email)
        localStorage.setItem("password", password)
        if (res.data.user.role === "admin" || res.data.user.role === "trial") {
          navigate("/admin-dashboard")
        } else {
          navigate('/employee-dashboard')
        }
      }
    } catch (error) {
      if (error.res && !error.res.data.success) {
        setError(error.res.data.message)
      } else {
        setError("Server Error")
      }
    }
  }
  return (
    <div className='flex flex-col items-center h-screen  justify-center bg-gradient-to-b from-teal-600 from-50% to-gray-100 to-50% space-y-6'>
      <h2 className='font-sevillana  text-3xl text-white'>Hệ thống quản lý logger</h2>
      <div className='border shadow p-6 w-80 bg-white'>
        <h2 className='text-2xl font-bold mb-4'>Đăng nhập</h2>
        {error && <p className='text-red-600'>{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className='mb-4'>

            <label htmlFor="email" className='block text-gray-700'>Email</label>
            <input type="email" placeholder='Enter your email' value={email} className='w-full px-3 py-2 border' onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="password" className='block text-gray-700'>Mật khẩu</label>
            <input type="password" placeholder='*******' value={password} className='w-full px-3 py-2 border' required
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className='mb-4 flex items-center justify-between'>
            <label className='inline-flex items-center'>
              <input type="checkbox" className='form-checkbox' />
              <span className='ml-2 text-gray-700'>Lưu thông tin</span>
            </label>
            <a href="#" className='text-teal-600'>Quên mật khẩu</a>
          </div>
          <div className='mb-4'>
            <button type='submit' className='w-full bg-teal-600 text-white py-2'>Login</button>
          </div>
          <div className='mb-4'>
            email: cnbg@gmail.com <br />
            password: 2
          </div>
        </form>
      </div>

    </div>
  )
}

export default Login
