import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthReady } from '@/features/auth/hooks/useAuthReady';
import { useProfile } from '@/features/profile/hooks/useProfile';
import api from '@/shared/api/axiosInstance';
import Button from '@/shared/components/Button';
import ErrorView from '@/shared/components/ErrorView';
import LoadingView from '@/shared/components/LoadingView';
import type { Pose } from '@/shared/types/pose';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'PoseDetail'>;

type ApiWrapper<T> = { status: number; message: string; data: T };

const CONTRAINDICATION_LABELS: Record<string, { tr: string; en: string }> = {
  herniated_disc:    { tr: 'Bel fıtığı olanlar dikkatli olmalı', en: 'Use caution with herniated disc' },
  low_back_pain:     { tr: 'Bel ağrısı olanlar dikkatli olmalı', en: 'Use caution with lower back pain' },
  knee_injury:       { tr: 'Diz sakatlığı olanlar dikkatli olmalı', en: 'Use caution with knee injury' },
  ankle_injury:      { tr: 'Ayak bileği sakatlığı olanlar dikkatli olmalı', en: 'Use caution with ankle injury' },
  shoulder_injury:   { tr: 'Omuz sakatlığı olanlar dikkatli olmalı', en: 'Use caution with shoulder injury' },
  wrist_injury:      { tr: 'Bilek sakatlığı olanlar dikkatli olmalı', en: 'Use caution with wrist injury' },
  neck_injury:       { tr: 'Boyun sakatlığı olanlar dikkatli olmalı', en: 'Use caution with neck injury' },
  hip_injury:        { tr: 'Kalça sakatlığı olanlar dikkatli olmalı', en: 'Use caution with hip injury' },
  groin_injury:      { tr: 'Kasık sakatlığı olanlar dikkatli olmalı', en: 'Use caution with groin injury' },
  hamstring_injury:  { tr: 'Arka bacak kası sakatlığı olanlar dikkatli olmalı', en: 'Use caution with hamstring injury' },
  spinal_injury:     { tr: 'Omurga sakatlığı olanlar yapmamalı', en: 'Avoid with spinal injury' },
  high_blood_pressure: { tr: 'Yüksek tansiyon hastaları dikkatli olmalı', en: 'Use caution with high blood pressure' },
  pregnancy:         { tr: 'Hamilelikte yapılmamalı', en: 'Avoid during pregnancy' },
  glaucoma:          { tr: 'Glokom hastaları yapmamalı', en: 'Avoid with glaucoma' },
};

const categoryLabelMap: Record<string, { tr: string; en: string }> = {
  standing:  { tr: 'Ayakta', en: 'Standing' },
  seated:    { tr: 'Oturarak', en: 'Seated' },
  prone:     { tr: 'Yüzüstü', en: 'Prone' },
  supine:    { tr: 'Sırtüstü', en: 'Supine' },
  inversion: { tr: 'Ters', en: 'Inversion' },
};

const categoryColorMap: Record<string, string> = {
  standing:  colors.categoryStanding,
  seated:    colors.categorySeated,
  prone:     colors.categoryProne,
  supine:    colors.categorySupine,
  inversion: colors.categoryInversion,
};

