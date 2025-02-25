import React, { createContext, useContext, useEffect, useState } from 'react'
import { verifyGet, infoGet } from '../api/index';

const userContext = createContext();
function AuthContext({ children }) {
  const [user, setUser] = useState(null)
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const verifyUser = async () => {
      try {
        const token = localStorage.getItem("token")
        if (token) {
          const res = await verifyGet(token);
          const info = await infoGet(token);
          if (res.data.success && info.data.success) {
            setUser(res.data.user)
            setInfo(info.data.info)
          }
        }
      } catch (error) {
        if (error.res && !error.res.data.success) {
          setUser(null)
          setInfo(null)
        }

      } finally {
        setLoading(false)
      }
    }
    verifyUser()
  }, [])
  const login = (user) => {
    setUser(user)
    setLoading(false)
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("token")
  }
  return (
    <userContext.Provider value={{ user, info, login, logout, loading }}>
      {children}
    </userContext.Provider>
  )
}
export const useAuth = () => useContext(userContext)
export default AuthContext