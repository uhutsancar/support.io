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
    
    if (cachedUser && token) {
      try {
        let parsedUser = JSON.parse(cachedUser);
        if (parsedUser.id && !parsedUser._id) parsedUser._id = parsedUser.id;
        setUser(parsedUser);
        setLoading(false);
        if (!authChecked) {
          authAPI.me()
            .then(response => {
              let u = response.data.user;
              if (u.id && !u._id) u._id = u.id;
              setUser(u);
              localStorage.setItem('user', JSON.stringify(u));
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
      try {
        const response = await authAPI.me();
        let u = response.data.user;
        if (u.id && !u._id) u._id = u.id;
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
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
    let u = response.data.user;
    if (u.id && !u._id) u._id = u.id;
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
    setAuthChecked(true);
    return response.data;
  };

  const register = async (name, email, password) => {
    const response = await authAPI.register({ name, email, password });
    let u = response.data.user;
    if (u.id && !u._id) u._id = u.id;
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
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
