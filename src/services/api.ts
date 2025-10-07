import axios from 'axios';
import Cookies from 'js-cookie';
import type { User, TelegramAccount, TranslationResult, Language } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = Cookies.get('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      Cookies.remove('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (username: string, password: string): Promise<{ access_token: string; token_type: string }> => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  register: async (username: string, password: string, email?: string): Promise<{ access_token: string; token_type: string }> => {
    const response = await api.post('/auth/register', { username, password, email });
    return response.data;
  },

  me: async (): Promise<User> => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Telegram API
export const telegramAPI = {
  getAccounts: async (): Promise<TelegramAccount[]> => {
    const response = await api.get('/telegram/accounts');
    const items = response.data as any[];
    return (items || []).map((a: any) => ({
      id: a.id,
      displayName: a.display_name ?? undefined,
      accountName: a.account_name,
      isActive: a.is_active,
      sourceLanguage: a.source_language,
      targetLanguage: a.target_language,
      createdAt: a.created_at,
      lastUsed: a.last_used ?? undefined,
      isConnected: a.is_connected === true,
    }));
  },

  addAccount: async (data: FormData): Promise<TelegramAccount> => {
    const response = await api.post('/telegram/accounts', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const a = response.data;
    return {
      id: a.id,
      displayName: a.display_name ?? undefined,
      accountName: a.account_name,
      isActive: a.is_active,
      sourceLanguage: a.source_language,
      targetLanguage: a.target_language,
      createdAt: a.created_at,
      lastUsed: a.last_used ?? undefined,
      isConnected: a.is_connected === true,
    } as TelegramAccount;
  },

  updateAccount: async (
    accountId: number,
    payload: { displayName?: string; sourceLanguage?: string; targetLanguage?: string; isActive?: boolean }
  ): Promise<TelegramAccount> => {
    const response = await api.patch(`/telegram/accounts/${accountId}`, {
      display_name: payload.displayName,
      source_language: payload.sourceLanguage,
      target_language: payload.targetLanguage,
      is_active: payload.isActive,
    });
    const a = response.data;
    return {
      id: a.id,
      displayName: a.display_name ?? undefined,
      accountName: a.account_name,
      isActive: a.is_active,
      sourceLanguage: a.source_language,
      targetLanguage: a.target_language,
      createdAt: a.created_at,
      lastUsed: a.last_used ?? undefined,
      isConnected: a.is_connected === true,
    } as TelegramAccount;
  },

  softDeleteAccount: async (accountId: number): Promise<void> => {
    await api.patch(`/telegram/accounts/${accountId}`, { is_active: false });
  },

  connectAccount: async (accountId: number): Promise<{ connected: boolean }> => {
    const response = await api.post(`/telegram/accounts/${accountId}/connect`);
    return response.data;
  },

  disconnectAccount: async (accountId: number): Promise<{ connected: boolean }> => {
    const response = await api.post(`/telegram/accounts/${accountId}/disconnect`);
    return response.data;
  },

  deleteAccount: async (accountId: number): Promise<void> => {
    await api.delete(`/telegram/accounts/${accountId}`);
  },
};

// Translation API
export const translationAPI = {
  translate: async (
    text: string,
    targetLanguage: string,
    sourceLanguage?: string,
    engine?: string
  ): Promise<TranslationResult> => {
    const response = await api.post('/translation/translate', {
      text,
      targetLanguage,
      sourceLanguage,
      engine,
    });
    return response.data;
  },

  getEngines: async (): Promise<{ engines: string[] }> => {
    const response = await api.get('/translation/engines');
    return response.data;
  },

  getLanguages: async (): Promise<{ languages: Language[] }> => {
    const response = await api.get('/translation/languages');
    return response.data;
  },
};

// Conversations API
export const conversationsAPI = {
  getConversations: async (accountId: number) => {
    const response = await api.get(`/telegram/accounts/${accountId}/conversations`);
    return response.data;
  },
};

// Messages API
export const messagesAPI = {
  getMessages: async (conversationId: number, limit: number = 50) => {
    const response = await api.get(`/messages/conversations/${conversationId}/messages`, {
      params: { limit }
    });
    return response.data;
  },

  sendMessage: async (conversationId: number, text: string, translate: boolean = true) => {
    const response = await api.post('/messages/send', {
      conversation_id: conversationId,
      text,
      translate
    });
    return response.data;
  },

  translateText: async (text: string, targetLanguage: string, sourceLanguage: string = 'auto') => {
    const response = await api.post('/messages/translate', null, {
      params: { text, target_language: targetLanguage, source_language: sourceLanguage }
    });
    return response.data;
  },
};

// Health check
export const healthAPI = {
  check: async (): Promise<{ status: string; database: string }> => {
    const response = await api.get('/health');
    return response.data;
  },
};