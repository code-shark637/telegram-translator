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
      const { access_token } = await authAPI.login(username, password);

      Cookies.set('auth_token', access_token, { expires: 7 });

      const user = await authAPI.me();

      setAuthState({
        user,
        token: access_token,
        isAuthenticated: true,
        isLoading: false,
      });

      // Ensure the root App re-evaluates auth branch immediately
      window.location.replace('/');
    } catch (error) {
      throw error;
    }
  };

  const register = async (username: string, password: string, email?: string): Promise<void> => {
    try {
      const { access_token } = await authAPI.register(username, password, email);

      Cookies.set('auth_token', access_token, { expires: 7 });

      const user = await authAPI.me();

      setAuthState({
        user,
        token: access_token,
        isAuthenticated: true,
        isLoading: false,
      });

      // Ensure the root App re-evaluates auth branch immediately
      window.location.replace('/');
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

    // Force navigation to login and re-render root auth branch
    window.location.replace('/login');
  };

  return {
    ...authState,
    login,
    register,
    logout,
  };
}