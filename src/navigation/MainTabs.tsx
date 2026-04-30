import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '@/screens/home/HomeScreen';
import PlansScreen from '@/screens/plans/PlansScreen';
import ProfileScreen from '@/screens/profile/ProfileScreen';
import TrainingHistoryScreen from '@/screens/training/TrainingHistoryScreen';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import CustomTabBar from './CustomTabBar';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabs = () => {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { ...typography.h4, color: colors.text },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false, title: 'Ana Sayfa' }} />
      <Tab.Screen name="Plans" component={PlansScreen} options={{ headerShown: false, title: 'Planlarım' }} />
      <Tab.Screen name="Training" component={TrainingHistoryScreen} options={{ headerShown: false, title: 'Antrenman' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false, title: 'Profil' }} />
    </Tab.Navigator>
  );
};

export default MainTabs;
