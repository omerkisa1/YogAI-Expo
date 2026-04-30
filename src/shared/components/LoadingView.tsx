import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export interface LoadingViewProps { message?: string; fullScreen?: boolean }

const LoadingView = ({ message = 'Yükleniyor...', fullScreen = false }: LoadingViewProps) => (
  <View style={[styles.container, fullScreen && styles.fullScreen]}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.message}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  fullScreen: { flex: 1, backgroundColor: colors.background },
  message: { ...typography.bodySm, color: colors.textSecondary },
});

export default LoadingView;
