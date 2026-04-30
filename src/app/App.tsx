import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import Toast, { BaseToast, ErrorToast, type ToastConfig, type BaseToastProps } from 'react-native-toast-message';
import { authService } from '@/features/auth/services/authService';
import { useAuthStore } from '@/features/auth/stores/authStore';
import RootNavigator from '@/navigation/RootNavigator';
import OfflineBanner from '@/shared/components/OfflineBanner';
import { queryClient } from '@/shared/api/queryClient';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

SplashScreen.preventAutoHideAsync();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const linking: any = {
  prefixes: ['yogai://', 'https://yogai.app'],
  config: {
    screens: {
      MainTabs: { screens: { Home: 'home', Plans: 'plans', Training: 'training', Profile: 'profile' } },
      PlanDetail: 'plan/:planId',
      CreatePlan: 'create-plan',
    },
  },
};

const toastConfig: ToastConfig = {
  success: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: colors.success, borderLeftWidth: 5, borderRadius: radius.lg, paddingHorizontal: spacing.sm }}
      contentContainerStyle={{ paddingHorizontal: spacing.sm }}
      text1Style={{ ...typography.bodySmMedium, color: colors.text }}
      text2Style={{ ...typography.caption, color: colors.textSecondary }}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: colors.error, borderLeftWidth: 5, borderRadius: radius.lg, paddingHorizontal: spacing.sm }}
      contentContainerStyle={{ paddingHorizontal: spacing.sm }}
      text1Style={{ ...typography.bodySmMedium, color: colors.text }}
      text2Style={{ ...typography.caption, color: colors.textSecondary }}
    />
  ),
  info: (props: BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: colors.info, borderLeftWidth: 5, borderRadius: radius.lg, paddingHorizontal: spacing.sm }}
      contentContainerStyle={{ paddingHorizontal: spacing.sm }}
      text1Style={{ ...typography.bodySmMedium, color: colors.text }}
      text2Style={{ ...typography.caption, color: colors.textSecondary }}
    />
  ),
};

const App = () => {
  const setUser = useAuthStore(state => state.setUser);
  const isLoading = useAuthStore(state => state.isLoading);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = authService.onAuthStateChanged(async user => {
      const provider = user ? authService.getAuthProvider() : 'unknown';
      setUser(user, provider);
      try { await SplashScreen.hideAsync(); } catch { /* ignored */ }
    });
    return () => { unsubscribeAuth(); };
  }, [setUser]);

  useEffect(() => {
    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      onlineManager.setOnline(online);
      setIsOffline(!online);
    });
    return () => { unsubscribeNetInfo(); };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(nextAppState === 'active');
      }
    });
    return () => { subscription.remove(); };
  }, []);

  if (isLoading) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer linking={linking}>
        <RootNavigator />
        <OfflineBanner visible={isOffline} />
      </NavigationContainer>
      <Toast config={toastConfig} position="top" topOffset={50} />
    </QueryClientProvider>
  );
};

export default App;
