import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '@/screens/home/HomeScreen';
import PlansScreen from '@/screens/plans/PlansScreen';
import ExploreScreen from '@/screens/explore/ExploreScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import TrainingHistoryScreen from '@/screens/training/TrainingHistoryScreen';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import CustomTabBar from './CustomTabBar';
import { TAB_SCENE_BOTTOM_PADDING } from '@/navigation/tabBarMetrics';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs = () => {
  const insets = useSafeAreaInsets();
  const tabBarAreaHeight = TAB_SCENE_BOTTOM_PADDING + Math.max(insets.bottom, 10);

  const tabBarStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'transparent',
      borderTopWidth: 0,
      elevation: 0,
      height: tabBarAreaHeight,
    }),
    [tabBarAreaHeight],
  );

  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { ...typography.h4, color: colors.text },
        tabBarStyle,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false, title: 'Ana Sayfa' }} />
      <Tab.Screen name="Plans" component={PlansScreen} options={{ headerShown: false, title: 'Planlarım' }} />
      <Tab.Screen name="Explore" component={ExploreScreen} options={{ headerShown: false, title: 'Keşfet' }} />
      <Tab.Screen name="Training" component={TrainingHistoryScreen} options={{ headerShown: false, title: 'Antrenman' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false, title: 'Profil' }} />
    </Tab.Navigator>
  );
};

export default MainTabs;
