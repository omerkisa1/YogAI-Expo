import React, { useMemo, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/features/auth/hooks/useAuth';
import ProfileSetupWizard from '@/features/profile/components/ProfileSetupWizard';
import { useProfile, useUpdateProfile } from '@/features/profile/hooks/useProfile';
import BottomSheet from '@/shared/components/BottomSheet';
import Card from '@/shared/components/Card';
import ErrorView from '@/shared/components/ErrorView';
import LoadingView from '@/shared/components/LoadingView';
import ProgressBar from '@/shared/components/ProgressBar';
import Touchable from '@/shared/components/Touchable';
import type { AppLanguage, Injury, Level } from '@/shared/types/plan';
import type { Goal, Profile } from '@/shared/types/profile';
import type { RootStackParamList } from '@/navigation/types';
import { TAB_SCENE_BOTTOM_PADDING } from '@/navigation/tabBarMetrics';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { cardShadow } from '@/theme/shadows';
import { typography } from '@/theme/typography';

const languageLabel: Record<AppLanguage, string> = { tr: 'Türkçe', en: 'English' };

const levelLabel: Record<Level, string> = { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' };

const goalLabel: Record<Goal, string> = {
  flexibility: 'Esneklik',
  stress_relief: 'Rahatlama',
  strength: 'Güç',
  balance: 'Denge',
  mobility: 'Hareketlilik',
  posture: 'Duruş',
};

const injuryLabel: Record<Injury, string> = {
  knee_injury: 'Diz',
  ankle_injury: 'Ayak bileği',
  herniated_disc: 'Bel fıtığı',
  low_back_pain: 'Bel',
  shoulder_injury: 'Omuz',
  wrist_injury: 'Bilek',
  neck_injury: 'Boyun',
  groin_injury: 'Kasık',
  hip_injury: 'Kalça',
};

type MenuRow =
  | { key: string; kind: 'link'; label: string; icon: string; iconBg: string; iconColor: string; onPress: () => void }
  | { key: string; kind: 'language'; label: string; icon: string; iconBg: string; iconColor: string };

function profileCompletion(profile: Profile, displayName: string, email: string) {
  const checks = [
    Boolean(displayName?.trim()),
    Boolean(email && email !== '—' && email.includes('@')),
    profile.age > 0,
    Array.isArray(profile.goals) && profile.goals.length > 0,
  ];
  const completed = checks.filter(Boolean).length;
  const total = checks.length;
  return { completed, total, percent: Math.round((completed / total) * 100), isComplete: completed === total };
}

const ProfileScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const profileQuery = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const { signOut, user } = useAuth();
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);

  const displayName = profileQuery.data?.display_name || user?.displayName || 'YogAI Kullanıcı';
  const email = user?.email || '—';
  const avatarInitial = displayName.charAt(0).toUpperCase() || 'Y';

  const onSignOutPress = () => {
    Alert.alert('Çıkış yap', 'Oturumunuzu kapatmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkış Yap',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await signOut();
            } catch {
              Toast.show({ type: 'error', position: 'top', text1: 'Çıkış başarısız', text2: 'Lütfen tekrar deneyin.' });
            }
          })();
        },
      },
    ]);
  };

  const menuRows = useMemo(
    (): MenuRow[] => [
      {
        kind: 'link',
        key: 'edit-profile',
        label: 'Profili Düzenle',
        icon: 'account-edit',
        iconBg: colors.primary,
        iconColor: colors.textOnPrimary,
        onPress: () => navigation.navigate('EditProfile'),
      },
      {
        kind: 'link',
        key: 'notifications',
        label: 'Bildirim Ayarları',
        icon: 'bell-outline',
        iconBg: colors.info,
        iconColor: colors.textOnPrimary,
        onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }),
      },
      {
        kind: 'link',
        key: 'about',
        label: 'Hakkında',
        icon: 'information-outline',
        iconBg: colors.surfaceElevated,
        iconColor: colors.textMuted,
        onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }),
      },
      {
        kind: 'link',
        key: 'privacy',
        label: 'Gizlilik Politikası',
        icon: 'shield-check-outline',
        iconBg: colors.surfaceElevated,
        iconColor: colors.textMuted,
        onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }),
      },
      {
        kind: 'language',
        key: 'app-language',
        label: 'Uygulama dili',
        icon: 'translate',
        iconBg: colors.accentSoft,
        iconColor: colors.accent,
      },
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
  const { completed, total, percent, isComplete } = profileCompletion(profile, displayName, email);
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
      Toast.show({ type: 'error', position: 'top', text1: 'Kaydedilemedi', text2: 'Lütfen tekrar deneyin.' });
    }
  };

  const goalsText = profile.goals?.length ? profile.goals.map(g => goalLabel[g] ?? g).join(', ') : null;
  const injuriesText = profile.injuries?.length ? profile.injuries.map(i => injuryLabel[i] ?? i).join(', ') : null;
  const ageText = profile.age > 0 ? String(profile.age) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[...colors.gradientPrimary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <LinearGradient
            colors={[colors.primaryLight, colors.primaryDark]}
            style={styles.avatarOuter}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.avatarLetter}>{avatarInitial}</Text>
          </LinearGradient>
          <Text style={styles.heroName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.heroEmail} numberOfLines={1}>
            {email}
          </Text>
        </LinearGradient>

        <View style={styles.sheet}>
          <Card variant="default" style={styles.infoCard}>
            {!isComplete ? (
              <View style={styles.completionHeader}>
                <Text style={styles.completionTitle}>Profilinizi Tamamlayın</Text>
                <Text style={styles.completionCount}>
                  {completed}/{total} ✓
                </Text>
              </View>
            ) : null}
            {!isComplete ? <ProgressBar progress={percent} color={colors.primary} height={4} /> : null}
            {!isComplete ? <View style={styles.completionSpacer} /> : null}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Seviye</Text>
              <View style={styles.levelChip}>
                <Text style={styles.levelChipText}>{levelLabel[profile.level ?? 'beginner']}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Yaş</Text>
              <Text style={ageText ? styles.infoValue : styles.infoDash}>{ageText ?? '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Dil</Text>
              <Text style={styles.infoValue}>{languageLabel[currentLang]}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Hedefler</Text>
              <Text style={goalsText ? styles.infoValue : styles.infoDash}>{goalsText ?? '—'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Sakatlıklar</Text>
              {injuriesText ? (
                <View style={styles.injuryChip}>
                  <Text style={styles.injuryChipText}>{injuriesText}</Text>
                </View>
              ) : (
                <Text style={styles.infoDash}>—</Text>
              )}
            </View>

            <Touchable onPress={() => navigation.navigate('EditProfile')} borderRadius={radius.md} style={styles.editLinkRow} accessibilityRole="button" accessibilityLabel="Profili düzenle">
              <Text style={styles.editLink}>Profili Düzenle</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
            </Touchable>
          </Card>

          {!isComplete ? (
            <View style={styles.wizardWrap}>
              <ProfileSetupWizard profile={profile} />
            </View>
          ) : null}

          <Text style={styles.menuSectionLabel}>Menü</Text>
          <Card variant="default" style={styles.menuCard}>
            {menuRows.map((item, index) => (
              <Touchable
                key={item.key}
                onPress={() => {
                  if (item.kind === 'language') setLanguageSheetVisible(true);
                  else item.onPress();
                }}
                style={[styles.menuRow, index < menuRows.length - 1 ? styles.menuRowBorder : null]}
                borderRadius={radius.md}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: item.iconBg }]}>
                  <MaterialCommunityIcons name={item.icon as never} size={18} color={item.iconColor} />
                </View>
                <Text style={styles.menuLabel}>{item.label}</Text>
                {item.kind === 'language' ? (
                  <View style={styles.menuRight}>
                    <Text style={styles.menuTrailing}>{languageLabel[currentLang]}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
                  </View>
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
                )}
              </Touchable>
            ))}
          </Card>

          <Touchable onPress={onSignOutPress} borderRadius={radius.sm} style={styles.signOutWrap} accessibilityRole="button" accessibilityLabel="Çıkış yap">
            <Text style={styles.signOutText}>Çıkış Yap</Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  scrollContent: { paddingBottom: TAB_SCENE_BOTTOM_PADDING + spacing.xxl },
  errorWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.base },
  hero: {
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...cardShadow,
  },
  avatarOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarLetter: { ...typography.h1, color: colors.textOnPrimary, fontWeight: '700' },
  heroName: { ...typography.h3, color: colors.textOnPrimary, textAlign: 'center' },
  heroEmail: { ...typography.bodySm, color: 'rgba(255,255,255,0.85)', marginTop: spacing.xs, textAlign: 'center' },
  sheet: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, gap: spacing.lg },
  infoCard: { padding: spacing.base, gap: spacing.sm },
  completionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  completionTitle: { ...typography.bodyMedium, color: colors.text },
  completionCount: { ...typography.bodySmMedium, color: colors.textMuted },
  completionSpacer: { height: spacing.sm },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs },
  infoLabel: { ...typography.bodySm, color: colors.textSecondary, flexShrink: 0, width: 100 },
  infoValue: { ...typography.bodySm, color: colors.text, flex: 1, textAlign: 'right' },
  infoDash: { ...typography.bodySm, color: colors.textMuted, flex: 1, textAlign: 'right' },
  levelChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
  },
  levelChipText: { ...typography.captionMedium, color: colors.primary },
  injuryChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    maxWidth: '65%',
  },
  injuryChipText: { ...typography.caption, color: colors.warningDark },
  editLinkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm, paddingVertical: spacing.sm },
  editLink: { ...typography.bodySmMedium, color: colors.primary },
  wizardWrap: {},
  menuSectionLabel: { ...typography.captionMedium, color: colors.textMuted, marginTop: spacing.xs },
  menuCard: { paddingVertical: spacing.xs },
  menuRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, gap: spacing.md },
  menuRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight },
  menuIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { ...typography.body, color: colors.text, flex: 1 },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  menuTrailing: { ...typography.bodySm, color: colors.textSecondary },
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
  signOutWrap: { alignSelf: 'center', paddingVertical: spacing.sm, marginTop: spacing.sm },
  signOutText: { ...typography.bodySm, color: colors.error, textAlign: 'center' },
  version: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});

export default ProfileScreen;
