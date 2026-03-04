import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showNotification } from '@mantine/notifications';

import { loginRequest, fetchCurrentUser } from '../api/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      setAccessToken(storedToken);
      const parsed = JSON.parse(storedUser);
      const normalizeRole = (r) => {
        if (r === 'ADMIN') return 'Admin';
        if (r === 'BARANGAY_OFFICER') return 'Barangay Officer';
        return r;
      };
      const normalizeUser = (u) => (u ? { ...u, role: normalizeRole(u.role) } : u);
      const normalizedUser = normalizeUser(parsed);
      setUser(normalizedUser);
      if (normalizedUser && normalizedUser !== parsed) {
        localStorage.setItem('user', JSON.stringify(normalizedUser));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      // Immediately sign out locally when the backend reports the session has expired.
      setAccessToken(null);
      setUser(null);
      setSessionExpired(true);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    };

    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, []);

  const login = async (username, password, redirectTo) => {
    try {
      const response = await loginRequest(username, password);
      const { accessToken: token, user: loggedInUser } = response.data.data;
      const normalizeRole = (r) => {
        if (r === 'ADMIN') return 'Admin';
        if (r === 'BARANGAY_OFFICER') return 'Barangay Officer';
        return r;
      };
      const normalizedUser = loggedInUser ? { ...loggedInUser, role: normalizeRole(loggedInUser.role) } : null;
      setAccessToken(token);
      setUser(normalizedUser);
      setSessionExpired(false);
      localStorage.setItem('accessToken', token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      showNotification({
        title: 'Login successful',
        message: `Welcome, ${normalizedUser?.fullName || ''}`,
        color: 'green',
        autoClose: 1500
      });
      if (redirectTo) {
        navigate(redirectTo, { replace: true });
      }
    } catch (error) {
      const message = error?.response?.data?.error?.message || 'Invalid username or password';
      showNotification({
        title: 'Login failed',
        message,
        color: 'red'
      });
      throw error;
    }
  };

  const logout = () => {
    setAccessToken(null);
    setUser(null);
    setSessionExpired(false);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    navigate('/', { replace: true });
  };

  const refreshProfile = async () => {
    if (!accessToken) return;
    try {
      const response = await fetchCurrentUser();
      const freshUser = response.data.data;
      const normalizeRole = (r) => {
        if (r === 'ADMIN') return 'Admin';
        if (r === 'BARANGAY_OFFICER') return 'Barangay Officer';
        return r;
      };
      const normalizedUser = freshUser ? { ...freshUser, role: normalizeRole(freshUser.role) } : null;
      setUser(normalizedUser);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
    } catch {
      // ignore
    }
  };

  const value = {
    user,
    accessToken,
    loading,
    login,
    logout,
    refreshProfile,
    sessionExpired,
    isAdmin: user?.role === 'Admin',
    isOfficer: user?.role === 'Barangay Officer'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
