import { createContext, useContext, useEffect, useState } from 'react';

import api from '@/lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    console.log('AuthContext: Checking authentication...');
    api
      .get('/auth/me')
      .then((response) => {
        console.log('AuthContext: User authenticated', response.data.user);
        if (active) {
          setUser(response.data.user);
        }
      })
      .catch((error) => {
        console.log('AuthContext: Not authenticated', error.response?.status, error.response?.data);
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          console.log('AuthContext: Loading complete');
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    setUser(response.data.user);
    return response.data.user;
  };

  const register = async (payload) => {
    const response = await api.post('/auth/register', payload);
    setUser(response.data.user);
    return response.data.user;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    setUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
