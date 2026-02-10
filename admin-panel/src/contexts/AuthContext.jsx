import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('token');
    const cachedUser = localStorage.getItem('user');
    
    // İlk yüklemede cache'den kullanıcıyı al, loading'i hızlı bitir
    if (cachedUser && token) {
      try {
        setUser(JSON.parse(cachedUser));
        setLoading(false);
        
        // Arka planda token'ı doğrula (blocking olmadan)
        if (!authChecked) {
          authAPI.me()
            .then(response => {
              setUser(response.data.user);
              localStorage.setItem('user', JSON.stringify(response.data.user));
              setAuthChecked(true);
            })
            .catch(error => {
              console.error('Auth validation error:', error);
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              setUser(null);
            });
        }
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setLoading(false);
      }
    } else if (token) {
      // Cache yoksa normal API çağrısı yap
      try {
        const response = await authAPI.me();
        setUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      setLoading(false);
    } else {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    setUser(response.data.user);
    setAuthChecked(true);
    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await authAPI.register({ name, email, password });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    setUser(response.data.user);
    setAuthChecked(true);
    return response.data;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setAuthChecked(false);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
