import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, FlatList, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useUpdatePlan } from '@/features/plans/hooks/useCreatePlan';
import { usePlans } from '@/features/plans/hooks/usePlans';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useTrainingStats } from '@/features/training/hooks/useTraining';
import EmptyState from '@/shared/components/EmptyState';
import ErrorView from '@/shared/components/ErrorView';
import PlanCard from '@/shared/components/PlanCard';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import Touchable from '@/shared/components/Touchable';
import type { Plan } from '@/shared/types/plan';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { cardStyle } from '@/theme/shadows';
import { typography } from '@/theme/typography';

interface StatCardData { id: string; icon: string; label: string; value: string; backgroundColor: string; iconColor: string }

interface QuickStartPreset {
  id: string; icon: string; title: string; subtitle: string;
  level: 'beginner' | 'intermediate' | 'advanced'; duration: number;
  gradient: [string, string]; titleColor: string; subtitleColor: string; actionColor: string; iconColor: string;
}

const dailyMessages = ['Bugün harika bir gün yoga için', 'Nefesine odaklan, bedenini dinle', 'Her pratik seni güçlendirir', 'Küçük adımlar, büyük değişimler', 'Bedenin sana teşekkür edecek'] as const;

const quickStartPresets: QuickStartPreset[] = [
  { id: 'quick-beginner', icon: 'leaf', title: 'Başlangıç', subtitle: '15dk • Tam Vücut', level: 'beginner', duration: 15, gradient: [colors.gradientBeginner[0], colors.gradientBeginner[1]], titleColor: colors.primaryDark, subtitleColor: colors.primaryDark, actionColor: colors.primaryDark, iconColor: colors.primaryDark },
  { id: 'quick-intermediate', icon: 'tree', title: 'Orta Seviye', subtitle: '25dk • Denge', level: 'intermediate', duration: 25, gradient: [colors.gradientIntermediate[0], colors.gradientIntermediate[1]], titleColor: colors.warningDark, subtitleColor: colors.warningDark, actionColor: colors.warningDark, iconColor: colors.warningDark },
  { id: 'quick-advanced', icon: 'fire', title: 'İleri Seviye', subtitle: '35dk • Güç', level: 'advanced', duration: 35, gradient: [colors.gradientAdvanced[0], colors.gradientAdvanced[1]], titleColor: colors.error, subtitleColor: colors.error, actionColor: colors.error, iconColor: colors.error },
];

