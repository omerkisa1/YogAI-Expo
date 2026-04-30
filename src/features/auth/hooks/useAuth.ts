import { useState } from 'react';
import { authService } from '../services/authService';
import { useAuthStore } from '../stores/authStore';
import { profileService } from '../../profile/services/profileService';

export const useAuth = () => {
  const user = useAuthStore(state => state.user);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const authProvider = useAuthStore(state => state.authProvider);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updatePlatformInfo = async (provider: string) => {
    try {
      await profileService.updateProfile({
        platform: authService.getPlatform(),
        auth_provider: provider,
        last_login_at: new Date().toISOString(),
      });
    } catch (error) {
      if (__DEV__) {
        console.log('Failed to update platform info:', error);
      }
    }
  };

  const signInWithGoogle = async () => {
    setIsSubmitting(true);
    try {
      const result = await authService.signInWithGoogle();
      await updatePlatformInfo(result.provider);
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    setIsSubmitting(true);
    try {
      const result = await authService.registerWithEmail(email, password, displayName);
      await updatePlatformInfo(result.provider);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setIsSubmitting(true);
    try {
      const result = await authService.signInWithEmail(email, password);
      await updatePlatformInfo(result.provider);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPassword = async (email: string) => {
    setIsSubmitting(true);
    try {
      await authService.resetPassword(email);
    } finally {
      setIsSubmitting(false);
    }
  };

  const signOut = async () => {
    setIsSubmitting(true);
    try {
      await authService.signOut();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    user,
    isAuthenticated,
    authProvider,
    isSubmitting,
    signInWithGoogle,
    registerWithEmail,
    signInWithEmail,
    resetPassword,
    signOut,
  };
};
