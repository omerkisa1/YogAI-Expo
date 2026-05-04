import React, { useCallback, useState } from 'react';
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useDeletePlan, useUpdatePlan } from '@/features/plans/hooks/useCreatePlan';
import { usePlan } from '@/features/plans/hooks/usePlan';
import { useStartTrainingSession } from '@/features/training/hooks/useTraining';
import AppModal from '@/shared/components/AppModal';
import Button from '@/shared/components/Button';
import ErrorView from '@/shared/components/ErrorView';
import LoadingView from '@/shared/components/LoadingView';
import Touchable from '@/shared/components/Touchable';
import type { Exercise, Plan } from '@/shared/types/plan';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanDetail'>;

const categoryColorMap: Record<string, string> = {
  standing: colors.categoryStanding, seated: colors.categorySeated, prone: colors.categoryProne,
  supine: colors.categorySupine, inversion: colors.categoryInversion,
};

const levelLabelMap: Record<Plan['difficulty'], string> = { beginner: 'Başlangıç', intermediate: 'Orta', advanced: 'İleri' };
const focusLabelMap: Record<string, string> = { full_body: 'Tam Vücut', legs: 'Bacaklar', back: 'Sırt', core: 'Core', balance: 'Denge', flexibility: 'Esneklik', arms: 'Kollar', hips: 'Kalça' };
const categoryLabelMap: Record<string, string> = { standing: 'Standing', seated: 'Seated', prone: 'Prone', supine: 'Supine', inversion: 'Inversion' };
const difficultyToScale = (level: Plan['difficulty']) => { if (level === 'beginner') return 1; if (level === 'intermediate') return 3; return 5; };

const EXERCISE_CAROUSEL_HEIGHT = 520;

type ExerciseStepPageProps = {
  exercise: Exercise;
  index: number;
  total: number;
  pageWidth: number;
  difficultyBadge: string;
};

