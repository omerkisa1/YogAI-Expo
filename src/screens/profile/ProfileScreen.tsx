import React, { useMemo, useState } from 'react';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useProfile } from '@/features/profile/hooks/useProfile';
import AppModal from '@/shared/components/AppModal';
import Card from '@/shared/components/Card';
import ErrorView from '@/shared/components/ErrorView';
import LoadingView from '@/shared/components/LoadingView';
import ProgressBar from '@/shared/components/ProgressBar';
import Touchable from '@/shared/components/Touchable';
import type { Goal } from '@/shared/types/profile';
import type { Injury, Level } from '@/shared/types/plan';
import type { RootStackParamList } from '@/navigation/types';
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

  const menuItems = [
    { key: 'edit-profile', label: 'Profili Düzenle', icon: 'account-edit-outline', backgroundColor: colors.primary, onPress: () => navigation.navigate('EditProfile') },
    { key: 'notifications', label: 'Bildirim Ayarları', icon: 'bell-outline', backgroundColor: colors.info, onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }) },
    { key: 'about', label: 'Hakkında', icon: 'information-outline', backgroundColor: colors.textMuted, onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }) },
    { key: 'privacy', label: 'Gizlilik Politikası', icon: 'shield-check-outline', backgroundColor: colors.textMuted, onPress: () => Toast.show({ type: 'info', position: 'top', text1: 'Yakında' }) },
  ] as const;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topActionsRow}>
          <Touchable onPress={() => setShowSignOutModal(true)} borderRadius={radius.md} style={styles.logoutIconButton} accessibilityRole="button" accessibilityLabel="Çıkış yap">
            <MaterialCommunityIcons name="logout" size={22} color={colors.error} />
          </Touchable>
        </View>

        <View style={styles.profileHeader}>
          <LinearGradient colors={[colors.gradientPrimary[0], colors.gradientPrimary[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </LinearGradient>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

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
              <Text style={styles.completionTitle}>Profil Tamamlanma</Text>
              <View style={styles.completionBadge}>
                <Text style={styles.completionBadgeText}>{completedCount}/{completionChecks.length}</Text>
                <MaterialCommunityIcons name="check" size={12} color={colors.success} />
              </View>
            </View>
            <ProgressBar progress={completionPercent} color={colors.primary} height={4} />
          </View>
          <Touchable onPress={() => navigation.navigate('EditProfile')} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Profili düzenle">
            <Text style={styles.editLink}>Profili Düzenle</Text>
          </Touchable>
        </Card>

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
      </ScrollView>

      <AppModal visible={showSignOutModal} onClose={() => setShowSignOutModal(false)} title="Çıkış yapmak istediğinize emin misiniz?" icon="logout" iconColor={colors.error} actions={[{ label: 'İptal', variant: 'ghost', onPress: () => setShowSignOutModal(false) }, { label: 'Çıkış Yap', variant: 'danger', onPress: () => { setShowSignOutModal(false); void onSignOut(); } }]} autoDismissMs={10000} dismissOnBackdrop />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.base, paddingBottom: spacing.xxl, gap: spacing.base },
  topActionsRow: { alignItems: 'flex-end', paddingTop: spacing.sm },
  logoutIconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorSoft },
  errorWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.base },
  profileHeader: { alignItems: 'center', paddingTop: spacing.sm },
  avatar: { width: 80, height: 80, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, shadowColor: '#1A1A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  avatarText: { ...typography.h1, color: colors.textOnPrimary },
  name: { ...typography.h3, color: colors.text, maxWidth: '90%' },
  email: { ...typography.bodySm, color: colors.textSecondary, marginTop: spacing.xs },
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
  version: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.base },
});

export default ProfileScreen;
