import { useAuthStore } from '@/features/auth/stores/authStore';

export const useAuthReady = (): boolean => {
  const isLoading = useAuthStore(state => state.isLoading);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  return !isLoading && isAuthenticated;
};
