import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTrainingSessions, useTrainingStats } from '@/features/training/hooks/useTraining';
import Button from '@/shared/components/Button';
import Card from '@/shared/components/Card';
import ErrorView from '@/shared/components/ErrorView';
import ProgressBar from '@/shared/components/ProgressBar';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import Touchable from '@/shared/components/Touchable';
import type { TrainingSession } from '@/shared/types/training';
import type { MainTabParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatMinutes = (seconds?: number) => {
  if (!seconds) return '0dk';
  return `${Math.max(1, Math.round(seconds / 60))}dk`;
};

const formatHours = (seconds?: number) => {
  if (!seconds) return '0';
  return (seconds / 3600).toFixed(1);
};

const getAccuracyColor = (accuracy: number) => {
  if (accuracy >= 80) return colors.success;
  if (accuracy >= 50) return colors.warning;
  return colors.error;
};

const safeNumber = (val: unknown, fallback = 0): number => {
  const num = Number(val);
  return Number.isNaN(num) || !Number.isFinite(num) ? fallback : num;
};

const safePercent = (val: unknown): string => {
  const num = safeNumber(val, 0);
  return `%${Math.round(num)}`;
};

const TrainingHistoryScreen = () => {
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();
  const sessionsQuery = useTrainingSessions();
  const statsQuery = useTrainingStats();
  const [refreshing, setRefreshing] = useState(false);

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const stats = statsQuery.data;
  const totalSessions = safeNumber(stats?.total_sessions, 0);
  const totalDurationSeconds = safeNumber(stats?.total_duration_sec, 0);
  const avgAccuracy = safeNumber(stats?.average_accuracy, 0);
  const displayAccuracy = Math.round(avgAccuracy);
  const heroProgress = totalSessions > 0 ? avgAccuracy : 0;
  const totalLabel = `Toplam: ${totalSessions} antrenman`;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([sessionsQuery.refetch(), statsQuery.refetch()]);
    setRefreshing(false);
  }, [sessionsQuery, statsQuery]);

  if ((sessionsQuery.isLoading && !sessionsQuery.data) || (statsQuery.isLoading && !statsQuery.data)) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingWrap}>
          <SkeletonLoader width="100%" height={132} borderRadius={radius.lg} />
          <SkeletonLoader width="100%" height={128} borderRadius={radius.lg} />
          <SkeletonLoader width="100%" height={128} borderRadius={radius.lg} />
        </View>
      </SafeAreaView>
    );
  }

  if (sessionsQuery.isError || statsQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorWrap}><ErrorView type="generic" title="Antrenman verileri yüklenemedi" description="Lütfen internet bağlantınızı kontrol ederek tekrar deneyin." onRetry={() => { void onRefresh(); }} /></View>
      </SafeAreaView>
    );
  }

  const renderSessionItem = ({ item }: { item: TrainingSession }) => {
    const rawAccuracy = safeNumber(item.average_accuracy, 0);
    const normalizedAccuracy = Math.round(rawAccuracy);
    const sessionAccuracy = Math.max(0, Math.min(100, normalizedAccuracy));
    const scoreColor = getAccuracyColor(sessionAccuracy);
    const durationLabel = formatMinutes(item.total_duration_sec);
    const completedMoveCount = item.results?.length ?? 0;

    return (
      <Touchable onPress={() => { Toast.show({ type: 'info', position: 'top', text1: 'Detay yakında', text2: 'Antrenman detay ekranı sonraki adımda eklenecek.' }); }} style={styles.sessionPressable} borderRadius={radius.lg} accessibilityRole="button" accessibilityLabel="Antrenman oturumu detay">
        <Card variant="default" style={styles.sessionCard}>
          <View style={styles.sessionHeaderRow}>
            <Text style={styles.sessionTitle}>Plan #{item.plan_id.slice(0, 8)}</Text>
            <Text style={[styles.sessionScore, { color: scoreColor }]}>%{sessionAccuracy}</Text>
          </View>
          <Text style={styles.sessionDate}>{formatDate(item.started_at)}</Text>
          <ProgressBar progress={sessionAccuracy} color={scoreColor} height={4} />
          <View style={styles.sessionMetaRow}>
            <View style={styles.sessionMetaItem}><MaterialCommunityIcons name="clock-outline" size={14} color={colors.textSecondary} /><Text style={styles.sessionMetaText}>{durationLabel}</Text></View>
            <View style={styles.sessionMetaItem}><MaterialCommunityIcons name="yoga" size={14} color={colors.textSecondary} /><Text style={styles.sessionMetaText}>{completedMoveCount} hareket</Text></View>
          </View>
        </Card>
      </Touchable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <FlatList
        data={sessions}
        keyExtractor={item => item.id}
        renderItem={renderSessionItem}
        contentContainerStyle={styles.listContent}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
        getItemLayout={(_, index) => ({ length: 152, offset: 152 * index, index })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Antrenmanlarım</Text>
            <LinearGradient colors={[colors.gradientHero[0], colors.gradientHero[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatItem}>
                  <MaterialCommunityIcons name="calendar-check-outline" size={20} color={colors.textOnDark} />
                  <Text style={styles.heroStatValue}>{totalSessions}</Text>
                  <Text style={styles.heroStatLabel}>antrenman</Text>
                </View>
                <View style={styles.heroSeparator} />
                <View style={styles.heroStatItem}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color={colors.textOnDark} />
                  <Text style={styles.heroStatValue}>{formatHours(totalDurationSeconds)}</Text>
                  <Text style={styles.heroStatLabel}>saat</Text>
                </View>
                <View style={styles.heroSeparator} />
                <View style={styles.heroStatItem}>
                  <MaterialCommunityIcons name="bullseye-arrow" size={20} color={colors.textOnDark} />
                  <Text style={styles.heroStatValue}>{safePercent(displayAccuracy)}</Text>
                  <Text style={styles.heroStatLabel}>ort. skor</Text>
                </View>
              </View>
              <Text style={styles.heroSummary}>{totalLabel}</Text>
              {heroProgress > 0 ? <ProgressBar progress={heroProgress} color={colors.textOnPrimary} height={4} /> : null}
            </LinearGradient>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}><MaterialCommunityIcons name="meditation" size={32} color={colors.accent} /></View>
            <Text style={styles.emptyTitle}>Henüz antrenman yapmadınız</Text>
            <Text style={styles.emptyDescription}>Bir plan seçerek ilk antrenmanınıza başlayın.</Text>
            <Button title="Planlara Git" onPress={() => navigation.navigate('Plans')} variant="primary" size="lg" fullWidth={false} accessibilityLabel="Planlara git" />
          </View>
        }
        ListFooterComponent={<View style={styles.listFooter} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  loadingWrap: { paddingHorizontal: spacing.base, paddingTop: spacing.base, gap: spacing.sm },
  errorWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.base },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.xxl, gap: spacing.sm },
  listFooter: { height: spacing.sm },
  pageTitle: { ...typography.h2, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.sm },
  heroCard: { padding: spacing.xl, borderRadius: radius.xl, gap: spacing.sm, marginBottom: spacing.base, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroStatsRow: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'space-between' },
  heroStatItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  heroSeparator: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: spacing.sm },
  heroStatValue: { ...typography.h1, color: colors.textOnDark, fontWeight: '700' },
  heroStatLabel: { ...typography.caption, color: 'rgba(255,255,255,0.72)' },
  heroSummary: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  sessionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sessionPressable: { borderRadius: radius.lg },
  sessionCard: { gap: spacing.sm, paddingVertical: spacing.md },
  sessionTitle: { ...typography.h4, color: colors.text },
  sessionDate: { ...typography.bodySm, color: colors.textSecondary },
  sessionScore: { ...typography.bodySmMedium },
  sessionMetaRow: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.base, rowGap: spacing.xs, flexWrap: 'wrap' },
  sessionMetaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sessionMetaText: { ...typography.caption, color: colors.textMuted },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  emptyIconWrap: { width: 64, height: 64, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft, marginBottom: spacing.base },
  emptyTitle: { ...typography.h4, color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  emptyDescription: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.base },
});

export default TrainingHistoryScreen;
