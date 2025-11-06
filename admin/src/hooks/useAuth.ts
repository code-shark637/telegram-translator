import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { adminApi } from '../services/api';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = Cookies.get('admin_token');
      
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      try {
        await adminApi.verifyToken();
        setIsAuthenticated(true);
      } catch (error) {
        Cookies.remove('admin_token');
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const login = async (password: string) => {
    try {
      const response = await adminApi.login(password);
      const { access_token } = response.data;
      Cookies.set('admin_token', access_token, { expires: 7 });
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      return false;
    }
  };

  const logout = () => {
    Cookies.remove('admin_token');
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  return { isAuthenticated, loading, login, logout };
};