const formatHours = (seconds: number) => (!seconds ? '0' : (seconds / 3600).toFixed(1));
const getDailyMessage = () => { const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000); return dailyMessages[day % dailyMessages.length]; };

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const quickStartCardWidth = useMemo(() => Math.max(170, Dimensions.get('window').width * 0.42), []);

  const profileQuery = useProfile();
  const plansQuery = usePlans();
  const statsQuery = useTrainingStats();
  const updatePlanMutation = useUpdatePlan();

  const profileName = profileQuery.data?.display_name || 'Yogi';
  const avatarInitial = profileName.charAt(0).toUpperCase() || 'Y';
  const dailyMessage = useMemo(() => getDailyMessage(), []);

  const stats = useMemo(() => statsQuery.data ?? { total_sessions: 0, total_duration_sec: 0, average_accuracy: 0, current_streak: 0 }, [statsQuery.data]);

  const statCards = useMemo<StatCardData[]>(() => [
    { id: 'total-sessions', icon: 'calendar-check-outline', label: 'Antrenman', value: `${stats.total_sessions ?? 0}`, backgroundColor: colors.statGreen, iconColor: colors.primaryDark },
    { id: 'total-hours', icon: 'clock-outline', label: 'Saat', value: formatHours(stats.total_duration_sec ?? 0), backgroundColor: colors.statBlue, iconColor: colors.info },
    { id: 'avg-score', icon: 'bullseye-arrow', label: 'Ort. Skor', value: `%${Math.round(stats.average_accuracy ?? 0)}`, backgroundColor: colors.statOrange, iconColor: colors.warning },
    { id: 'streak', icon: 'fire', label: 'Gün Serisi', value: `${stats.current_streak ?? 0}`, backgroundColor: colors.statPurple, iconColor: colors.accent },
  ], [stats]);

  const allPlans = useMemo(() => (Array.isArray(plansQuery.data) ? plansQuery.data : []), [plansQuery.data]);
  const latestPlans = useMemo(() => allPlans.slice(0, 3), [allPlans]);
  const hasCriticalError = profileQuery.isError || plansQuery.isError;
  const isInitialLoading = (profileQuery.isLoading && !profileQuery.data) || (plansQuery.isLoading && !plansQuery.data) || (statsQuery.isLoading && !statsQuery.data);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([profileQuery.refetch(), plansQuery.refetch(), statsQuery.refetch()]);
    setRefreshing(false);
  }, [profileQuery, plansQuery, statsQuery]);

  const handleOpenPlan = useCallback((planId: string) => { navigation.navigate('PlanDetail', { planId }); }, [navigation]);

  const togglePlanMeta = useCallback(async (plan: Plan, data: { favorite?: boolean; pin?: boolean }) => {
    try {
      await updatePlanMutation.mutateAsync({ id: plan.id, data });
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
    } catch {
      Toast.show({ type: 'error', position: 'top', text1: 'İşlem Başarısız', text2: 'Plan bilgisi Güncellenemedi.' });
    }
  }, [queryClient, updatePlanMutation]);

  const onToggleFavorite = useCallback((plan: Plan) => { void togglePlanMeta(plan, { favorite: !plan.favorite }); }, [togglePlanMeta]);
  const onTogglePin = useCallback((plan: Plan) => { void togglePlanMeta(plan, { pin: !plan.pin }); }, [togglePlanMeta]);

  if (hasCriticalError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <ErrorView type="generic" title="Ana sayfa Yüklenemedi" description="Veriler şu anda getirilemiyor. Lütfen tekrar deneyin." onRetry={() => { void onRefresh(); }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={[colors.gradientHero[0], colors.gradientHero[1]]} style={styles.topBar}>
          <View>
            <Text style={styles.greeting}>Merhaba, {profileName}</Text>
            <Text style={styles.dailyMessage}>{dailyMessage}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
        </LinearGradient>

        {isInitialLoading ? (
          <View style={styles.statsGrid}>
            {Array.from({ length: 4 }).map((_, i) => <SkeletonLoader key={`stat-skeleton-${i}`} width="48%" height={120} borderRadius={radius.lg} />)}
          </View>
        ) : (
          <View style={styles.statsGrid}>
            {statCards.map(item => (
              <View key={item.id} style={[styles.statCard, { backgroundColor: item.backgroundColor }]}>
                <MaterialCommunityIcons name={item.icon as never} size={20} color={item.iconColor} />
                <Text style={styles.statValue}>{item.value}</Text>
                <Text style={styles.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Hızlı Başlat</Text>
        </View>
        <FlatList
          horizontal
          data={quickStartPresets}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickStartList}
          renderItem={({ item }) => (
            <Touchable
              onPress={() => navigation.navigate('CreatePlan', { presetLevel: item.level, presetDuration: item.duration })}
              style={[styles.quickStartCard, { width: quickStartCardWidth }]}
              borderRadius={radius.xl}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} hızlı antrenmanı başlat`}
            >
              <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickStartCardGradient}>
                <MaterialCommunityIcons name={item.icon as never} size={28} color={item.iconColor} />
                <View style={styles.quickStartTextWrap}>
                  <Text style={[styles.quickStartTitle, { color: item.titleColor }]}>{item.title}</Text>
                  <Text style={[styles.quickStartSubtitle, { color: item.subtitleColor }]}>{item.subtitle}</Text>
                </View>
                <View style={styles.quickStartActionRow}>
                  <Text style={[styles.quickStartAction, { color: item.actionColor }]}>Başlat</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={item.actionColor} />
                </View>
              </LinearGradient>
            </Touchable>
          )}
          ListFooterComponent={<View style={styles.listFooterSpacer} />}
        />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Planlarım</Text>
          <Touchable onPress={() => tabNavigation.navigate('Plans')} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Tüm planları gör">
            <Text style={styles.viewAllText}>Tümünü Gör</Text>
          </Touchable>
        </View>

        {plansQuery.isLoading && !plansQuery.data ? (
          <View style={styles.planSkeletonColumn}>
            {Array.from({ length: 3 }).map((_, i) => <SkeletonLoader key={`plan-skeleton-${i}`} width="100%" height={164} borderRadius={radius.lg} />)}
          </View>
        ) : latestPlans.length === 0 ? (
          <EmptyState icon="calendar-plus" title="Henüz planınız yok" description="AI ile ilk yoga planınızı oluşturmaya başlayın." />
        ) : (
          <View style={styles.planList}>
            {latestPlans.map(plan => (
              <PlanCard key={plan.id} plan={plan} onPress={handleOpenPlan} onToggleFavorite={onToggleFavorite} onTogglePin={onTogglePin} actionsDisabled={updatePlanMutation.isPending} progress={0} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.base, paddingBottom: spacing.xxl },
  errorContainer: { flex: 1, paddingHorizontal: spacing.base, justifyContent: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.base, paddingVertical: spacing.lg, borderRadius: radius.xxl, marginTop: spacing.sm, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  greeting: { ...typography.h3, color: colors.textOnDark },
  dailyMessage: { ...typography.bodySm, color: 'rgba(255,255,255,0.72)', marginTop: spacing.xs },
  avatar: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.bodySmMedium, color: colors.primary },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm, marginBottom: spacing.lg },
  statCard: { ...cardStyle, width: '48%', minHeight: 120, padding: spacing.base, borderRadius: radius.lg, justifyContent: 'space-between' },
  statValue: { ...typography.h2, color: colors.text, marginTop: spacing.sm },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h4, color: colors.text },
  viewAllText: { ...typography.bodySmMedium, color: colors.primary },
  quickStartList: { paddingBottom: spacing.base, gap: spacing.sm },
  quickStartCard: { ...cardStyle, minHeight: 184, borderRadius: radius.xl, overflow: 'hidden' },
  quickStartCardGradient: { flex: 1, padding: spacing.base, justifyContent: 'space-between' },
  quickStartTextWrap: { gap: spacing.xs },
  listFooterSpacer: { width: spacing.xs },
  quickStartTitle: { ...typography.h4 },
  quickStartSubtitle: { ...typography.bodySm },
  quickStartActionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  quickStartAction: { ...typography.bodySmMedium },
  planSkeletonColumn: { gap: spacing.sm },
  planList: { gap: spacing.sm },
});

export default HomeScreen;
