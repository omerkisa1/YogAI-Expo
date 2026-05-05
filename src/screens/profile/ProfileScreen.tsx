import React, { useMemo, useState } from 'react';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/features/auth/hooks/useAuth';
import ProfileSetupWizard from '@/features/profile/components/ProfileSetupWizard';
import { useProfile, useUpdateProfile } from '@/features/profile/hooks/useProfile';
import { useTrainingStats } from '@/features/training/hooks/useTraining';
import AppModal from '@/shared/components/AppModal';
import BottomSheet from '@/shared/components/BottomSheet';
import Card from '@/shared/components/Card';
import ErrorView from '@/shared/components/ErrorView';
import LoadingView from '@/shared/components/LoadingView';
import ProgressBar from '@/shared/components/ProgressBar';
import Touchable from '@/shared/components/Touchable';
import type { AppLanguage } from '@/shared/types/plan';
import type { RootStackParamList } from '@/navigation/types';
import { TAB_SCENE_BOTTOM_PADDING } from '@/navigation/tabBarMetrics';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';
import { typography } from '@/theme/typography';

/** Marka yeşili (gradientPrimary ile aynı hat); son durak biraz daha koyu */
const PROFILE_HERO_GRADIENT = [colors.gradientPrimary[0], colors.gradientPrimary[1], '#123d29'] as const;

const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const languageLabel: Record<AppLanguage, string> = { tr: 'Türkçe', en: 'English' };

type AccountRow =
  | { key: string; kind: 'link'; label: string; icon: string; onPress: () => void }
  | { key: string; kind: 'language'; label: string; icon: string };

function profileCompletionMeta(profile: { age: number; goals?: unknown[] }, displayName: string, email: string) {
  const checks = [
    Boolean(displayName?.trim()),
    Boolean(email && email !== 'email bulunamadı'),
    profile.age > 0,
    Array.isArray(profile.goals) && profile.goals.length > 0,
  ];
  const completedCount = checks.filter(Boolean).length;
  const total = checks.length;
  return {
    completedCount,
    total,
    percent: Math.round((completedCount / total) * 100),
    isComplete: completedCount === total,
  };
}

const ProfileScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const profileQuery = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const statsQuery = useTrainingStats();
  const { signOut, user } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);

  const displayName = profileQuery.data?.display_name || user?.displayName || 'YogAI Kullanıcı';
  const email = user?.email || 'email bulunamadı';
  const avatarInitial = displayName.charAt(0).toUpperCase() || 'Y';

  const onSignOut = async () => {
    try {
      await signOut();
    } catch {
      Toast.show({ type: 'error', position: 'top', text1: 'Çıkış Başarısız', text2: 'Lütfen tekrar deneyin.' });
    }
  };

  const stats = statsQuery.data;
  const sessionCount = stats?.total_sessions ?? 0;
  const streak = stats?.current_streak ?? 0;
  const avgPct = Math.round(stats?.average_accuracy ?? 0);

  const accountRows = useMemo(
    (): AccountRow[] => [
      { kind: 'link', key: 'edit-profile', label: 'Profili Düzenle', icon: 'pencil-outline', onPress: () => navigation.navigate('EditProfile') },
      { kind: 'link', key: 'notifications', label: 'Bildirimler', icon: 'bell-outline', onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }) },
      { kind: 'link', key: 'privacy', label: 'Gizlilik ve Güvenlik', icon: 'shield-outline', onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }) },
      { kind: 'language', key: 'app-language', label: 'Uygulama dili', icon: 'translate' },
    ],
    [navigation],
  );

  if (profileQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <LoadingView message="Profil yükleniyor..." fullScreen />
      </SafeAreaView>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorWrap}>
          <ErrorView type="generic" title="Profil yüklenemedi" description="Profil bilgileri şu anda getirilemiyor." onRetry={() => { void profileQuery.refetch(); }} />
        </View>
      </SafeAreaView>
    );
  }

  const profile = profileQuery.data;
  const { completedCount, total: completionTotal, percent: completionPercent, isComplete: isProfileComplete } = profileCompletionMeta(profile, displayName, email);

  const currentLang = profile.preferred_language ?? 'tr';

  const pickLanguage = async (lang: AppLanguage) => {
    if (lang === currentLang) {
      setLanguageSheetVisible(false);
      return;
    }
    try {
      await updateProfileMutation.mutateAsync({ preferred_language: lang });
      setLanguageSheetVisible(false);
      Toast.show({ type: 'success', position: 'top', text1: 'Dil güncellendi', text2: languageLabel[lang] });
    } catch {
      Toast.show({ type: 'error', position: 'top', text1: 'Kaydedilemedi', text2: 'Lütfen tekrar dene.' });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Touchable onPress={() => navigation.navigate('EditProfile')} borderRadius={radius.full} style={styles.topBarIconBtn} accessibilityRole="button" accessibilityLabel="Profili düzenle">
            <MaterialCommunityIcons name="account-circle-outline" size={28} color={colors.primaryDark} />
          </Touchable>
          <Text style={styles.navWordmark}>YogAI</Text>
          <Touchable onPress={() => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' })} borderRadius={radius.full} style={styles.topBarIconBtn} accessibilityRole="button" accessibilityLabel="Ayarlar">
            <MaterialCommunityIcons name="cog-outline" size={26} color={colors.textSecondary} />
          </Touchable>
        </View>

        <LinearGradient colors={[...PROFILE_HERO_GRADIENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarLetter}>{avatarInitial}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.heroName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.heroEmail} numberOfLines={1}>
            {email}
          </Text>

          <View style={styles.statsStrip}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{sessionCount}</Text>
              <Text style={styles.statLabel}>ANTRENMAN</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{streak}</Text>
              <Text style={styles.statLabel}>SERİ</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{avgPct}%</Text>
              <Text style={styles.statLabel}>ORT. SKOR</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.sheet}>
          {!isProfileComplete ? (
            <View style={styles.incompleteBlock}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Profil özeti</Text>
                <Text style={styles.completionBadge}>{completedCount}/{completionTotal}</Text>
              </View>
              <ProgressBar progress={completionPercent} color={colors.primaryDark} height={4} />
              <ProfileSetupWizard profile={profile} />
            </View>
          ) : null}

          <Text style={styles.sectionHeading}>Hesap ayarları</Text>
          <Card variant="default" style={styles.actionsCard}>
            {accountRows.map((item, index) => (
              <Touchable
                key={item.key}
                onPress={() => {
                  if (item.kind === 'language') setLanguageSheetVisible(true);
                  else item.onPress();
                }}
                style={[styles.actionItem, index < accountRows.length - 1 ? styles.actionItemDivider : null]}
                borderRadius={radius.md}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={styles.actionLeft}>
                  <MaterialCommunityIcons name={item.icon as never} size={22} color={colors.primaryDark} />
                  <Text style={styles.actionText}>{item.label}</Text>
                </View>
                {item.kind === 'language' ? (
                  <View style={styles.actionRight}>
                    <Text style={styles.actionTrailing}>{languageLabel[currentLang]}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
                  </View>
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
                )}
              </Touchable>
            ))}
          </Card>

          <Touchable onPress={() => setShowSignOutModal(true)} style={styles.logoutRow} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Çıkış yap">
            <MaterialCommunityIcons name="logout-variant" size={22} color={colors.error} />
            <Text style={styles.logoutText}>Çıkış yap</Text>
          </Touchable>

          <Text style={styles.version}>YogAI v1.0.0</Text>
        </View>
      </ScrollView>

      <BottomSheet visible={languageSheetVisible} onClose={() => setLanguageSheetVisible(false)} title="Uygulama dili">
        <Touchable
          onPress={() => { void pickLanguage('tr'); }}
          disabled={updateProfileMutation.isPending}
          style={[styles.langSheetRow, currentLang === 'tr' && styles.langSheetRowActive]}
          borderRadius={radius.md}
          accessibilityRole="button"
          accessibilityLabel="Türkçe"
        >
          <Text style={[styles.langSheetLabel, currentLang === 'tr' && styles.langSheetLabelActive]}>Türkçe</Text>
          {currentLang === 'tr' ? <MaterialCommunityIcons name="check" size={22} color={colors.primaryDark} /> : null}
        </Touchable>
        <Touchable
          onPress={() => { void pickLanguage('en'); }}
          disabled={updateProfileMutation.isPending}
          style={[styles.langSheetRow, currentLang === 'en' && styles.langSheetRowActive]}
          borderRadius={radius.md}
          accessibilityRole="button"
          accessibilityLabel="English"
        >
          <Text style={[styles.langSheetLabel, currentLang === 'en' && styles.langSheetLabelActive]}>English</Text>
          {currentLang === 'en' ? <MaterialCommunityIcons name="check" size={22} color={colors.primaryDark} /> : null}
        </Touchable>
      </BottomSheet>

      <AppModal
        visible={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        title="Çıkış yapmak istediğine emin misin?"
        icon="logout"
        iconColor={colors.error}
        actions={[
          { label: 'İptal', variant: 'ghost', onPress: () => setShowSignOutModal(false) },
          { label: 'Çıkış Yap', variant: 'danger', onPress: () => { setShowSignOutModal(false); void onSignOut(); } },
        ]}
        autoDismissMs={10000}
        dismissOnBackdrop
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: TAB_SCENE_BOTTOM_PADDING + spacing.xxl },
  errorWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.base },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
  },
  topBarIconBtn: { padding: spacing.xs, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  navWordmark: {
    fontFamily: serif,
    fontSize: 22,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: 0.5,
  },
  heroCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.xs,
    borderRadius: 28,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
    ...Platform.select({
      ios: { shadowColor: '#0d281c', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 6 },
    }),
  },
  avatarWrap: { marginBottom: spacing.md },
  avatarOuter: {
    padding: 4,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    ...shadows.md,
  },
  avatarInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F4F7F4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  avatarLetter: {
    fontSize: 40,
    fontWeight: '600',
    color: colors.primaryDark,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
  },
  heroName: {
    fontFamily: serif,
    fontSize: 22,
    fontWeight: '600',
    color: colors.textOnPrimary,
    textAlign: 'center',
    maxWidth: '100%',
    textShadowColor: 'rgba(0,0,0,0.12)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroEmail: {
    ...typography.bodySm,
    color: 'rgba(255,255,255,0.92)',
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: '100%',
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: spacing.lg,
    width: '100%',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
    overflow: 'hidden',
    paddingVertical: spacing.md,
  },
  statCell: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.45)', marginVertical: spacing.xs },
  statValue: { ...typography.h4, color: colors.textOnPrimary, fontWeight: '700' },
  statLabel: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.88)',
  },
  sheet: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    gap: spacing.base,
  },
  incompleteBlock: { gap: spacing.sm },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryTitle: {
    ...typography.h4,
    fontFamily: serif,
    color: colors.text,
  },
  completionBadge: { ...typography.bodySmMedium, color: colors.primaryDark },
  sectionHeading: {
    ...typography.bodyMedium,
    fontFamily: serif,
    color: colors.text,
    marginTop: spacing.xs,
  },
  actionsCard: { paddingVertical: spacing.xs },
  actionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.sm },
  actionItemDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionTrailing: { ...typography.bodySm, color: colors.textSecondary },
  actionText: { ...typography.body, color: colors.text },
  langSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  langSheetRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  langSheetLabel: { ...typography.body, color: colors.text },
  langSheetLabelActive: { ...typography.bodyMedium, color: colors.primaryDark },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  logoutText: { ...typography.bodyMedium, color: colors.error },
  version: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});

export default ProfileScreen;
