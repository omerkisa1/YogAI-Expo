import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, Platform, RefreshControl, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
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
import { typography } from '@/theme/typography';
import { serene, sereneLayout } from '@/theme/serene';
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

const dailyMessages = ['Bugün harika bir gün yoga için', 'Nefesine odaklan, bedenini dinle', 'Her pratik seni güçlendirir', 'Küçük adımlar, büyük değişimler', 'Bedenin sana teşekkür edecek'] as const;

const quickStartPresets: QuickStartPreset[] = [
  { id: 'quick-beginner', icon: 'leaf', title: 'Başlangıç', subtitle: '15dk • Tam Vücut', level: 'beginner', duration: 15, gradient: [colors.gradientBeginner[0], colors.gradientBeginner[1]], titleColor: colors.primaryDark, subtitleColor: colors.primaryDark, actionColor: colors.primaryDark, iconColor: colors.primaryDark },
  { id: 'quick-intermediate', icon: 'tree', title: 'Orta Seviye', subtitle: '25dk • Denge', level: 'intermediate', duration: 25, gradient: [colors.gradientIntermediate[0], colors.gradientIntermediate[1]], titleColor: colors.warningDark, subtitleColor: colors.warningDark, actionColor: colors.warningDark, iconColor: colors.warningDark },
  { id: 'quick-advanced', icon: 'fire', title: 'İleri Seviye', subtitle: '35dk • Güç', level: 'advanced', duration: 35, gradient: [colors.gradientAdvanced[0], colors.gradientAdvanced[1]], titleColor: colors.error, subtitleColor: colors.error, actionColor: colors.error, iconColor: colors.error },
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

const difficultyChipStyle = (level: Level) => {
  if (level === 'beginner') return { bg: serene.tertiaryFixed, fg: serene.onTertiaryFixedVariant };
  if (level === 'advanced') return { bg: serene.secondaryFixed, fg: serene.onSecondaryFixedVariant };
  return { bg: serene.primaryFixed, fg: serene.onPrimaryContainer };
};

const HomeScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const windowWidth = Dimensions.get('window').width;
  const quickTileWidth = useMemo(() => {
    const pad = sereneLayout.containerPadding * 2;
    const gaps = sereneLayout.bentoGap * 2;
    return Math.max(96, (windowWidth - pad - gaps) / 3);
  }, [windowWidth]);

  const profileQuery = useProfile();
  const plansQuery = usePlans();
  const statsQuery = useTrainingStats();
  const completedSessionsByPlan = useCompletedSessionsByPlan();
  const updatePlanMutation = useUpdatePlan();

  const profileName = profileQuery.data?.display_name || 'Yogi';
  const avatarInitial = profileName.charAt(0).toUpperCase() || 'Y';
  const dailyMessage = useMemo(() => getDailyMessage(), []);

  const stats = useMemo(() => statsQuery.data ?? { total_sessions: 0, total_duration_sec: 0, average_accuracy: 0, current_streak: 0 }, [statsQuery.data]);

  const statCards = useMemo<StatCardData[]>(
    () => [
      { id: 'total-sessions', icon: 'calendar-check-outline', label: 'Antrenman', value: `${stats.total_sessions ?? 0}`, backgroundColor: colors.statGreen, iconColor: colors.primaryDark },
      { id: 'total-hours', icon: 'clock-outline', label: 'Saat', value: formatHours(stats.total_duration_sec ?? 0), backgroundColor: colors.statBlue, iconColor: colors.info },
      { id: 'avg-score', icon: 'bullseye-arrow', label: 'Ort. Skor', value: `%${Math.round(stats.average_accuracy ?? 0)}`, backgroundColor: colors.statOrange, iconColor: colors.warning },
      { id: 'streak', icon: 'fire', label: 'Gün Serisi', value: `${stats.current_streak ?? 0}`, backgroundColor: colors.statPurple, iconColor: colors.accent },
    ],
    [stats],
  );

  const statById = useCallback((id: StatCardData['id']) => statCards.find(s => s.id === id), [statCards]);

  const allPlans = useMemo(() => (Array.isArray(plansQuery.data) ? plansQuery.data : []), [plansQuery.data]);
  const nextPlan = useMemo(() => {
    const pinned = allPlans.find(p => p.pin);
    if (pinned) return pinned;
    const favorite = allPlans.find(p => p.favorite);
    if (favorite) return favorite;
    return allPlans[0] ?? null;
  }, [allPlans]);

  const latestPlans = useMemo(() => allPlans.slice(0, 3), [allPlans]);
  const hasCriticalError = profileQuery.isError || plansQuery.isError;
  const isInitialLoading = (profileQuery.isLoading && !profileQuery.data) || (plansQuery.isLoading && !plansQuery.data) || (statsQuery.isLoading && !statsQuery.data);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.allSettled([
      profileQuery.refetch(),
      plansQuery.refetch(),
      statsQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['training', 'sessions'] }),
    ]);
    setRefreshing(false);
  }, [profileQuery, plansQuery, statsQuery, queryClient]);

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
        Toast.show({ type: 'error', position: 'top', text1: 'İşlem Başarısız', text2: 'Plan bilgisi Güncellenemedi.' });
      }
    },
    [queryClient, updatePlanMutation],
  );

  const onToggleFavorite = useCallback((plan: Plan) => void togglePlanMeta(plan, { favorite: !plan.favorite }), [togglePlanMeta]);
  const onTogglePin = useCallback((plan: Plan) => void togglePlanMeta(plan, { pin: !plan.pin }), [togglePlanMeta]);

  const openHero = useCallback(() => {
    if (nextPlan) {
      handleOpenPlan(nextPlan.id);
      return;
    }
    navigation.navigate('CreatePlan');
  }, [handleOpenPlan, navigation, nextPlan]);

  const streakStat = statById('streak');
  const avgStat = statById('avg-score');
  const sessionsStat = statById('total-sessions');
  const hoursStat = statById('total-hours');

  const editorialFont = Platform.select({ ios: 'Georgia', android: 'serif', default: undefined });

  if (hasCriticalError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={serene.background} />
        <View style={styles.errorContainer}>
          <ErrorView type="generic" title="Ana sayfa Yüklenemedi" description="Veriler şu anda getirilemiyor. Lütfen tekrar deneyin." onRetry={() => void onRefresh()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={serene.background} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={serene.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topNav}>
          <Touchable onPress={() => tabNavigation.navigate('Profile')} borderRadius={sereneLayout.cardRadius} accessibilityRole="button" accessibilityLabel="Profil">
            <View style={styles.navAvatar}>
              <Text style={styles.navAvatarText}>{avatarInitial}</Text>
            </View>
          </Touchable>
          <Text style={styles.brandWordmark}>YogAI</Text>
          <Touchable onPress={() => tabNavigation.navigate('Profile')} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Profil ve ayarlar">
            <MaterialCommunityIcons name="cog-outline" size={24} color={serene.primary} />
          </Touchable>
        </View>

        <View style={styles.greetingBlock}>
          <Text style={[styles.editorialGreeting, editorialFont ? { fontFamily: editorialFont } : null]}>Merhaba, {profileName}</Text>
          <Text style={styles.greetingSub}>{dailyMessage}</Text>
        </View>

        {isInitialLoading ? (
          <View style={styles.bentoBlock}>
            <View style={styles.bentoTopRow}>
              <SkeletonLoader width="62%" height={280} borderRadius={sereneLayout.cardRadius} />
              <View style={styles.skeletonRightCol}>
                <SkeletonLoader width="100%" height={132} borderRadius={sereneLayout.cardRadius} />
                <SkeletonLoader width="100%" height={132} borderRadius={sereneLayout.cardRadius} />
              </View>
            </View>
            <View style={styles.bentoSecondRow}>
              <SkeletonLoader width="48%" height={120} borderRadius={sereneLayout.cardRadius} />
              <SkeletonLoader width="48%" height={120} borderRadius={sereneLayout.cardRadius} />
            </View>
          </View>
        ) : (
          <View style={styles.bentoBlock}>
            <View style={styles.bentoTopRow}>
              <Touchable onPress={openHero} style={styles.heroShell} borderRadius={sereneLayout.cardRadius} accessibilityRole="button" accessibilityLabel={nextPlan ? 'Sıradaki antrenmanı aç' : 'Plan oluştur'}>
                <LinearGradient colors={[serene.primary, '#004d30']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGradient}>
                  <View style={styles.heroBadge}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color={serene.onInverseSurface} />
                    <Text style={styles.heroBadgeText}>Sıradaki Antrenman</Text>
                  </View>
                  {nextPlan ? (
                    <>
                      <Text style={styles.heroTitle} numberOfLines={2}>
                        {nextPlan.title_tr || nextPlan.title_en}
                      </Text>
                      <Text style={styles.heroMeta}>
                        {nextPlan.total_duration_min} dk • {focusAreaLabelMap[nextPlan.focus_area] ?? nextPlan.focus_area}
                      </Text>
                      <View style={[styles.difficultyPill, { backgroundColor: difficultyChipStyle(nextPlan.difficulty).bg }]}>
                        <Text style={[styles.difficultyPillText, { color: difficultyChipStyle(nextPlan.difficulty).fg }]}>
                          {nextPlan.difficulty === 'beginner' ? 'Başlangıç' : nextPlan.difficulty === 'intermediate' ? 'Orta' : 'İleri'}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.heroTitle}>İlk planını oluştur</Text>
                      <Text style={styles.heroMeta}>AI ile kişisel bir akışa başla</Text>
                    </>
                  )}
                  <View style={styles.heroCtaRow}>
                    <Text style={styles.heroCtaText}>{nextPlan ? 'Başlat' : 'Plan oluştur'}</Text>
                    <MaterialCommunityIcons name="play-circle" size={22} color={serene.onPrimary} />
                  </View>
                </LinearGradient>
              </Touchable>
              <View style={styles.rightStatColumn}>
                {streakStat ? (
                  <View style={[styles.smallStatCard, { backgroundColor: streakStat.backgroundColor }]}>
                    <View style={styles.smallStatIconWrap}>
                      <MaterialCommunityIcons name={streakStat.icon as never} size={22} color={streakStat.iconColor} />
                    </View>
                    <Text style={styles.smallStatLabel}>{streakStat.label}</Text>
                    <Text style={styles.smallStatValue}>{streakStat.value}</Text>
                  </View>
                ) : null}
                {avgStat ? (
                  <View style={[styles.smallStatCard, { backgroundColor: avgStat.backgroundColor }]}>
                    <View style={styles.smallStatIconWrap}>
                      <MaterialCommunityIcons name={avgStat.icon as never} size={22} color={avgStat.iconColor} />
                    </View>
                    <Text style={styles.smallStatLabel}>{avgStat.label}</Text>
                    <Text style={styles.smallStatValue}>{avgStat.value}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.bentoSecondRow}>
              {sessionsStat ? (
                <View style={[styles.halfStatCard, { backgroundColor: sessionsStat.backgroundColor }]}>
                  <MaterialCommunityIcons name={sessionsStat.icon as never} size={20} color={sessionsStat.iconColor} />
                  <Text style={styles.halfStatValue}>{sessionsStat.value}</Text>
                  <Text style={styles.halfStatLabel}>{sessionsStat.label}</Text>
                </View>
              ) : null}
              {hoursStat ? (
                <View style={[styles.halfStatCard, { backgroundColor: hoursStat.backgroundColor }]}>
                  <MaterialCommunityIcons name={hoursStat.icon as never} size={20} color={hoursStat.iconColor} />
                  <Text style={styles.halfStatValue}>{hoursStat.value}</Text>
                  <Text style={styles.halfStatLabel}>{hoursStat.label}</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        <View style={styles.sectionSpacer} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Hızlı Başlat</Text>
        </View>
        <View style={styles.quickGrid}>
          {quickStartPresets.map(item => (
            <Touchable
              key={item.id}
              onPress={() => navigation.navigate('CreatePlan', { presetLevel: item.level, presetDuration: item.duration })}
              style={[styles.quickTile, { width: quickTileWidth }]}
              borderRadius={sereneLayout.cardRadius}
              accessibilityRole="button"
              accessibilityLabel={`${item.title} hızlı antrenmanı başlat`}
            >
              <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.quickTileGradient}>
                <MaterialCommunityIcons name={item.icon as never} size={24} color={item.iconColor} />
                <View style={styles.quickTextWrap}>
                  <Text style={[styles.quickTitle, { color: item.titleColor }]}>{item.title}</Text>
                  <Text style={[styles.quickSubtitle, { color: item.subtitleColor }]} numberOfLines={2}>
                    {item.subtitle}
                  </Text>
                </View>
                <View style={styles.quickActionRow}>
                  <Text style={[styles.quickAction, { color: item.actionColor }]}>Başlat</Text>
                  <MaterialCommunityIcons name="arrow-right" size={14} color={item.actionColor} />
                </View>
              </LinearGradient>
            </Touchable>
          ))}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Planlarım</Text>
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
          <EmptyState icon="calendar-plus" title="Henüz planınız yok" description="AI ile ilk yoga planınızı oluşturmaya başlayın." />
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: serene.background },
  container: { flex: 1, backgroundColor: serene.background },
  content: { paddingHorizontal: sereneLayout.containerPadding, paddingBottom: TAB_SCENE_BOTTOM_PADDING + spacing.xxxl },
  errorContainer: { flex: 1, paddingHorizontal: sereneLayout.containerPadding, justifyContent: 'center' },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  navAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: serene.tertiaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: serene.outlineVariant,
  },
  navAvatarText: { ...typography.bodyMedium, color: serene.onTertiaryFixedVariant },
  brandWordmark: {
    ...typography.h3,
    color: serene.primary,
    letterSpacing: -0.3,
  },
  greetingBlock: { marginBottom: sereneLayout.sectionMargin - 8 },
  editorialGreeting: { fontSize: 32, fontWeight: '500', lineHeight: 38, color: serene.onSurface, letterSpacing: -0.6 },
  greetingSub: { ...typography.body, color: serene.onSurfaceVariant, marginTop: spacing.sm },
  bentoBlock: { gap: sereneLayout.bentoGap },
  bentoTopRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'stretch', gap: sereneLayout.bentoGap },
  heroShell: {
    flexGrow: 1,
    flexBasis: '59%',
    minWidth: 200,
    minHeight: 280,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: serene.shadowTint,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 6,
  },
  heroGradient: { flex: 1, paddingTop: 24, paddingLeft: 24, paddingRight: 20, paddingBottom: 24, justifyContent: 'flex-end', gap: spacing.sm },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: sereneLayout.pillRadius,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: spacing.xs,
  },
  heroBadgeText: { ...typography.captionMedium, color: serene.onInverseSurface, letterSpacing: 1.2, textTransform: 'uppercase', fontSize: 10 },
  heroTitle: { ...typography.h2, color: serene.onPrimary, marginTop: spacing.xs },
  heroMeta: { ...typography.bodySm, color: 'rgba(255,255,255,0.85)' },
  difficultyPill: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: sereneLayout.pillRadius, marginTop: spacing.xs },
  difficultyPillText: { ...typography.captionMedium },
  heroCtaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  heroCtaText: { ...typography.buttonMd, color: serene.onPrimary },
  rightStatColumn: { flexGrow: 1, flexBasis: '34%', minWidth: 112, gap: sereneLayout.bentoGap, justifyContent: 'space-between' },
  smallStatCard: {
    flex: 1,
    borderRadius: sereneLayout.cardRadius,
    paddingTop: 20,
    paddingLeft: 20,
    paddingRight: 16,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: serene.outlineVariant,
    justifyContent: 'space-between',
    minHeight: 132,
    shadowColor: serene.shadowTint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.9,
    shadowRadius: 20,
    elevation: 3,
  },
  smallStatIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  smallStatLabel: { ...typography.caption, color: serene.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 1 },
  smallStatValue: { fontSize: 28, fontWeight: '600', color: serene.onSurface, marginTop: spacing.xs },
  bentoSecondRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: sereneLayout.bentoGap },
  halfStatCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 148,
    minHeight: 120,
    borderRadius: sereneLayout.cardRadius,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: serene.outlineVariant,
    justifyContent: 'space-between',
    shadowColor: serene.shadowTint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.85,
    shadowRadius: 16,
    elevation: 2,
  },
  halfStatValue: { ...typography.h2, color: serene.onSurface, marginTop: spacing.sm },
  halfStatLabel: { ...typography.caption, color: serene.onSurfaceVariant },
  sectionSpacer: { height: sereneLayout.sectionMargin },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { ...typography.h4, color: serene.onSurface },
  viewAllText: { ...typography.bodySmMedium, color: serene.primary },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: sereneLayout.bentoGap },
  quickTile: { minHeight: 168, borderRadius: sereneLayout.cardRadius, overflow: 'hidden', borderWidth: 1, borderColor: serene.outlineVariant },
  quickTileGradient: { flex: 1, padding: spacing.md, justifyContent: 'space-between' },
  quickTextWrap: { gap: 4, flexShrink: 1 },
  quickTitle: { ...typography.bodyMedium },
  quickSubtitle: { ...typography.caption, lineHeight: 18 },
  quickActionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  quickAction: { ...typography.captionMedium },
  planSkeletonColumn: { gap: spacing.sm },
  planList: { gap: spacing.sm },
  skeletonRightCol: { flex: 1, minWidth: 120, gap: sereneLayout.bentoGap },
});

export default HomeScreen;
