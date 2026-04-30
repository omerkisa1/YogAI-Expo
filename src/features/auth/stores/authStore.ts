import { create } from 'zustand';
import type { User } from 'firebase/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authProvider: string;
  setUser: (user: User | null, provider?: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  authProvider: 'unknown',
  setUser: (user, provider) =>
    set({
      user,
      isAuthenticated: Boolean(user),
      authProvider: provider ?? 'unknown',
      isLoading: false,
    }),
  setLoading: isLoading => set({ isLoading }),
}));
