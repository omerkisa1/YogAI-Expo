import React from 'react';
import { StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Touchable from '@/shared/components/Touchable';
import LoginScreen from '@/screens/auth/LoginScreen';
import RegisterScreen from '@/screens/auth/RegisterScreen';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthStack = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
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
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false, title: 'Giriş' }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false, title: 'Hesap Oluştur' }} />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  backButton: {
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
  },
});

export default AuthStack;