const ExerciseStepPage = ({
  exercise,
  index,
  total,
  pageWidth,
  difficultyBadge,
}: ExerciseStepPageProps) => {
  const categoryColor = categoryColorMap[exercise.category] ?? colors.textMuted;
  const categoryLabel = categoryLabelMap[exercise.category] ?? (exercise.category || 'unknown');
  return (
    <View style={[styles.stepPage, { width: pageWidth }]} accessibilityRole="summary">
      <View style={styles.stepPreview}>
        <LinearGradient
          colors={[`${categoryColor}44`, colors.surfaceElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <MaterialCommunityIcons name="yoga" size={56} color={categoryColor} />
        <Text style={styles.stepPreviewLabel}>Hareket önizlemesi</Text>
        <Text style={styles.stepPreviewHint} numberOfLines={2}>
          Yakında: animasyon / görsel ile adım burada gösterilecek
        </Text>
      </View>
      <View style={styles.stepMetaBar}>
        <View style={styles.exerciseNumberBadge}>
          <Text style={styles.exerciseNumber}>{index + 1}</Text>
        </View>
        <Text style={styles.stepCounterText}>
          Adım {index + 1} / {total}
        </Text>
      </View>
      <View style={styles.stepBody}>
        <Text style={styles.exerciseTitle}>{exercise.name_tr || exercise.name_en}</Text>
        <Text style={styles.exerciseSubtitle}>{exercise.name_en}</Text>
        <View style={styles.exerciseChipRow}>
          <View style={[styles.exerciseChip, { backgroundColor: `${categoryColor}22` }]}>
            <Text style={[styles.exerciseChipText, { color: categoryColor }]}>{categoryLabel}</Text>
          </View>
          <View style={styles.exerciseChipNeutral}>
            <Text style={styles.exerciseChipNeutralText}>{difficultyBadge}</Text>
          </View>
        </View>
        <View style={styles.exerciseMetaLine}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.exerciseMetaText}>{exercise.duration_min} dk</Text>
        </View>
        <View style={styles.analyzableRow}>
          <MaterialCommunityIcons
            name={exercise.is_analyzable ? 'camera-outline' : 'camera-off-outline'}
            size={16}
            color={exercise.is_analyzable ? colors.success : colors.textMuted}
          />
          <Text style={[styles.analyzableText, exercise.is_analyzable && styles.analyzableTextActive]}>
            {exercise.is_analyzable ? 'Analiz edilebilir' : 'Analiz edilemez'}
          </Text>
        </View>
        <ScrollView
          style={styles.instructionScroll}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.instructionSectionLabel}>Nasıl yapılır</Text>
          <Text style={styles.exerciseDescription}>
            {exercise.instructions_tr || exercise.instructions_en || 'Talimat metni bu adım için eklenmemiş.'}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
};

type ExerciseCarouselProps = {
  exercises: Exercise[];
  difficultyBadge: string;
};

const ExerciseCarousel = ({ exercises, difficultyBadge }: ExerciseCarouselProps) => {
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = windowWidth;
  const [activeIndex, setActiveIndex] = useState(0);

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const ix = Math.round(x / pageWidth);
      setActiveIndex(Math.min(Math.max(0, ix), exercises.length - 1));
    },
    [exercises.length, pageWidth],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Exercise; index: number }) => (
      <ExerciseStepPage
        exercise={item}
        index={index}
        total={exercises.length}
        pageWidth={pageWidth}
        difficultyBadge={difficultyBadge}
      />
    ),
    [difficultyBadge, exercises.length, pageWidth],
  );

  if (exercises.length === 0) return null;

  return (
    <View style={styles.carouselWrap}>
      <FlatList
        key={pageWidth}
        data={exercises}
        keyExtractor={(item, index) => `${item.pose_id}-${index}`}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({
          length: pageWidth,
          offset: pageWidth * index,
          index,
        })}
        decelerationRate="fast"
        initialNumToRender={2}
        windowSize={3}
        style={{ height: EXERCISE_CAROUSEL_HEIGHT }}
      />
      <View style={styles.dotsRow} accessibilityLabel={`Antrenman adımları, ${activeIndex + 1} / ${exercises.length}`}>
        {exercises.map((_, i) => (
          <View
            key={String(i)}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ))}
      </View>
      <Text style={styles.swipeHint}>← Sürükleyerek tüm adımları inceleyin →</Text>
    </View>
  );
};