function DifficultyDots({ level, color }: { level: number; color: string }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={[styles.dot, { backgroundColor: i <= level ? color : 'rgba(255,255,255,0.3)' }]} />
      ))}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon as never} size={18} color={colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const PoseDetailScreen = ({ route, navigation }: Props) => {
  const { poseId } = route.params;
  const authReady = useAuthReady();
  const profileQuery = useProfile();
  const locale = profileQuery.data?.preferred_language ?? 'tr';

  const poseQuery = useQuery<Pose>({
    queryKey: ['pose-detail', poseId],
    queryFn: () =>
      api.get<ApiWrapper<Pose>>(`/api/v1/yoga/poses/${poseId}`).then(r => r.data.data),
    enabled: authReady && Boolean(poseId),
    staleTime: 10 * 60 * 1000,
  });

  if (poseQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <LoadingView message="Hareket yükleniyor..." fullScreen />
      </SafeAreaView>
    );
  }

  if (poseQuery.isError || !poseQuery.data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ErrorView
          type="notfound"
          title="Hareket bulunamadı"
          description="Lütfen geri dönüp tekrar deneyin."
          onRetry={() => void poseQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  const pose = poseQuery.data;
  const categoryColor = categoryColorMap[pose.category] ?? colors.primary;
  const categoryLabel = locale === 'tr'
    ? (categoryLabelMap[pose.category]?.tr ?? pose.category)
    : (categoryLabelMap[pose.category]?.en ?? pose.category);
  const poseName = locale === 'tr' ? (pose.name_tr || pose.name_en) : (pose.name_en || pose.name_tr);
  const poseNameAlt = locale === 'tr' ? (pose.name_en || '') : (pose.name_tr || '');
  const instructions = locale === 'tr'
    ? (pose.instructions_tr || pose.instructions_en)
    : (pose.instructions_en || pose.instructions_tr);

  const difficultyColors = ['', colors.difficulty1, colors.difficulty2, colors.difficulty3, colors.difficulty4, colors.difficulty5];
  const difficultyDotColor = difficultyColors[pose.difficulty] ?? '#fff';
  const difficultyLabel = ['', 'Başlangıç', 'Kolay', 'Orta', 'Zor', 'Uzman'][pose.difficulty] ?? String(pose.difficulty);

  const heroGradient: readonly [string, string] = [categoryColor, categoryColor + 'BB'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={categoryColor} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <LinearGradient colors={heroGradient} style={styles.hero}>
          <Text style={styles.heroName}>{poseName}</Text>
          {poseNameAlt ? <Text style={styles.heroNameAlt}>{poseNameAlt}</Text> : null}
          <View style={styles.heroBadgeRow}>
            <DifficultyDots level={pose.difficulty} color={difficultyDotColor} />
            <Text style={styles.heroDifficulty}>{difficultyLabel}</Text>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{locale === 'tr' ? 'Bilgi' : 'Info'}</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="tag-outline" label={locale === 'tr' ? 'Kategori' : 'Category'} value={categoryLabel} />
            <InfoRow icon="target" label={locale === 'tr' ? 'Hedef Bölge' : 'Target Area'} value={pose.target_area} />
            <InfoRow
              icon="chart-bar"
              label={locale === 'tr' ? 'Zorluk' : 'Difficulty'}
              value={`${pose.difficulty}/5 — ${difficultyLabel}`}
            />
            <InfoRow
              icon={pose.is_analyzable ? 'camera-check' : 'camera-off'}
              label={locale === 'tr' ? 'Kamera Analizi' : 'Camera Analysis'}
              value={pose.is_analyzable ? (locale === 'tr' ? 'Destekleniyor' : 'Supported') : (locale === 'tr' ? 'Desteklenmiyor' : 'Not supported')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{locale === 'tr' ? 'Nasıl Yapılır' : 'How to Do It'}</Text>
          <Text style={styles.instructionText}>{instructions}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{locale === 'tr' ? 'Dikkat Edilmesi Gerekenler' : 'Cautions'}</Text>
          {pose.contraindications && pose.contraindications.length > 0 ? (
            pose.contraindications.map(ci => {
              const label = CONTRAINDICATION_LABELS[ci];
              const text = label ? (locale === 'tr' ? label.tr : label.en) : ci;
              return (
                <View key={ci} style={styles.warningRow}>
                  <MaterialCommunityIcons name="alert-outline" size={16} color={colors.warning} />
                  <Text style={styles.warningText}>{text}</Text>
                </View>
              );
            })
          ) : (
            <Text style={styles.noWarning}>
              {locale === 'tr' ? 'Bu hareket herkes için uygundur.' : 'This pose is suitable for everyone.'}
            </Text>
          )}
        </View>

        <View style={styles.actionsSection}>
          {pose.is_analyzable ? (
            <Button
              title={locale === 'tr' ? 'Bu Hareketi Dene' : 'Try This Pose'}
              onPress={() => navigation.navigate('CameraTest')}
              variant="primary"
              size="lg"
              fullWidth
              icon="camera-outline"
              accessibilityLabel="Hareketi kamera ile dene"
            />
          ) : (
            <>
              <Button
                title={locale === 'tr' ? 'Kamera Analizi Desteklenmiyor' : 'Camera Analysis Not Available'}
                onPress={() => {}}
                variant="outline"
                size="lg"
                fullWidth
                icon="camera-off"
                accessibilityLabel="Kamera analizi desteklenmiyor"
              />
              <Text style={styles.noAnalyzeHint}>
                {locale === 'tr'
                  ? 'Bu hareket henüz kamera analiziyle desteklenmiyor.'
                  : 'This pose is not yet supported for camera analysis.'}
              </Text>
            </>
          )}
          <Button
            title={locale === 'tr' ? 'Özel Antrenmanıma Ekle' : 'Add to Custom Plan'}
            onPress={() => navigation.navigate('CreateCustomPlan', { addPoseId: pose.pose_id })}
            variant="outline"
            size="lg"
            fullWidth
            icon="plus-circle-outline"
            accessibilityLabel="Özel antrenmanıma ekle"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: spacing.xxl },
  hero: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  heroName: { ...typography.h1, color: '#fff' },
  heroNameAlt: { ...typography.body, color: 'rgba(255,255,255,0.75)' },
  heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  heroDifficulty: { ...typography.bodySmMedium, color: 'rgba(255,255,255,0.9)' },
  section: { padding: spacing.base, gap: spacing.sm },
  sectionTitle: { ...typography.h4, color: colors.text },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    gap: spacing.sm,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoLabel: { ...typography.bodySmMedium, color: colors.textSecondary, width: 120 },
  infoValue: { ...typography.bodySm, color: colors.text, flex: 1 },
  instructionText: { ...typography.body, color: colors.text, lineHeight: 24 },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  warningText: { ...typography.bodySm, color: colors.textSecondary, flex: 1 },
  noWarning: { ...typography.bodySm, color: colors.textMuted },
  actionsSection: {
    padding: spacing.base,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  noAnalyzeHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});

export default PoseDetailScreen;
