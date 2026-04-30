import React from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const AppSplash = () => (
  <SafeAreaView style={styles.safeArea}>
    <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
    <LinearGradient
      colors={[colors.gradientPrimary[0], colors.gradientPrimary[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.content}
    >
      <MaterialCommunityIcons name="yoga" size={80} color={colors.textOnPrimary} />
      <Text style={styles.title}>YogAI</Text>
      <ActivityIndicator size="small" color={colors.textOnPrimary} style={styles.loader} />
    </LinearGradient>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.primaryDark },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.base },
  title: { ...typography.display, color: colors.textOnPrimary, marginTop: spacing.base },
  loader: { marginTop: spacing.lg },
});

export default AppSplash;
