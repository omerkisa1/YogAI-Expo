import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useUpdatePlan } from '@/features/plans/hooks/useCreatePlan';
import { usePlans } from '@/features/plans/hooks/usePlans';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useCompletedSessionsByPlan, useTrainingStats } from '@/features/training/hooks/useTraining';
import EmptyState from '@/shared/components/EmptyState';
import ErrorView from '@/shared/components/ErrorView';
import PlanCard from '@/shared/components/PlanCard';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import Touchable from '@/shared/components/Touchable';
import type { Plan, Level } from '@/shared/types/plan';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { cardShadow } from '@/theme/shadows';
import { typography } from '@/theme/typography';
import { TAB_SCENE_BOTTOM_PADDING } from '@/navigation/tabBarMetrics';

interface StatCardData {
  id: string;
  icon: string;
  label: string;
  value: string;
  backgroundColor: string;
  iconColor: string;
}

interface QuickStartPreset {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  level: Level;
  duration: number;
  gradient: [string, string];
  titleColor: string;
  subtitleColor: string;
  actionColor: string;
  iconColor: string;
}

const dailyMessages = [
  'Bugün harika bir gün yoga için',
  'Nefesine odaklan, bedenini dinle',
  'Her pratik seni güçlendirir',
  'Küçük adımlar, büyük değişimler',
  'Bedenin sana teşekkür edecek',
] as const;

const quickStartPresets: QuickStartPreset[] = [
  {
    id: 'quick-beginner',
    icon: 'leaf',
    title: 'Başlangıç',
    subtitle: '15dk • Tam Vücut',
    level: 'beginner',
    duration: 15,
    gradient: [colors.gradientPrimary[0], colors.gradientPrimary[1]],
    titleColor: colors.textOnPrimary,
    subtitleColor: 'rgba(255,255,255,0.88)',
    actionColor: colors.textOnPrimary,
    iconColor: colors.textOnPrimary,
  },
  {
    id: 'quick-intermediate',
    icon: 'tree',
    title: 'Orta Seviye',
    subtitle: '25dk • Denge',
    level: 'intermediate',
    duration: 25,
    gradient: [colors.gradientIntermediate[0], colors.gradientIntermediate[1]],
    titleColor: colors.warningDark,
    subtitleColor: colors.textSecondary,
    actionColor: colors.warningDark,
    iconColor: colors.warningDark,
  },
  {
    id: 'quick-advanced',
    icon: 'fire',
    title: 'İleri Seviye',
    subtitle: '35dk • Güç',
    level: 'advanced',
    duration: 35,
    gradient: ['#C62828', '#8E1A1A'],
    titleColor: colors.textOnPrimary,
    subtitleColor: 'rgba(255,255,255,0.88)',
    actionColor: colors.textOnPrimary,
    iconColor: colors.textOnPrimary,
  },
];

const focusAreaLabelMap: Record<string, string> = {
  full_body: 'Tam Vücut',
  legs: 'Bacaklar',
  back: 'Sırt',
  core: 'Core',
  balance: 'Denge',
  flexibility: 'Esneklik',
  arms: 'Kollar',
  hips: 'Kalça',
};

const formatHours = (seconds: number) => (!seconds ? '0' : (seconds / 3600).toFixed(1));

const getDailyMessage = () => {
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return dailyMessages[day % dailyMessages.length];
};

