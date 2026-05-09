import 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import Toast, { type ToastConfig } from 'react-native-toast-message';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authService } from '@/features/auth/services/authService';
import { useAuthStore } from '@/features/auth/stores/authStore';
import RootNavigator from '@/navigation/RootNavigator';
import OfflineBanner from '@/shared/components/OfflineBanner';
import AppSplash from '@/shared/components/AppSplash';
import { queryClient } from '@/shared/api/queryClient';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
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

const ToastBody = ({
  borderColor,
  icon,
  text1,
  text2,
}: {
  borderColor: string;
  icon: string;
  text1?: string;
  text2?: string;
}) => (
  <View style={[toastStyles.box, { borderLeftColor: borderColor }]}>
    <MaterialCommunityIcons name={icon as never} size={22} color={borderColor} style={toastStyles.icon} />
    <View style={toastStyles.textCol}>
      {text1 ? <Text style={toastStyles.text1}>{text1}</Text> : null}
      {text2 ? <Text style={toastStyles.text2}>{text2}</Text> : null}
    </View>
  </View>
);

const toastStyles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    marginHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#1A1A2E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  icon: { marginRight: spacing.sm },
  textCol: { flex: 1 },
  text1: { ...typography.bodySmMedium, color: colors.text },
  text2: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});

const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => <ToastBody borderColor={colors.success} icon="check-circle" text1={text1} text2={text2} />,
  error: ({ text1, text2 }) => <ToastBody borderColor={colors.error} icon="alert-circle" text1={text1} text2={text2} />,
  info: ({ text1, text2 }) => <ToastBody borderColor={colors.info} icon="information" text1={text1} text2={text2} />,
};

const App = () => {
  const setUser = useAuthStore(state => state.setUser);
  const isLoading = useAuthStore(state => state.isLoading);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let previousUID: string | null = null;
    const unsubscribeAuth = authService.onAuthStateChanged(async user => {
      const currentUID = user?.uid ?? null;
      if (previousUID !== null && previousUID !== currentUID) {
        queryClient.clear();
      }
      previousUID = currentUID;
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

  if (isLoading) return <AppSplash />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationContainer linking={linking}>
            <RootNavigator />
            <OfflineBanner visible={isOffline} />
          </NavigationContainer>
          <Toast config={toastConfig} position="top" topOffset={50} />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;
