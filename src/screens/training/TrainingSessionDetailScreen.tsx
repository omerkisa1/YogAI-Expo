import React from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTrainingSession } from '@/features/training/hooks/useTraining';
import Button from '@/shared/components/Button';
import ErrorView from '@/shared/components/ErrorView';
import LoadingView from '@/shared/components/LoadingView';
import ProgressBar from '@/shared/components/ProgressBar';
import Touchable from '@/shared/components/Touchable';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingSessionDetail'>;

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getAccuracyColor = (accuracy: number) => {
  if (accuracy >= 80) return colors.success;
  if (accuracy >= 50) return colors.warning;
  return colors.error;
};

const TrainingSessionDetailScreen = ({ route, navigation }: Props) => {
  const { sessionId } = route.params;
  const insets = useSafeAreaInsets();
  const sessionQuery = useTrainingSession(sessionId);

  const session = sessionQuery.data;
  const results = session?.results ?? [];

  if (sessionQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingView message="Antrenman yükleniyor..." fullScreen />
      </SafeAreaView>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorWrap}>
          <ErrorView type="generic" title="Antrenman detayı yüklenemedi" onRetry={() => void sessionQuery.refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  const avgAccuracy = Math.round(session.average_accuracy ?? 0);
  const totalDurationMin = Math.max(1, Math.round((session.total_duration_sec ?? 0) / 60));
  const accuracyColor = getAccuracyColor(avgAccuracy);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={[styles.header, { paddingTop: Math.max(spacing.sm, insets.top) }]}>
        <Touchable onPress={() => navigation.goBack()} style={styles.backBtn} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel="Geri">
          <MaterialCommunityIcons name="chevron-left" size={26} color={colors.primary} />
        </Touchable>
        <Text style={styles.headerTitle}>Antrenman Detayı</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <View style={styles.summaryCard}>
          <Text style={styles.dateText}>{formatDate(session.started_at)}</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStatItem}>
              <Text style={[styles.summaryStatValue, { color: accuracyColor }]}>%{avgAccuracy}</Text>
              <Text style={styles.summaryStatLabel}>Toplam Skor</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>{totalDurationMin} dk</Text>
              <Text style={styles.summaryStatLabel}>Süre</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryStatItem}>
              <Text style={styles.summaryStatValue}>{results.length}</Text>
              <Text style={styles.summaryStatLabel}>Poz</Text>
            </View>
          </View>
          <ProgressBar progress={avgAccuracy} color={accuracyColor} height={6} animated />
        </View>

        {results.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Poz Sonuçları</Text>
            <View style={styles.resultsList}>
              {results.map((r, i) => {
                const acc = Math.round(r.accuracy);
                const dur = Math.max(1, Math.round((r.duration_seconds ?? 0) / 60));
                const rColor = getAccuracyColor(acc);
                return (
                  <View key={`${r.pose_id}-${i}`} style={styles.resultCard}>
                    <View style={styles.resultHeader}>
                      <View style={styles.resultIndexBadge}>
                        <Text style={styles.resultIndexText}>{i + 1}</Text>
                      </View>
                      <Text style={styles.resultPoseName} numberOfLines={1}>{r.pose_id}</Text>
                      <Text style={[styles.resultScore, { color: rColor }]}>%{acc}</Text>
                    </View>
                    <ProgressBar progress={acc} color={rColor} height={4} animated />
                    <View style={styles.resultMeta}>
                      <MaterialCommunityIcons name="clock-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.resultMetaText}>{dur} dk</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.emptyResults}>
            <MaterialCommunityIcons name="information-outline" size={24} color={colors.textMuted} />
            <Text style={styles.emptyResultsText}>Poz sonuçları henüz yüklenmedi.</Text>
          </View>
        )}

        <Button
          title="Geri Dön"
          onPress={() => navigation.goBack()}
          variant="outline"
          size="lg"
          fullWidth
          icon="arrow-left"
          accessibilityLabel="Geri dön"
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  errorWrap: { flex: 1, justifyContent: 'center', padding: spacing.base },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingBottom: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text, flex: 1, textAlign: 'center' },
  headerSpacer: { width: 36 },
  content: { padding: spacing.base, gap: spacing.base },
  summaryCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderLight,
    padding: spacing.base, gap: spacing.sm,
  },
  dateText: { ...typography.bodySm, color: colors.textSecondary },
  summaryStats: { flexDirection: 'row', alignItems: 'center' },
  summaryStatItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  summaryStatValue: { ...typography.h2, color: colors.text },
  summaryStatLabel: { ...typography.caption, color: colors.textSecondary },
  summaryDivider: { width: 1, height: 40, backgroundColor: colors.borderLight, marginHorizontal: spacing.sm },
  sectionTitle: { ...typography.h4, color: colors.text },
  resultsList: { gap: spacing.sm },
  resultCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight,
    padding: spacing.base, gap: spacing.sm,
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  resultIndexBadge: {
    width: 26, height: 26, borderRadius: radius.full,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  resultIndexText: { ...typography.captionMedium, color: colors.textOnPrimary },
  resultPoseName: { ...typography.bodySmMedium, color: colors.text, flex: 1 },
  resultScore: { ...typography.bodySmMedium },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  resultMetaText: { ...typography.caption, color: colors.textMuted },
  emptyResults: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  emptyResultsText: { ...typography.bodySm, color: colors.textMuted, textAlign: 'center' },
});

export default TrainingSessionDetailScreen;