const PlanDetailScreen = ({ route, navigation }: Props) => {
  const { planId } = route.params;
  const insets = useSafeAreaInsets();
  const planQuery = usePlan(planId);
  const updatePlanMutation = useUpdatePlan();
  const deletePlanMutation = useDeletePlan();
  const startSessionMutation = useStartTrainingSession();
  const [showPlanActionsModal, setShowPlanActionsModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const plan = planQuery.data;

  const onToggleFavorite = async () => {
    if (!plan) return;
    try { await updatePlanMutation.mutateAsync({ id: planId, data: { favorite: !plan.favorite } }); }
    catch { Toast.show({ type: 'error', position: 'top', text1: 'İşlem Başarısız', text2: 'Favori durumu güncellenemedi.' }); }
  };

  const onTogglePin = async () => {
    if (!plan) return;
    try { await updatePlanMutation.mutateAsync({ id: planId, data: { pin: !plan.pin } }); }
    catch { Toast.show({ type: 'error', position: 'top', text1: 'İşlem Başarısız', text2: 'Sabitleme durumu güncellenemedi.' }); }
  };

  const onDeletePlan = async () => {
    try {
      await deletePlanMutation.mutateAsync(planId);
      setShowDeleteConfirmModal(false); setShowPlanActionsModal(false);
      Toast.show({ type: 'success', position: 'top', text1: 'Plan silindi', text2: 'Plan listenizden kaldırıldı.' });
      navigation.goBack();
    } catch { Toast.show({ type: 'error', position: 'top', text1: 'Silme Başarısız', text2: 'Plan silinemedi. Lütfen tekrar deneyin.' }); }
  };

  const onStartTraining = async () => {
    if (!plan) return;
    try {
      const session = await startSessionMutation.mutateAsync(plan.id);
      Toast.show({ type: 'success', position: 'top', text1: 'Antrenman başladı' });
      navigation.navigate('TrainingSession', { planId: plan.id, sessionId: session.session_id });
    } catch { Toast.show({ type: 'error', position: 'top', text1: 'Antrenman başlatılamadı', text2: 'Lütfen tekrar deneyin.' }); }
  };

  if (planQuery.isLoading) return (<SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={colors.background} /><LoadingView message="Plan Detayı Yükleniyor..." fullScreen /></SafeAreaView>);

  if (planQuery.isError || !plan) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorWrap}><ErrorView type="notfound" title="Plan bulunamadı" description="Plan detayları şu anda getirilemiyor." onRetry={() => { void planQuery.refetch(); }} /></View>
      </SafeAreaView>
    );
  }

  const difficultyScale = difficultyToScale(plan.difficulty);
  const analyzableCount = plan.analyzable_pose_count ?? 0;
  const totalPoses = plan.total_pose_count || plan.exercises.length || 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <LinearGradient colors={[colors.gradientHero[0], colors.gradientHero[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, { paddingTop: insets.top + spacing.base }]}>
          <View style={styles.heroTopRow}>
            <Touchable onPress={navigation.goBack} style={styles.heroBackButton} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Geri">
              <MaterialCommunityIcons name="chevron-left" size={24} color={colors.textOnPrimary} />
              <Text style={styles.heroBackText}>Geri</Text>
            </Touchable>
            <View style={styles.heroActions}>
              <Touchable onPress={() => { void onToggleFavorite(); }} style={styles.heroActionButton} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel="Favori">
                <MaterialCommunityIcons name={plan.favorite ? 'star' : 'star-outline'} size={20} color={colors.textOnPrimary} />
              </Touchable>
              <Touchable onPress={() => { void onTogglePin(); }} style={styles.heroActionButton} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel="Sabitle">
                <MaterialCommunityIcons name={plan.pin ? 'pin' : 'pin-outline'} size={20} color={colors.textOnPrimary} />
              </Touchable>
              <Touchable onPress={() => setShowPlanActionsModal(true)} style={styles.heroActionButton} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel="Plan menü">
                <MaterialCommunityIcons name="dots-vertical" size={20} color={colors.textOnPrimary} />
              </Touchable>
            </View>
          </View>
          <Text style={styles.heroTitle}>{plan.title_tr || plan.title_en}</Text>
          <View style={styles.heroChipRow}>
            <View style={styles.heroChip}><Text style={styles.heroChipText}>{levelLabelMap[plan.difficulty]}</Text></View>
            <View style={styles.heroChip}><Text style={styles.heroChipText}>{focusLabelMap[plan.focus_area] ?? plan.focus_area}</Text></View>
          </View>
          <View style={styles.heroMetaRow}>
            <MaterialCommunityIcons name="clock-outline" size={15} color={colors.textOnPrimary} />
            <Text style={styles.heroMetaText}>{plan.total_duration_min}dk</Text>
            <Text style={styles.heroMetaDot}>•</Text>
            <MaterialCommunityIcons name="yoga" size={15} color={colors.textOnPrimary} />
            <Text style={styles.heroMetaText}>{totalPoses} hareket</Text>
          </View>
          <View style={styles.heroMetaRow}>
            <MaterialCommunityIcons name="camera-outline" size={15} color={colors.textOnPrimary} />
            <Text style={styles.heroMetaText}>{analyzableCount}/{totalPoses} analiz edilebilir</Text>
          </View>
        </LinearGradient>

        <Text style={styles.sectionTitle}>Egzersiz adımları</Text>
        <ExerciseCarousel exercises={plan.exercises} difficultyBadge={`D${difficultyScale}`} />
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
        <Button title="Poz Testi" onPress={() => navigation.navigate('CameraTest')} variant="outline" size="md" fullWidth icon="camera-outline" accessibilityLabel="Poz testi aç" />
        <Button title="Antrenmanı Başlat" onPress={onStartTraining} variant="primary" size="lg" fullWidth icon="play-circle-outline" loading={startSessionMutation.isPending} disabled={startSessionMutation.isPending} accessibilityLabel="Antrenmanı başlat" />
      </View>

      <AppModal visible={showPlanActionsModal} onClose={() => setShowPlanActionsModal(false)} title="Plan İşlemleri" actions={[{ label: 'Planı Sil', variant: 'danger', onPress: () => { setShowPlanActionsModal(false); setShowDeleteConfirmModal(true); } }]} dismissOnBackdrop />
      <AppModal visible={showDeleteConfirmModal} onClose={() => setShowDeleteConfirmModal(false)} title="Bu planı silmek istediğinize emin misiniz?" description="Bu işlem geri alınamaz." icon="delete-outline" iconColor={colors.error} actions={[{ label: 'İptal', variant: 'ghost', onPress: () => setShowDeleteConfirmModal(false) }, { label: 'Sil', variant: 'danger', onPress: () => { void onDeletePlan(); } }]} autoDismissMs={10000} dismissOnBackdrop />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.base },
  errorWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.base },
  hero: { paddingHorizontal: spacing.base, paddingBottom: spacing.lg, borderBottomLeftRadius: radius.xxl, borderBottomRightRadius: radius.xxl },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.base },
  heroBackButton: { flexDirection: 'row', alignItems: 'center' },
  heroBackText: { ...typography.bodySmMedium, color: colors.textOnPrimary },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroActionButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.14)' },
  heroTitle: { ...typography.h1, color: colors.textOnPrimary, marginBottom: spacing.base },
  heroChipRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  heroChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.2)' },
  heroChipText: { ...typography.captionMedium, color: colors.textOnPrimary },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.xs },
  heroMetaText: { ...typography.bodySm, color: 'rgba(255,255,255,0.84)' },
  heroMetaDot: { ...typography.bodySm, color: 'rgba(255,255,255,0.84)' },
  sectionTitle: { ...typography.h4, color: colors.text, marginTop: spacing.lg, marginHorizontal: spacing.base, marginBottom: spacing.sm },
  carouselWrap: { marginBottom: spacing.sm },
  stepPage: {
    height: EXERCISE_CAROUSEL_HEIGHT,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
  },
  stepPreview: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    overflow: 'hidden',
  },
  stepPreviewLabel: { ...typography.bodySmMedium, color: colors.text, marginTop: spacing.sm },
  stepPreviewHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.lg },
  stepMetaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceElevated,
  },
  stepCounterText: { ...typography.captionMedium, color: colors.textSecondary },
  stepBody: { flex: 1, paddingHorizontal: spacing.base, paddingTop: spacing.sm },
  instructionScroll: { flexGrow: 1, maxHeight: 220 },
  instructionSectionLabel: { ...typography.captionMedium, color: colors.textMuted, marginBottom: spacing.xs },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 14 },
  swipeHint: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.base, marginBottom: spacing.xs },
  exerciseNumberBadge: { width: 28, height: 28, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  exerciseNumber: { ...typography.captionMedium, color: colors.textOnPrimary },
  exerciseTitle: { ...typography.h4, color: colors.text },
  exerciseSubtitle: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic', marginTop: spacing.xxs },
  exerciseChipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  exerciseChip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  exerciseChipText: { ...typography.caption },
  exerciseChipNeutral: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surfaceElevated },
  exerciseChipNeutralText: { ...typography.caption, color: colors.textSecondary },
  exerciseMetaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  exerciseMetaText: { ...typography.caption, color: colors.textSecondary },
  analyzableRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  analyzableText: { ...typography.captionMedium, color: colors.textMuted },
  analyzableTextActive: { color: colors.success },
  exerciseDescription: { ...typography.bodySm, color: colors.textSecondary, lineHeight: 22 },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: spacing.base, paddingHorizontal: spacing.base, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderLight },
});

export default PlanDetailScreen;
