import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';
import { initSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('tripzo_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('tripzo_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('tripzo_token');
      if (storedToken) {
        try {
          const res = await authApi.getMe();
          setUser(res.data.user || res.data);
          localStorage.setItem('tripzo_user', JSON.stringify(res.data.user || res.data));
          initSocket(storedToken);
        } catch (err) {
          console.error('[Auth] Token validation failed:', err);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    const { token: receivedToken, user: receivedUser } = res.data;

    localStorage.setItem('tripzo_token', receivedToken);
    localStorage.setItem('tripzo_user', JSON.stringify(receivedUser));

    setToken(receivedToken);
    setUser(receivedUser);
    initSocket(receivedToken);

    return receivedUser;
  };

  const logout = () => {
    localStorage.removeItem('tripzo_token');
    localStorage.removeItem('tripzo_user');
    setToken(null);
    setUser(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider value={{ user, token, role: user?.role, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
