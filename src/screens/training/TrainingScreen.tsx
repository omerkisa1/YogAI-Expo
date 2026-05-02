import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { CameraView } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePlan } from '@/features/plans/hooks/usePlan';
import { useCompleteTrainingSession, useSubmitPose } from '@/features/training/hooks/useTraining';
import AppModal from '@/shared/components/AppModal';
import Button from '@/shared/components/Button';
import ErrorView from '@/shared/components/ErrorView';
import LoadingView from '@/shared/components/LoadingView';
import ProgressBar from '@/shared/components/ProgressBar';
import Touchable from '@/shared/components/Touchable';
import type { Exercise } from '@/shared/types/plan';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'TrainingSession'>;

type ScreenState = 'posing' | 'completed';

interface PoseResult {
  exercise: Exercise;
  accuracy: number;
  durationSeconds: number;
}

const getPoseDuration = (durationMin: number): number => {
  if (__DEV__) return 15;
  return durationMin * 60;
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const categoryColorMap: Record<string, string> = {
  standing: colors.categoryStanding,
  seated: colors.categorySeated,
  prone: colors.categoryProne,
  supine: colors.categorySupine,
  inversion: colors.categoryInversion,
};

const categoryLabelMap: Record<string, string> = {
  standing: 'Ayakta', seated: 'Oturarak', prone: 'Yüzüstü',
  supine: 'Sırtüstü', inversion: 'Ters',
};

const TrainingScreen = ({ route, navigation }: Props) => {
  const { planId, sessionId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const planQuery = usePlan(planId);
  const submitPoseMutation = useSubmitPose();
  const completeSessionMutation = useCompleteTrainingSession();

  const [screenState, setScreenState] = useState<ScreenState>('posing');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [poseResults, setPoseResults] = useState<PoseResult[]>([]);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);

  const exercises = planQuery.data?.exercises ?? [];
  const currentExercise = exercises[currentIndex];
  const nextExercise = exercises[currentIndex + 1];
  const planTitle = planQuery.data?.title_tr || planQuery.data?.title_en || 'Antrenman';

  useEffect(() => {
    if (currentExercise) {
      const dur = getPoseDuration(currentExercise.duration_min);
      setTimeLeft(dur);
      elapsedRef.current = 0;
      setIsTimerRunning(true);
    }
  }, [currentExercise]);

  useEffect(() => {
    if (!isTimerRunning || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && isSubmitting === false && currentExercise && screenState === 'posing') {
      void handlePoseComplete(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);

  const handlePoseComplete = useCallback(async (skipped = false) => {
    if (!currentExercise || isSubmitting) return;
    stopTimer();
    setIsSubmitting(true);

    const totalDur = getPoseDuration(currentExercise.duration_min);
    const elapsed = Math.max(1, elapsedRef.current);
    const accuracy = skipped ? 0 : 75.0;

    const result: PoseResult = {
      exercise: currentExercise,
      accuracy,
      durationSeconds: elapsed,
    };

    try {
      await submitPoseMutation.mutateAsync({
        sessionId,
        data: { pose_id: currentExercise.pose_id, accuracy, duration_seconds: elapsed },
      });
    } catch {
      // Devam et bile kayıt başarısız olsa
    }

    setPoseResults(prev => [...prev, result]);
    setIsSubmitting(false);

    const nextIndex = currentIndex + 1;
    if (nextIndex < exercises.length) {
      setCurrentIndex(nextIndex);
    } else {
      try {
        await completeSessionMutation.mutateAsync(sessionId);
        await queryClient.invalidateQueries({ queryKey: ['training'] });
        await queryClient.invalidateQueries({ queryKey: ['training', 'stats'] });
        await queryClient.invalidateQueries({ queryKey: ['plans'] });
      } catch {
        // Continue to completed screen
      }
      setScreenState('completed');
    }

    void totalDur;
  }, [currentExercise, currentIndex, exercises.length, isSubmitting, sessionId, stopTimer, submitPoseMutation, completeSessionMutation, queryClient]);

  const handleQuitConfirm = () => {
    stopTimer();
    setShowQuitModal(false);
    navigation.goBack();
  };

  if (planQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LoadingView message="Plan yükleniyor..." fullScreen />
      </SafeAreaView>
    );
  }

  if (planQuery.isError || !planQuery.data || exercises.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorWrap}>
          <ErrorView type="notfound" title="Plan yüklenemedi" description="Lütfen geri dönüp tekrar deneyin." onRetry={() => void planQuery.refetch()} />
          <Button title="Geri Dön" onPress={() => navigation.goBack()} variant="outline" size="lg" fullWidth accessibilityLabel="Geri dön" />
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'completed') {
    const totalDurationSec = poseResults.reduce((sum, r) => sum + r.durationSeconds, 0);
    const totalMin = Math.max(1, Math.round(totalDurationSec / 60));
    const avgAccuracy = poseResults.length > 0
      ? Math.round(poseResults.reduce((sum, r) => sum + r.accuracy, 0) / poseResults.length)
      : 0;

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ScrollView contentContainerStyle={[styles.completedContent, { paddingBottom: insets.bottom + spacing.xxl }]}>
          <View style={styles.trophyWrap}>
            <MaterialCommunityIcons name="trophy" size={64} color={colors.secondary} />
          </View>
          <Text style={styles.completedTitle}>Tebrikler!</Text>
          <Text style={styles.completedSubtitle}>Antrenmanınızı Tamamladınız</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>%{avgAccuracy}</Text>
              <Text style={styles.statLabel}>Toplam Skor</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorderLeft]}>
              <Text style={styles.statValue}>{totalMin} dk</Text>
              <Text style={styles.statLabel}>Süre</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorderLeft]}>
              <Text style={styles.statValue}>{poseResults.length}/{exercises.length}</Text>
              <Text style={styles.statLabel}>Tamamlanan</Text>
            </View>
          </View>

          <Text style={styles.resultsTitle}>Poz Sonuçları</Text>
          <View style={styles.resultsList}>
            {poseResults.map((r, i) => (
              <View key={`${r.exercise.pose_id}-${i}`} style={styles.resultRow}>
                <View style={styles.resultLeft}>
                  <MaterialCommunityIcons name="check-circle" size={18} color={colors.success} />
                  <Text style={styles.resultName} numberOfLines={1}>
                    {r.exercise.name_tr || r.exercise.name_en}
                  </Text>
                </View>
                <View style={styles.resultRight}>
                  <Text style={styles.resultScore}>%{Math.round(r.accuracy)}</Text>
                  <Text style={styles.resultDur}>{Math.max(1, Math.round(r.durationSeconds / 60))}dk</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.completedActions}>
            <Button
              title="Ana Sayfaya Dön"
              onPress={() => navigation.navigate('MainTabs')}
              variant="primary"
              size="lg"
              fullWidth
              icon="home-outline"
              accessibilityLabel="Ana sayfaya dön"
            />
            <Button
              title="Antrenmanı Tekrarla"
              onPress={() => navigation.replace('TrainingSession', { planId, sessionId })}
              variant="outline"
              size="lg"
              fullWidth
              icon="refresh"
              accessibilityLabel="Antrenmanı tekrarla"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const totalDuration = getPoseDuration(currentExercise.duration_min);
  const progressPercent = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 0;
  const categoryColor = categoryColorMap[currentExercise.category] ?? colors.textMuted;
  const categoryLabel = categoryLabelMap[currentExercise.category] ?? currentExercise.category;

  return (
    <View style={styles.fullScreen}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <CameraView style={StyleSheet.absoluteFill} facing="front" mirror />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Touchable
          onPress={() => setShowQuitModal(true)}
          style={styles.backBtn}
          borderRadius={radius.full}
          accessibilityRole="button"
          accessibilityLabel="Antrenmanı durdur"
        >
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.textOnDark} />
        </Touchable>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>{planTitle}</Text>
          <Text style={styles.topProgress}>{currentIndex + 1}/{exercises.length} poz</Text>
        </View>
        <View style={styles.topRight} />
      </View>

      <View style={styles.progressBarWrap}>
        <ProgressBar
          progress={((currentIndex) / exercises.length) * 100}
          color={colors.primary}
          height={3}
          animated
        />
      </View>

      <View style={styles.timerOverlay}>
        <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
      </View>

      <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
        <ProgressBar progress={progressPercent} color={colors.primaryLight} height={4} animated />

        <View style={styles.poseHeaderRow}>
          <View style={[styles.catBadge, { backgroundColor: `${categoryColor}33` }]}>
            <Text style={[styles.catBadgeText, { color: categoryColor }]}>{categoryLabel}</Text>
          </View>
          <Text style={styles.poseNumber}>{currentIndex + 1}/{exercises.length}</Text>
        </View>

        <Text style={styles.poseName}>
          {currentExercise.name_tr || currentExercise.name_en}
        </Text>

        {(currentExercise.instructions_tr || currentExercise.instructions_en) ? (
          <Text style={styles.poseInstruction} numberOfLines={2}>
            {currentExercise.instructions_tr || currentExercise.instructions_en}
          </Text>
        ) : null}

        {nextExercise ? (
          <Text style={styles.nextLabel}>
            Sonraki: {nextExercise.name_tr || nextExercise.name_en}
          </Text>
        ) : null}

        <View style={styles.bottomActions}>
          <Button
            title="Pozu Tamamla"
            onPress={() => void handlePoseComplete(false)}
            variant="primary"
            size="lg"
            fullWidth
            icon="check-circle-outline"
            loading={isSubmitting}
            disabled={isSubmitting}
            accessibilityLabel="Pozu tamamla"
          />
          <Button
            title="Pozu Atla"
            onPress={() => void handlePoseComplete(true)}
            variant="ghost"
            size="md"
            fullWidth
            disabled={isSubmitting}
            accessibilityLabel="Pozu atla"
          />
        </View>
      </View>

      <AppModal
        visible={showQuitModal}
        onClose={() => setShowQuitModal(false)}
        title="Antrenmanı iptal etmek istiyor musunuz?"
        description="İlerlemeniz kaydedilmeyecek."
        icon="alert-circle-outline"
        iconColor={colors.warning}
        actions={[
          { label: 'Devam Et', variant: 'primary', onPress: () => setShowQuitModal(false) },
          { label: 'İptal Et', variant: 'danger', onPress: handleQuitConfirm },
        ]}
        dismissOnBackdrop
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  fullScreen: { flex: 1, backgroundColor: '#000' },
  errorWrap: { flex: 1, justifyContent: 'center', padding: spacing.base, gap: spacing.base },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backBtn: {
    width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
  },
  topCenter: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  topTitle: { ...typography.bodySmMedium, color: colors.textOnDark },
  topProgress: { ...typography.caption, color: 'rgba(255,255,255,0.7)' },
  topRight: { width: 36 },
  progressBarWrap: { marginHorizontal: spacing.base, marginBottom: spacing.xs },
  timerOverlay: {
    position: 'absolute',
    top: '25%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  timerText: {
    ...typography.h1,
    color: colors.textOnDark,
    fontVariant: Platform.OS === 'ios' ? ['tabular-nums'] : undefined,
  },
  bottomPanel: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    gap: spacing.sm,
  },
  poseHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
  catBadgeText: { ...typography.captionMedium },
  poseNumber: { ...typography.caption, color: 'rgba(255,255,255,0.6)' },
  poseName: { ...typography.h3, color: colors.textOnDark },
  poseInstruction: { ...typography.bodySm, color: 'rgba(255,255,255,0.75)', lineHeight: 20 },
  nextLabel: { ...typography.caption, color: 'rgba(255,255,255,0.5)' },
  bottomActions: { gap: spacing.xs },
  completedContent: {
    flexGrow: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.base,
  },
  trophyWrap: {
    width: 120, height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  completedTitle: { ...typography.h1, color: colors.text, textAlign: 'center' },
  completedSubtitle: { ...typography.h4, color: colors.textSecondary, textAlign: 'center' },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    width: '100%',
    overflow: 'hidden',
  },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: spacing.base, gap: spacing.xs },
  statBoxBorderLeft: { borderLeftWidth: 1, borderLeftColor: colors.borderLight },
  statValue: { ...typography.h2, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textSecondary },
  resultsTitle: { ...typography.h4, color: colors.text, alignSelf: 'flex-start', marginTop: spacing.sm },
  resultsList: { width: '100%', gap: spacing.sm },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.borderLight, padding: spacing.base,
  },
  resultLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  resultName: { ...typography.bodySmMedium, color: colors.text, flex: 1 },
  resultRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  resultScore: { ...typography.bodySmMedium, color: colors.primary },
  resultDur: { ...typography.caption, color: colors.textMuted },
  completedActions: { width: '100%', gap: spacing.sm, marginTop: spacing.sm },
});

export default TrainingScreen;
