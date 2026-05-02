import React from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Button from '@/shared/components/Button';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingSession'>;

const TrainingScreen = ({ route, navigation }: Props) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="camera-outline" size={56} color={colors.primary} />
        </View>
        <Text style={styles.title}>Canlı Antrenman</Text>
        <Text style={styles.description}>Kamera tabanlı poz analizi yakında eklenecek.</Text>
        <View style={styles.metaCard}>
          <Text style={styles.metaLabel}>Plan ID</Text>
          <Text style={styles.metaValue}>{route.params.planId}</Text>
          <Text style={styles.metaLabel}>Oturum ID</Text>
          <Text style={styles.metaValue}>{route.params.sessionId}</Text>
        </View>
        <Button title="Poz Testi Başlat" onPress={() => navigation.navigate('CameraTest')} variant="primary" size="lg" fullWidth icon="camera-outline" accessibilityLabel="Poz testi başlat" />
        <Button title="Geri Dön" onPress={() => navigation.goBack()} variant="outline" size="lg" fullWidth icon="arrow-left" accessibilityLabel="Geri dön" />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, justifyContent: 'center', gap: spacing.base, alignItems: 'center' },
  iconWrap: { width: 96, height: 96, borderRadius: radius.full, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { ...typography.h2, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  metaCard: { backgroundColor: colors.surfaceElevated, borderRadius: radius.lg, padding: spacing.base, gap: spacing.xs, width: '100%', borderWidth: 1, borderColor: colors.borderLight },
  metaLabel: { ...typography.caption, color: colors.textMuted },
  metaValue: { ...typography.bodySmMedium, color: colors.text },
});

export default TrainingScreen;
