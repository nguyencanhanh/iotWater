import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";

const TOKEN_KEY = "iotWater.token";
const USER_KEY = "iotWater.user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const [[, savedToken], [, savedUser]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
        if (savedToken) {
          await api.verify(savedToken);
          setToken(savedToken);
          setUser(savedUser ? JSON.parse(savedUser) : null);
        }
      } catch {
        await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      } finally {
        setBooting(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email.trim(), password);
    await AsyncStorage.multiSet([
      [TOKEN_KEY, data.token],
      [USER_KEY, JSON.stringify(data.user)]
    ]);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    booting,
    isAuthenticated: Boolean(token),
    login,
    logout,
    token,
    user
  }), [booting, login, logout, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
};
