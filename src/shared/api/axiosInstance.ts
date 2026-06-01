import axios from 'axios';
import Toast from 'react-native-toast-message';
import { auth } from '@/shared/config/firebase';
import { API_URL } from '@/shared/config/env';
import { useAuthStore } from '@/features/auth/stores/authStore';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

const TOKEN_TTL_MS = 50 * 60 * 1000;
let cachedToken: { value: string; fetchedAt: number } | null = null;

export const clearAuthTokenCache = () => {
  cachedToken = null;
};

const getCachedIdToken = async (forceRefresh = false): Promise<string | null> => {
  const user = auth.currentUser;
  if (!user) {
    clearAuthTokenCache();
    return null;
  }
  const now = Date.now();
  if (!forceRefresh && cachedToken && now - cachedToken.fetchedAt < TOKEN_TTL_MS) {
    return cachedToken.value;
  }
  const token = await user.getIdToken(forceRefresh);
  cachedToken = { value: token, fetchedAt: now };
  return token;
};

api.interceptors.request.use(async config => {
  const token = await getCachedIdToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    const status: number | undefined = error.response?.status;
    const message: string | undefined =
      error.response?.data?.error || error.response?.data?.message;
    const config = (error.config ?? {}) as {
      _retry?: boolean;
      headers?: Record<string, string>;
      skipGlobalErrorHandler?: boolean;
    };
    const shouldHandleGlobally = !config.skipGlobalErrorHandler;
    const skip400Toast = status === 400 && config.skipGlobalErrorHandler;

    if (status === 401) {
      const user = auth.currentUser;
      if (user && !config._retry) {
        clearAuthTokenCache();
        const freshToken = await getCachedIdToken(true);
        if (freshToken) {
          config._retry = true;
          config.headers = config.headers ?? {};
          config.headers.Authorization = `Bearer ${freshToken}`;
          return api.request(config);
        }
      }
      clearAuthTokenCache();
      useAuthStore.getState().setUser(null);
    }

    if (shouldHandleGlobally && !skip400Toast) {
      switch (status) {
        case 400:
          if (message) {
            Toast.show({ type: 'error', position: 'top', text1: message });
          }
          break;
        case 403:
          Toast.show({ type: 'error', position: 'top', text1: 'Yetkisiz işlem' });
          break;
        case 500:
          Toast.show({
            type: 'error',
            position: 'top',
            text1: 'Sunucu hatası',
            text2: 'Lütfen tekrar deneyin',
          });
          break;
        default:
          if (!error.response) {
            Toast.show({
              type: 'error',
              position: 'top',
              text1: 'Bağlantı hatası',
              text2: 'İnternet bağlantınızı kontrol edin',
            });
          }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
