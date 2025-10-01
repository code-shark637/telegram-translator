import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { authAPI } from '../services/api';
import type { User, AuthState } from '../types';

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const token = Cookies.get('auth_token');
    if (token) {
      setAuthState(prev => ({
        ...prev,
        token,
        isAuthenticated: true,
      }));
      
      // Verify token and get user info
      authAPI.me()
        .then(user => {
          setAuthState(prev => ({
            ...prev,
            user,
            isLoading: false,
          }));
        })
        .catch(() => {
          // Token is invalid
          Cookies.remove('auth_token');
          setAuthState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        });
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    try {
      const { user, token } = await authAPI.login(username, password);
      
      Cookies.set('auth_token', token, { expires: 1 }); // 1 day
      
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      throw error;
    }
  };

  const register = async (username: string, password: string, email?: string): Promise<void> => {
    try {
      const { user, token } = await authAPI.register(username, password, email);
      
      Cookies.set('auth_token', token, { expires: 1 });
      
      setAuthState({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      throw error;
    }
  };

  const logout = (): void => {
    Cookies.remove('auth_token');
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  return {
    ...authState,
    login,
    register,
    logout,
  };
}