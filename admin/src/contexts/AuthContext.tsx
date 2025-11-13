import { createContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { adminApi } from '../services/api';

export interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  login: (password: string) => Promise<boolean>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
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
      } catch {
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
    } catch {
      return false;
    }
  };

  const logout = () => {
    Cookies.remove('admin_token');
    setIsAuthenticated(false);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

