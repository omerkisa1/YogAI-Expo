import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@/features/auth/stores/authStore';
import Touchable from '@/shared/components/Touchable';
import OnboardingScreen from '@/screens/onboarding/OnboardingScreen';
import CreatePlanScreen from '@/screens/plans/CreatePlanScreen';
import PlanDetailScreen from '@/screens/plans/PlanDetailScreen';
import EditProfileScreen from '@/screens/profile/EditProfileScreen';
import TrainingScreen from '@/screens/training/TrainingScreen';
import CameraTestScreen from '@/screens/camera/CameraTestScreen';
import TrainingSessionDetailScreen from '@/screens/training/TrainingSessionDetailScreen';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ONBOARDING_STORAGE_KEY = 'hasSeenOnboarding';

const AuthenticatedNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={({ navigation }) => ({
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { ...typography.h4, color: colors.text },
        headerBackTitleVisible: false,
        headerLeft: ({ canGoBack }) => {
          if (!canGoBack) return null;
          return (
            <Touchable
              onPress={navigation.goBack}
              style={styles.backButton}
              borderRadius={12}
              accessibilityRole="button"
              accessibilityLabel="Geri"
            >
              <MaterialCommunityIcons name="chevron-left" size={26} color={colors.primary} />
            </Touchable>
          );
        },
        contentStyle: { backgroundColor: colors.background },
      })}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="PlanDetail" component={PlanDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreatePlan" component={CreatePlanScreen} options={{ title: 'Plan Oluştur' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Profili Düzenle' }} />
      <Stack.Screen name="TrainingSession" component={TrainingScreen} options={{ title: 'Antrenman' }} />
      <Stack.Screen name="CameraTest" component={CameraTestScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="TrainingSessionDetail" component={TrainingSessionDetailScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};

const RootNavigator = () => {
  const isLoading = useAuthStore(state => state.isLoading);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isOnboardingLoading, setOnboardingLoading] = useState(true);

  useEffect(() => {
    const bootstrapOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        setHasSeenOnboarding(value === 'true');
      } finally {
        setOnboardingLoading(false);
      }
    };
    void bootstrapOnboarding();
  }, []);

  const handleOnboardingDone = useCallback(async () => {
    setHasSeenOnboarding(true);
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  }, []);

  if (isLoading || isOnboardingLoading) {
    return <View style={styles.loadingFallback} />;
  }

  if (!hasSeenOnboarding) {
    return <OnboardingScreen onDone={() => void handleOnboardingDone()} />;
  }

  if (!isAuthenticated) {
    return <AuthStack />;
  }

  return <AuthenticatedNavigator />;
};

const styles = StyleSheet.create({
  backButton: {
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
  loadingFallback: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

export default RootNavigator;
