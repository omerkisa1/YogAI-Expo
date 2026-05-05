import React, { useMemo, useState } from 'react';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/features/auth/hooks/useAuth';
import ProfileSetupWizard from '@/features/profile/components/ProfileSetupWizard';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { useTrainingStats } from '@/features/training/hooks/useTraining';
import AppModal from '@/shared/components/AppModal';
import Card from '@/shared/components/Card';
import ErrorView from '@/shared/components/ErrorView';
import LoadingView from '@/shared/components/LoadingView';
import ProgressBar from '@/shared/components/ProgressBar';
import Touchable from '@/shared/components/Touchable';
import type { Goal } from '@/shared/types/profile';
import type { Injury, Level } from '@/shared/types/plan';
import type { RootStackParamList } from '@/navigation/types';
import { TAB_SCENE_BOTTOM_PADDING } from '@/navigation/tabBarMetrics';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const levelLabelMap: Record<Level, string> = { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' };
const goalLabelMap: Record<Goal, string> = { flexibility: 'Esneklik', stress_relief: 'Stres Azaltma', strength: 'Güç', balance: 'Denge', mobility: 'Kilo', posture: 'Meditasyon' };
const injuryLabelMap: Record<Injury, string> = { knee_injury: 'Diz', ankle_injury: 'Ayak Bileği', herniated_disc: 'Bel Fıtığı', low_back_pain: 'Bel', shoulder_injury: 'Omuz', wrist_injury: 'Bilek', neck_injury: 'Boyun', groin_injury: 'Kasık', hip_injury: 'Kalça' };
const languageLabelMap: Record<'tr' | 'en', string> = { tr: 'Türkçe', en: 'English' };

const ProfileScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const profileQuery = useProfile();
  const statsQuery = useTrainingStats();
  const { signOut, user } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const displayName = profileQuery.data?.display_name || user?.displayName || 'YogAI Kullanıcı';
  const email = user?.email || 'email bulunamadı';
  const avatarInitial = displayName.charAt(0).toUpperCase() || 'Y';

  const goals = useMemo(() => (profileQuery.data?.goals ?? []).map(g => goalLabelMap[g]).filter(Boolean), [profileQuery.data?.goals]);
  const injuriesList = useMemo(() => (profileQuery.data?.injuries ?? []).map(i => injuryLabelMap[i]).filter(Boolean), [profileQuery.data?.injuries]);

  const onSignOut = async () => {
    try { await signOut(); } catch { Toast.show({ type: 'error', position: 'top', text1: 'Çıkış Başarısız', text2: 'Lütfen tekrar deneyin.' }); }
  };

  if (profileQuery.isLoading) return (<SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={colors.background} /><LoadingView message="Profil Yükleniyor..." fullScreen /></SafeAreaView>);

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorWrap}><ErrorView type="generic" title="Profil Yüklenemedi" description="Profil bilgileri şu anda getirilemiyor." onRetry={() => { void profileQuery.refetch(); }} /></View>
      </SafeAreaView>
    );
  }

  const profile = profileQuery.data;
  const levelLabel = profile.level ? levelLabelMap[profile.level] ?? profile.level : '-';
  const ageLabel = profile.age ? `${profile.age}` : '-';
  const languageLabel = profile.preferred_language ? languageLabelMap[profile.preferred_language] ?? profile.preferred_language : '-';
  const goalsLabel = goals.length > 0 ? goals.join(', ') : '-';
  const injuriesLabel = injuriesList.length > 0 ? injuriesList.join(', ') : '-';

  const completionChecks = [Boolean(displayName?.trim()), Boolean(email && email !== 'email bulunamadı'), levelLabel !== '-', ageLabel !== '-', languageLabel !== '-', goalsLabel !== '-' || injuriesLabel !== '-'];
  const completedCount = completionChecks.filter(Boolean).length;
  const completionPercent = Math.round((completedCount / completionChecks.length) * 100);
  const shouldShowWizard = completedCount < completionChecks.length;

  const stats = statsQuery.data;
  const sessionCount = stats?.total_sessions ?? 0;
  const streak = stats?.current_streak ?? 0;
  const avgPct = Math.round(stats?.average_accuracy ?? 0);

  const menuItems = [
    { key: 'edit-profile', label: 'Profili Düzenle', icon: 'account-edit-outline', backgroundColor: colors.primary, onPress: () => navigation.navigate('EditProfile') },
    { key: 'notifications', label: 'Bildirim Ayarları', icon: 'bell-outline', backgroundColor: colors.info, onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }) },
    { key: 'about', label: 'Hakkında', icon: 'information-outline', backgroundColor: colors.textMuted, onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }) },
    { key: 'privacy', label: 'Gizlilik Politikası', icon: 'shield-check-outline', backgroundColor: colors.textMuted, onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }) },
  ] as const;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[colors.gradientPrimary[0], colors.gradientPrimary[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Touchable onPress={() => setShowSignOutModal(true)} borderRadius={radius.full} style={styles.logoutPill} accessibilityRole="button" accessibilityLabel="Çıkış yap">
              <MaterialCommunityIcons name="logout" size={18} color={colors.error} />
              <Text style={styles.logoutPillText}>Çıkış</Text>
            </Touchable>
          </View>

          <View style={styles.heroIdentity}>
            <View style={styles.avatarRing}>
              <LinearGradient colors={[colors.gradientPrimary[0], colors.gradientPrimary[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarInitial}</Text>
              </LinearGradient>
            </View>
            <Text style={styles.heroName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.heroEmail} numberOfLines={1}>{email}</Text>
          </View>

          {statsQuery.data ? (
            <View style={styles.statsStrip}>
              <View style={styles.statBubble}>
                <Text style={styles.statBubbleValue}>{sessionCount}</Text>
                <Text style={styles.statBubbleLabel}>antrenman</Text>
              </View>
              <View style={styles.statBubble}>
                <Text style={styles.statBubbleValue}>{streak}</Text>
                <Text style={styles.statBubbleLabel}>seri gün</Text>
              </View>
              <View style={styles.statBubble}>
                <Text style={styles.statBubbleValue}>%{avgPct}</Text>
                <Text style={styles.statBubbleLabel}>ort. skor</Text>
              </View>
            </View>
          ) : null}
        </LinearGradient>

        <View style={styles.sheet}>
          <Text style={styles.sheetEyebrow}>Profil özeti</Text>

          {shouldShowWizard ? (
            <ProfileSetupWizard profile={profile} />
          ) : (
            <Card variant="elevated" style={styles.infoCard}>
              <View style={styles.infoLine}><Text style={styles.infoKey}>Seviye</Text><View style={styles.levelChip}><Text style={styles.levelChipText}>{levelLabel}</Text></View></View>
              <View style={styles.infoLine}><Text style={styles.infoKey}>Yaş</Text><Text style={styles.infoValue}>{ageLabel}</Text></View>
              <View style={styles.infoLine}><Text style={styles.infoKey}>Dil</Text><Text style={styles.infoValue}>{languageLabel}</Text></View>
              <View style={styles.infoLineTop}><Text style={styles.infoKey}>Hedefler</Text><Text style={styles.infoValue}>{goalsLabel}</Text></View>
              <View style={styles.infoLineTop}>
                <Text style={styles.infoKey}>Sakatlıklar</Text>
                {injuriesLabel === '-' ? <Text style={styles.infoValueMuted}>-</Text> : <View style={styles.warningChip}><Text style={styles.warningChipText}>{injuriesLabel}</Text></View>}
              </View>
              <View style={styles.completionBlock}>
                <View style={styles.completionHeaderRow}>
                  <Text style={styles.completionTitle}>Profil tamamlanma</Text>
                  <View style={styles.completionBadge}>
                    <Text style={styles.completionBadgeText}>{completedCount}/{completionChecks.length}</Text>
                    <MaterialCommunityIcons name="check" size={12} color={colors.success} />
                  </View>
                </View>
                <ProgressBar progress={completionPercent} color={colors.primary} height={4} />
              </View>
              <Touchable onPress={() => navigation.navigate('EditProfile')} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Profili düzenle">
                <Text style={styles.editLink}>Profili düzenle</Text>
              </Touchable>
            </Card>
          )}

          <Text style={styles.sectionHeading}>Hesap</Text>
          <Card variant="default" style={styles.actionsCard}>
            {menuItems.map((item, index) => (
              <Touchable key={item.key} onPress={item.onPress} style={[styles.actionItem, index < menuItems.length - 1 ? styles.actionItemDivider : null]} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel={item.label}>
                <View style={styles.actionLeft}>
                  <View style={[styles.actionIconWrap, { backgroundColor: item.backgroundColor }]}><MaterialCommunityIcons name={item.icon as never} size={16} color={colors.textOnPrimary} /></View>
                  <Text style={styles.actionText}>{item.label}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </Touchable>
            ))}
          </Card>

          <Text style={styles.version}>YogAI v1.0.0</Text>
        </View>
      </ScrollView>

      <AppModal visible={showSignOutModal} onClose={() => setShowSignOutModal(false)} title="Çıkış yapmak istediğinize emin misiniz?" icon="logout" iconColor={colors.error} actions={[{ label: 'İptal', variant: 'ghost', onPress: () => setShowSignOutModal(false) }, { label: 'Çıkış Yap', variant: 'danger', onPress: () => { setShowSignOutModal(false); void onSignOut(); } }]} autoDismissMs={10000} dismissOnBackdrop />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: TAB_SCENE_BOTTOM_PADDING + spacing.xxl },
  errorWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.base },
  hero: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Platform.select({
      ios: { shadowColor: '#0d3d28', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 24 },
      android: { elevation: 8 },
    }),
  },
  heroTopRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.base, marginBottom: spacing.sm },
  logoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.base,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  logoutPillText: { ...typography.captionMedium, color: colors.error },
  heroIdentity: { alignItems: 'center', paddingHorizontal: spacing.xl },
  avatarRing: {
    padding: 3,
    borderRadius: 56,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: spacing.sm,
  },
  avatar: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.h1, color: colors.textOnPrimary },
  heroName: { ...typography.h3, color: colors.textOnPrimary, maxWidth: '92%', textAlign: 'center' },
  heroEmail: { ...typography.bodySm, color: 'rgba(255,255,255,0.88)', marginTop: spacing.xs, textAlign: 'center' },
  statsStrip: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.base },
  statBubble: {
    minWidth: 76,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  statBubbleValue: { ...typography.h4, color: colors.textOnPrimary, fontWeight: '700' },
  statBubbleLabel: { ...typography.caption, color: 'rgba(255,255,255,0.82)', marginTop: 2 },
  sheet: {
    marginTop: -spacing.xl,
    paddingHorizontal: spacing.base,
    gap: spacing.base,
  },
  sheetEyebrow: { ...typography.captionMedium, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: -spacing.xs },
  sectionHeading: { ...typography.bodySmMedium, color: colors.textSecondary, marginTop: spacing.xs },
  infoCard: { gap: spacing.sm },
  infoLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoLineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  infoKey: { ...typography.bodySmMedium, color: colors.textSecondary, flex: 1 },
  infoValue: { ...typography.bodySm, color: colors.text, flex: 1.6, textAlign: 'right' },
  infoValueMuted: { ...typography.bodySm, color: colors.textMuted, flex: 1.6, textAlign: 'right' },
  levelChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  levelChipText: { ...typography.captionMedium, color: colors.primaryDark },
  warningChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.secondarySoft },
  warningChipText: { ...typography.captionMedium, color: colors.warning },
  completionBlock: { gap: spacing.xs, marginTop: spacing.xs },
  completionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completionTitle: { ...typography.bodySmMedium, color: colors.text },
  completionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  completionBadgeText: { ...typography.captionMedium, color: colors.textSecondary },
  editLink: { ...typography.bodySmMedium, color: colors.primary, marginTop: spacing.xs, textAlign: 'right' },
  actionsCard: { paddingVertical: spacing.xs },
  actionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  actionItemDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actionIconWrap: { width: 32, height: 32, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  actionText: { ...typography.body, color: colors.text },
  version: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});

export default ProfileScreen;