const safeStatNumber = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const windowWidth = Dimensions.get('window').width;
  const quickCardWidth = useMemo(() => Math.round(windowWidth * 0.42), [windowWidth]);

  const profileQuery = useProfile();
  const plansQuery = usePlans();
  const statsQuery = useTrainingStats();
  const completedSessionsByPlan = useCompletedSessionsByPlan();
  const updatePlanMutation = useUpdatePlan();

  const profileName = profileQuery.data?.display_name || 'Yogi';
  const avatarInitial = profileName.charAt(0).toUpperCase() || 'Y';
  const dailyMessage = useMemo(() => getDailyMessage(), []);

  const stats = useMemo(
    () => statsQuery.data ?? { total_sessions: 0, total_duration_sec: 0, average_accuracy: 0, current_streak: 0 },
    [statsQuery.data],
  );

  const displayAvgPct = useMemo(() => {
    const raw = safeStatNumber(stats.average_accuracy, 0);
    const r = Math.round(raw);
    return Number.isNaN(r) ? 0 : r;
  }, [stats.average_accuracy]);

  const statCards = useMemo<StatCardData[]>(
    () => [
      {
        id: 'total-sessions',
        icon: 'calendar-check-outline',
        label: 'Antrenman',
        value: `${safeStatNumber(stats.total_sessions, 0)}`,
        backgroundColor: colors.statGreen,
        iconColor: colors.primaryDark,
      },
      {
        id: 'total-hours',
        icon: 'clock-outline',
        label: 'Saat',
        value: formatHours(safeStatNumber(stats.total_duration_sec, 0)),
        backgroundColor: colors.statBlue,
        iconColor: colors.info,
      },
      {
        id: 'avg-score',
        icon: 'bullseye-arrow',
        label: 'Ort. Skor',
        value: `%${displayAvgPct}`,
        backgroundColor: colors.statOrange,
        iconColor: colors.warning,
      },
      {
        id: 'streak',
        icon: 'fire',
        label: 'Gün Serisi',
        value: `${safeStatNumber(stats.current_streak, 0)}`,
        backgroundColor: colors.statPurple,
        iconColor: colors.accent,
      },
    ],
    [stats.total_sessions, stats.total_duration_sec, stats.current_streak, displayAvgPct],
  );

  const allPlans = useMemo(() => (Array.isArray(plansQuery.data) ? plansQuery.data : []), [plansQuery.data]);

  const latestPlans = useMemo(() => allPlans.slice(0, 3), [allPlans]);
  const hasCriticalError = profileQuery.isError || plansQuery.isError;
  const isInitialLoading =
    (profileQuery.isLoading && !profileQuery.data) ||
    (plansQuery.isLoading && !plansQuery.data);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      profileQuery.refetch(),
      plansQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['training', 'sessions'] }),
    ]);
    setRefreshing(false);
  }, [profileQuery, plansQuery, queryClient]);

  const handleOpenPlan = useCallback(
    (planId: string) => {
      navigation.navigate('PlanDetail', { planId });
    },
    [navigation],
  );

  const togglePlanMeta = useCallback(
    async (plan: Plan, data: { favorite?: boolean; pin?: boolean }) => {
      try {
        await updatePlanMutation.mutateAsync({ id: plan.id, data });
        await queryClient.invalidateQueries({ queryKey: ['plans'] });
      } catch {
        Toast.show({
          type: 'error',
          position: 'top',
          text1: 'İşlem başarısız',
          text2: 'Plan bilgisi güncellenemedi.',
        });
      }
    },
    [queryClient, updatePlanMutation],
  );

  const onToggleFavorite = useCallback((plan: Plan) => void togglePlanMeta(plan, { favorite: !plan.favorite }), [togglePlanMeta]);
  const onTogglePin = useCallback((plan: Plan) => void togglePlanMeta(plan, { pin: !plan.pin }), [togglePlanMeta]);

  const goCreatePlan = useCallback(() => {
    navigation.navigate('CreatePlan');
  }, [navigation]);

  const renderQuickItem = useCallback(
    ({ item }: { item: QuickStartPreset }) => (
      <Touchable
        onPress={() => navigation.navigate('CreatePlan', { presetLevel: item.level, presetDuration: item.duration })}
        style={[styles.quickCard, { width: quickCardWidth }]}
        borderRadius={20}
        accessibilityRole="button"
        accessibilityLabel={`${item.title} hızlı antrenmanı başlat`}
      >
        <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickGradient}>
          <MaterialCommunityIcons name={item.icon as never} size={28} color={item.iconColor} />
          <View style={styles.quickTextBlock}>
            <Text style={[styles.quickTitle, { color: item.titleColor }]}>{item.title}</Text>
            <Text style={[styles.quickSubtitle, { color: item.subtitleColor }]} numberOfLines={2}>
              {item.subtitle}
            </Text>
          </View>
          <View style={styles.quickActionRow}>
            <Text style={[styles.quickAction, { color: item.actionColor }]}>Başlat</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color={item.actionColor} />
          </View>
        </LinearGradient>
      </Touchable>
    ),
    [navigation, quickCardWidth],
  );

  if (hasCriticalError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorContainer}>
          <ErrorView
            type="generic"
            title="Ana sayfa yüklenemedi"
            description="Veriler şu anda getirilemiyor. Lütfen tekrar deneyin."
            onRetry={() => void onRefresh()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <LinearGradient colors={[...colors.gradientWarm]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.gradientFill}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerTextCol}>
              <Text style={styles.greetingTitle}>Merhaba, {profileName}</Text>
              <Text style={styles.greetingSub}>{dailyMessage}</Text>
            </View>
            <Touchable onPress={() => tabNavigation.navigate('Profile')} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel="Profil">
              <LinearGradient
                colors={[colors.gradientPrimary[0], colors.gradientPrimary[1]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <Text style={styles.avatarLetter}>{avatarInitial}</Text>
              </LinearGradient>
            </Touchable>
          </View>

          {isInitialLoading ? (
            <View style={styles.skeletonBlock}>
              <SkeletonLoader width="100%" height={120} borderRadius={radius.lg} />
              <View style={styles.statSkeletonRow}>
                <SkeletonLoader width="48%" height={96} borderRadius={radius.lg} />
                <SkeletonLoader width="48%" height={96} borderRadius={radius.lg} />
              </View>
            </View>
          ) : (
            <View style={styles.statGrid}>
              {statCards.map(card => (
                <View key={card.id} style={[styles.statCard, { backgroundColor: card.backgroundColor }]}>
                  <MaterialCommunityIcons name={card.icon as never} size={20} color={card.iconColor} />
                  <Text style={styles.statValue}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.sectionTitle}>Hızlı Başlat</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickListContent} nestedScrollEnabled>
            {quickStartPresets.map(item => (
              <View key={item.id} style={{ marginRight: spacing.sm }}>
                {renderQuickItem({ item })}
              </View>
            ))}
          </ScrollView>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleInline}>Planlarım</Text>
            <Touchable onPress={() => tabNavigation.navigate('Plans')} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Tüm planları gör">
              <Text style={styles.viewAllText}>Tümünü Gör</Text>
            </Touchable>
          </View>

          {plansQuery.isLoading && !plansQuery.data ? (
            <View style={styles.planSkeletonColumn}>
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonLoader key={`plan-skeleton-${i}`} width="100%" height={164} borderRadius={radius.lg} />
              ))}
            </View>
          ) : latestPlans.length === 0 ? (
            <EmptyState
              icon="calendar-plus"
              title="Henüz planınız yok"
              description="AI ile ilk yoga planınızı oluşturmaya başlayın."
              actionLabel="İlk Planı Oluştur"
              onAction={goCreatePlan}
            />
          ) : (
            <View style={styles.planList}>
              {latestPlans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onPress={handleOpenPlan}
                  onToggleFavorite={onToggleFavorite}
                  onTogglePin={onTogglePin}
                  actionsDisabled={updatePlanMutation.isPending}
                  completedSessionsCount={completedSessionsByPlan.get(plan.id) ?? 0}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  gradientFill: { flex: 1 },
  container: { flex: 1 },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: TAB_SCENE_BOTTOM_PADDING + spacing.xxxl,
  },
  errorContainer: { flex: 1, paddingHorizontal: spacing.base, justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTextCol: { flex: 1, paddingRight: spacing.md },
  greetingTitle: { ...typography.h3, color: colors.text },
  greetingSub: { ...typography.bodySm, color: colors.textSecondary, marginTop: spacing.xs },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  avatarLetter: { ...typography.bodyMedium, color: colors.textOnPrimary, fontWeight: '700' },
  skeletonBlock: { gap: spacing.sm, marginBottom: spacing.lg },
  statSkeletonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
    gap: spacing.xs,
  },
  statValue: { ...typography.h2, color: colors.text, fontWeight: '700' },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  sectionTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.sm, marginTop: spacing.sm },
  sectionTitleInline: { ...typography.h4, color: colors.text },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  viewAllText: { ...typography.bodySm, color: colors.primary, fontWeight: '600' },
  quickListContent: { paddingVertical: spacing.xs, gap: spacing.sm, paddingRight: spacing.base },
  quickCard: {
    marginRight: spacing.sm,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...cardShadow,
  },
  quickGradient: {
    minHeight: 168,
    padding: spacing.base,
    justifyContent: 'space-between',
  },
  quickTextBlock: { flexShrink: 1, gap: 4, marginTop: spacing.sm },
  quickTitle: { ...typography.bodyMedium, fontWeight: '600' },
  quickSubtitle: { ...typography.caption, lineHeight: 18 },
  quickActionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.md },
  quickAction: { ...typography.bodySmMedium, fontWeight: '700' },
  planSkeletonColumn: { gap: spacing.sm },
  planList: { gap: spacing.sm },
});

export default HomeScreen;
