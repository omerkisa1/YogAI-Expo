import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
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
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import type { Orientation } from 'react-native-vision-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePlan } from '@/features/plans/hooks/usePlan';
import { useProfile } from '@/features/profile/hooks/useProfile';
import { usePoseDetailAndRules } from '@/features/pose/usePoseDetailAndRules';
import { usePoseVisionPipeline } from '@/features/pose/usePoseVisionPipeline';
import { useExerciseAnalysis, resolveExerciseAnalysisKind } from '@/features/pose/useExerciseAnalysis';
import { useCombinedFaceHandVisionPipeline } from '@/features/pose/useCombinedFaceHandVisionPipeline';
import { useCompleteTrainingSession, useStartTrainingSession, useSubmitPose } from '@/features/training/hooks/useTraining';
import Toast from 'react-native-toast-message';
import AppModal from '@/shared/components/AppModal';
import Button from '@/shared/components/Button';
import {
  SkeletonOverlay,
  computeContainFitTransform,
  computeCoverCropTransform,
} from '@/shared/components/SkeletonOverlay';
import ErrorView from '@/shared/components/ErrorView';
import LoadingView from '@/shared/components/LoadingView';
import type { Exercise } from '@/shared/types/plan';
import type { RootStackParamList } from '@/navigation/types';
import type { AnalyzeResult, LandmarkPoint } from '@/lib/poseAnalyzer';
import type { AppLocale } from '@/lib/i18n';
import { getPreviewContentExtent } from '@/lib/poseLandmarks';
import { shouldWarnFullBodyLandmarks } from '@/lib/poseVisibilityGuards';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { TrainingSessionHud } from '@/screens/training/TrainingSessionHud';
import { FaceTrainingOverlays } from '@/shared/components/FaceTrainingOverlays';
import { useIsAppActive } from '@/shared/hooks/useIsAppActive';

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

function aggregateAccuracyFromSamples(samples: number[], lastFallback: number | null): number {
  if (samples.length === 0) return lastFallback ?? 0;
  const approxPerSec = 1000 / 150;
  const n = Math.min(samples.length, Math.ceil(5 * approxPerSec));
  const slice = samples.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

const ENABLE_POSE_CONSOLE_LOG =
  __DEV__ || process.env.EXPO_PUBLIC_POSE_VERBOSE_LOG === '1';

const categoryColorMap: Record<string, string> = {
  standing: colors.categoryStanding,
  seated: colors.categorySeated,
  prone: colors.categoryProne,
  supine: colors.categorySupine,
  inversion: colors.categoryInversion,
};

const categoryLabelMap: Record<string, string> = {
  standing: 'Ayakta',
  seated: 'Oturarak',
  prone: 'Yüzüstü',
  supine: 'Sırtüstü',
  inversion: 'Ters',
};

const ZOOM_PRESETS = [
  { scale: 0.88, label: 'Uzak' },
  { scale: 1, label: '1×' },
  { scale: 1.06, label: 'Yakın' },
] as const;

const TrainingScreen = ({ route, navigation }: Props) => {
  const { planId, sessionId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { hasPermission, requestPermission } = useCameraPermission();

  const planQuery = usePlan(planId);
  const profileQuery = useProfile();
  const locale = (profileQuery.data?.preferred_language ?? 'tr') as AppLocale;
  const submitPoseMutation = useSubmitPose();
  const completeSessionMutation = useCompleteTrainingSession();
  const startSessionMutation = useStartTrainingSession();

  const [screenState, setScreenState] = useState<ScreenState>('posing');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [poseResults, setPoseResults] = useState<PoseResult[]>([]);
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [landmarks, setLandmarks] = useState<LandmarkPoint[]>([]);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [fps, setFps] = useState(0);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [completionCountdown, setCompletionCountdown] = useState<number | null>(null);
  const [repCompletionLatched, setRepCompletionLatched] = useState(false);
  const [latchedTargetReps, setLatchedTargetReps] = useState(0);
  const [frameInfo, setFrameInfo] = useState<{
    w: number;
    h: number;
    orientation: Orientation;
    isMirrored: boolean;
    rawBounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
  } | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [previewScale, setPreviewScale] = useState(1);
  const devResizeMode = 'cover' as const;
  const devResizeModeRef = useRef<'cover' | 'contain'>('cover');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef(0);
  const accuracySamplesRef = useRef<number[]>([]);
  const overlayLayoutRef = useRef({ w: 0, h: 0 });
  const selectedPoseIdRef = useRef<string | null>(null);
  const formatVideoRef = useRef<{ vw: number; vh: number } | null>(null);
  const exercises = planQuery.data?.exercises ?? [];
  const currentExercise = exercises[currentIndex];
  const nextExercise = exercises[currentIndex + 1];
  const analysisKind = useMemo(
    () =>
      resolveExerciseAnalysisKind(
        currentExercise?.pose_id ?? '',
        currentExercise?.analysis_kind,
      ),
    [currentExercise?.analysis_kind, currentExercise?.pose_id],
  );
  const isFaceExercise = analysisKind === 'face';
  const isFaceHandExercise = analysisKind === 'face_hand';
  const isFaceMode = isFaceExercise || isFaceHandExercise;
  const isBodyExercise = analysisKind === 'body';
  const isRepExercise = isFaceMode;
  const isTimedExercise = isBodyExercise;
  const repTarget = currentExercise?.rep_target ?? 0;
  const planTitle = locale === 'tr'
    ? (planQuery.data?.title_tr || planQuery.data?.title_en || 'Antrenman')
    : (planQuery.data?.title_en || planQuery.data?.title_tr || 'Workout');

  const liveAcc = isBodyExercise ? analyzeResult?.accuracyPercent : null;
  const accuracyDisplay = useMemo(() => (liveAcc != null ? `${liveAcc.toFixed(1)}%` : '—'), [liveAcc]);
  const sessionProgressPct = useMemo(
    () => (exercises.length > 0 ? (currentIndex / exercises.length) * 100 : 0),
    [currentIndex, exercises.length],
  );
  const onHudQuit = useCallback(() => setShowQuitModal(true), []);
  const onSelectZoom = useCallback((scale: number) => setPreviewScale(scale), []);

  const poseIdForRules =
    currentExercise?.is_analyzable && isBodyExercise ? currentExercise.pose_id : null;

  const { rulesRef, rulesOriginRef } = usePoseDetailAndRules(poseIdForRules);

  useEffect(() => {
    selectedPoseIdRef.current = poseIdForRules;
  }, [poseIdForRules]);

  const isAppActive = useIsAppActive();
  const cameraSessionActive = screenState === 'posing' && isAppActive;

  const device = useCameraDevice(cameraFacing);
  const cameraReady = Boolean(device && overlaySize.width > 0 && cameraSessionActive);

  const exerciseAnalysis = useExerciseAnalysis({
    poseId: currentExercise?.pose_id ?? '',
    analysisKind,
    repTarget: repTarget || undefined,
    active: cameraSessionActive && isFaceMode,
    cameraReady,
    cameraFacing,
  });

  const screen = Dimensions.get('window');
  const format = useCameraFormat(device, [
    { fps: 30 },
    { videoAspectRatio: screen.height / screen.width },
  ]);

  useEffect(() => {
    if (format) {
      formatVideoRef.current = {
        vw: format.videoWidth,
        vh: format.videoHeight,
      };
    }
  }, [format]);

  const onSmoothedAccuracy = useCallback((pct: number) => {
    accuracySamplesRef.current.push(pct);
  }, []);

  const { frameProcessor: faceHandFrameProcessor } = useCombinedFaceHandVisionPipeline({
    active: cameraSessionActive && isFaceMode,
    enableHands: isFaceHandExercise,
    cameraFacing,
  });

  const { frameProcessor, lastResultRef, resetSmoothers } = usePoseVisionPipeline({
    rulesRef,
    rulesOriginRef,
    selectedPoseIdRef,
    devResizeModeRef,
    overlayLayoutRef,
    formatVideoRef,
    enablePoseConsoleLog: ENABLE_POSE_CONSOLE_LOG,
    setLandmarks,
    setFrameInfo,
    setAnalyzeResult,
    setFps,
    onSmoothedAccuracy:
      isBodyExercise && currentExercise?.is_analyzable
        ? onSmoothedAccuracy
        : undefined,
  });

  useEffect(() => {
    accuracySamplesRef.current = [];
    resetSmoothers();
    setLandmarks([]);
    setAnalyzeResult(null);
    setFps(0);
    lastResultRef.current = null;
    exerciseAnalysis.resetCounters();
    setCompletionCountdown(null);
    setRepCompletionLatched(false);
    setLatchedTargetReps(0);
  }, [currentIndex, currentExercise?.pose_id, exerciseAnalysis.resetCounters, resetSmoothers]);

  useEffect(() => {
    if (!currentExercise) return;
    const dur = getPoseDuration(currentExercise.duration_min);
    setTimeLeft(isTimedExercise ? dur : 0);
    elapsedRef.current = 0;
    setIsTimerRunning(true);
  }, [currentExercise?.pose_id, currentExercise?.duration_min, isTimedExercise]);

  useEffect(() => {
    if (!isTimerRunning) return;

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      if (!isTimedExercise) return;
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
  }, [isTimerRunning, isTimedExercise]);

  useEffect(() => {
    if (isTimedExercise && timeLeft === 0 && isSubmitting === false && currentExercise && screenState === 'posing') {
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

  const handlePoseComplete = useCallback(
    async (skipped = false) => {
      if (!currentExercise || isSubmitting) return;
      stopTimer();
      setIsSubmitting(true);

      const elapsed = Math.max(1, elapsedRef.current);

      let accuracy = 0;
      if (skipped) {
        accuracy = 0;
      } else if (isRepExercise) {
        accuracy = 100;
      } else if (!currentExercise.is_analyzable) {
        accuracy = 0;
      } else {
        accuracy = aggregateAccuracyFromSamples(
          accuracySamplesRef.current,
          lastResultRef.current?.accuracyPercent ?? null,
        );
      }

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
        /* devam */
      }

      setPoseResults(prev => [...prev, result]);
      setIsSubmitting(false);

      const nextIdx = currentIndex + 1;
      if (nextIdx < exercises.length) {
        setCurrentIndex(nextIdx);
      } else {
        try {
          await completeSessionMutation.mutateAsync(sessionId);
          await queryClient.invalidateQueries({ queryKey: ['training'] });
          await queryClient.invalidateQueries({ queryKey: ['training', 'stats'] });
          await queryClient.invalidateQueries({ queryKey: ['plans'] });
        } catch {
          /* completed screen */
        }
        setScreenState('completed');
      }
    },
    [
      completeSessionMutation,
      currentExercise,
      currentIndex,
      exercises.length,
      isSubmitting,
      queryClient,
      sessionId,
      stopTimer,
      submitPoseMutation,
    ],
  );

  useEffect(() => {
    if (!isRepExercise || !exerciseAnalysis.isRepComplete) return;
    if (isSubmitting || screenState !== 'posing' || completionCountdown !== null) return;
    const target = exerciseAnalysis.repResult?.target ?? repTarget;
    setLatchedTargetReps(target);
    setRepCompletionLatched(true);
    setCompletionCountdown(3);
  }, [
    completionCountdown,
    exerciseAnalysis.isRepComplete,
    exerciseAnalysis.repResult?.target,
    handlePoseComplete,
    isRepExercise,
    isSubmitting,
    repTarget,
    screenState,
  ]);

  useEffect(() => {
    if (completionCountdown === null) return;
    if (completionCountdown <= 0) {
      setCompletionCountdown(null);
      void handlePoseComplete(false);
      return;
    }
    const id = setTimeout(() => setCompletionCountdown(c => (c != null && c > 0 ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [completionCountdown, handlePoseComplete]);

  const handleQuitConfirm = () => {
    stopTimer();
    setShowQuitModal(false);
    navigation.goBack();
  };

  const handleRetry = async () => {
    try {
      const newSession = await startSessionMutation.mutateAsync(planId);
      navigation.replace('TrainingSession', { planId, sessionId: newSession.session_id ?? '' });
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } };
      if (axiosError?.response?.status === 409) {
        Toast.show({ type: 'info', text1: 'Devam eden antrenmanınız var' });
      } else {
        Toast.show({ type: 'error', text1: 'Antrenman başlatılamadı' });
      }
    }
  };

  const previewScaleSafe = Math.max(previewScale, 0.05);
  const previewInnerW =
    overlaySize.width > 0 ? overlaySize.width / previewScaleSafe : 0;
  const previewInnerH =
    overlaySize.height > 0 ? overlaySize.height / previewScaleSafe : 0;

  const coverCropTransform = useMemo(() => {
    if (!frameInfo || previewInnerW <= 0) return undefined;
    const { contentW, contentH } = getPreviewContentExtent(
      frameInfo.w,
      frameInfo.h,
      frameInfo.orientation,
    );
    return computeCoverCropTransform(
      previewInnerW,
      previewInnerH,
      contentW,
      contentH,
    );
  }, [frameInfo, previewInnerW, previewInnerH]);

  const containFitTransform = useMemo(() => undefined, []);

  const showFullBodyWarning = useMemo(
    () =>
      Boolean(isBodyExercise && currentExercise?.is_analyzable && shouldWarnFullBodyLandmarks(landmarks)),
    [currentExercise?.is_analyzable, isBodyExercise, landmarks],
  );

  const onCameraLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    overlayLayoutRef.current = { w: width, h: height };
    setOverlaySize({ width, height });
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
          <ErrorView
            type="notfound"
            title="Plan yüklenemedi"
            description="Lütfen geri dönüp tekrar deneyin."
            onRetry={() => void planQuery.refetch()}
          />
          <Button
            title="Geri Dön"
            onPress={() => navigation.goBack()}
            variant="outline"
            size="lg"
            fullWidth
            accessibilityLabel="Geri dön"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorWrap}>
          <MaterialCommunityIcons name="camera-off" size={64} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>Kamera İzni</Text>
          <Text style={styles.permissionDesc}>
            Antrenman sırasında poz analizi için kamera gerekli.
          </Text>
          <Button
            title="İzin Ver"
            onPress={() => void requestPermission()}
            variant="primary"
            size="lg"
            fullWidth
          />
          <Button
            title="Geri"
            onPress={() => navigation.goBack()}
            variant="outline"
            size="lg"
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'completed') {
    const totalDurationSec = poseResults.reduce((sum, r) => sum + r.durationSeconds, 0);
    const totalMin = Math.max(1, Math.round(totalDurationSec / 60));
    const avgAccuracy =
      poseResults.length > 0
        ? Math.round(poseResults.reduce((sum, r) => sum + r.accuracy, 0) / poseResults.length)
        : 0;

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ScrollView
          contentContainerStyle={[styles.completedContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        >
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
              <Text style={styles.statValue}>
                {poseResults.length}/{exercises.length}
              </Text>
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
                    {locale === 'tr' ? (r.exercise.name_tr || r.exercise.name_en) : (r.exercise.name_en || r.exercise.name_tr)}
                  </Text>
                </View>
                <View style={styles.resultRight}>
                  <Text style={styles.resultScore}>%{Math.round(r.accuracy)}</Text>
                  <Text style={styles.resultDur}>
                    {Math.max(1, Math.round(r.durationSeconds / 60))}dk
                  </Text>
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
              onPress={() => void handleRetry()}
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
  const repResult = exerciseAnalysis.repResult;
  const repProgressPercent = repResult ? repResult.progress * 100 : 0;
  const repTargetValue = repResult?.target ?? (repTarget || 0);
  const progressPercent = isRepExercise
    ? repProgressPercent
    : totalDuration > 0
      ? ((totalDuration - timeLeft) / totalDuration) * 100
      : 0;
  const timerDisplay = isRepExercise
    ? `${repResult?.reps ?? 0} / ${repTargetValue}`
    : formatTime(timeLeft);
  const categoryColor = categoryColorMap[currentExercise.category] ?? colors.textMuted;
  const categoryLabel = categoryLabelMap[currentExercise.category] ?? currentExercise.category;

  const requiresCamera = isFaceMode || (isBodyExercise && currentExercise.is_analyzable);
  const analyzableMissingDevice = requiresCamera && device == null;

  if (analyzableMissingDevice) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorWrap}>
          <ErrorView
            type="generic"
            title="Kamera kullanılamıyor"
            description="Bu cihazda gerekli kamera bulunamıyor."
            onRetry={() => navigation.goBack()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.fullScreen} onLayout={onCameraLayout}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <View style={styles.cameraLayer} pointerEvents="box-none">
        {requiresCamera && device ? (
          <View style={styles.cameraClip}>
            {overlaySize.width > 0 && overlaySize.height > 0 ? (
              <View
                style={[
                  styles.cameraZoomInner,
                  {
                    width: previewInnerW,
                    height: previewInnerH,
                    left: (overlaySize.width - previewInnerW) / 2,
                    top: (overlaySize.height - previewInnerH) / 2,
                    transform: [{ scale: previewScale }],
                  },
                ]}
                pointerEvents="box-none"
              >
                  <VisionCamera
                    style={StyleSheet.absoluteFill}
                    device={device}
                    isActive={cameraSessionActive}
                    format={format}
                    fps={30}
                    photo={false}
                    video={false}
                    audio={false}
                    enableBufferCompression={false}
                    frameProcessor={
                      isFaceMode
                        ? faceHandFrameProcessor
                        : isBodyExercise
                          ? frameProcessor
                          : undefined
                    }
                    pixelFormat={isFaceMode && Platform.OS === 'ios' ? 'rgb' : 'yuv'}
                    videoStabilizationMode="off"
                    outputOrientation="device"
                    resizeMode={devResizeMode}
                  />
                  {isBodyExercise && landmarks.length > 0 && previewInnerW > 0 && (
                    <SkeletonOverlay
                      landmarks={landmarks}
                      mirror
                      width={previewInnerW}
                      height={previewInnerH}
                      cropTransform={coverCropTransform}
                      containFit={containFitTransform}
                    />
                  )}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.nonAnalyzableContainer}>
            <MaterialCommunityIcons name="yoga" size={64} color={colors.primaryLight} />
            <Text style={styles.nonAnalyzablePoseName}>
              {locale === 'tr' ? (currentExercise.name_tr || currentExercise.name_en) : (currentExercise.name_en || currentExercise.name_tr)}
            </Text>
            {(currentExercise.instructions_tr || currentExercise.instructions_en) ? (
              <Text style={styles.nonAnalyzableInstructions}>
                {locale === 'tr' ? (currentExercise.instructions_tr || currentExercise.instructions_en) : (currentExercise.instructions_en || currentExercise.instructions_tr)}
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <TrainingSessionHud
        topInset={insets.top}
        bottomInset={insets.bottom}
        planTitle={planTitle}
        exerciseIndex={currentIndex}
        exerciseCount={exercises.length}
        fps={fps}
        showFps={Boolean(isBodyExercise && currentExercise.is_analyzable)}
        onQuitPress={onHudQuit}
        showCameraControls={Boolean(requiresCamera && device)}
        cameraFacing={cameraFacing}
        onFlipCamera={() => setCameraFacing(f => (f === 'front' ? 'back' : 'front'))}
        previewScale={previewScale}
        zoomPresets={ZOOM_PRESETS}
        onSelectZoom={onSelectZoom}
        showFullBodyWarning={showFullBodyWarning}
        sessionProgressPct={sessionProgressPct}
        timerText={timerDisplay}
        poseProgressPct={progressPercent}
        accuracyDisplay={accuracyDisplay}
        showAccuracy={Boolean(isBodyExercise && currentExercise.is_analyzable)}
        showNoAnalyzeHint={!isRepExercise && (!currentExercise.is_analyzable || !isBodyExercise)}
        categoryLabel={categoryLabel}
        categoryColor={categoryColor}
        poseName={locale === 'tr' ? (currentExercise.name_tr || currentExercise.name_en) : (currentExercise.name_en || currentExercise.name_tr)}
        instruction={locale === 'tr' ? (currentExercise.instructions_tr || currentExercise.instructions_en || null) : (currentExercise.instructions_en || currentExercise.instructions_tr || null)}
        nextPoseName={nextExercise ? (locale === 'tr' ? (nextExercise.name_tr || nextExercise.name_en || null) : (nextExercise.name_en || nextExercise.name_tr || null)) : null}
        onCompletePose={() => void handlePoseComplete(false)}
        onSkipPose={() => void handlePoseComplete(true)}
        submitting={isSubmitting}
      />

      {isFaceMode && (
        <FaceTrainingOverlays
          locale={locale}
          analysisKind={analysisKind}
          faceDetected={exerciseAnalysis.faceDetected}
          showFaceLostBanner={exerciseAnalysis.showFaceLostBanner}
          showCalibrationBanner={exerciseAnalysis.showCalibrationBanner}
          faceRepResult={exerciseAnalysis.faceRepResult}
          faceHandRepResult={exerciseAnalysis.faceHandRepResult}
          repPulse={exerciseAnalysis.repPulse}
          handRepPulse={exerciseAnalysis.handRepPulse}
          faceEnterThreshold={exerciseAnalysis.faceEnterThreshold}
          proximityThreshold={exerciseAnalysis.proximityThreshold}
          pipelineLoading={exerciseAnalysis.pipelineLoading}
          completionCountdown={completionCountdown}
          repCompletionLatched={repCompletionLatched}
          latchedTargetReps={latchedTargetReps}
          onRetry={() => {
            exerciseAnalysis.resetCounters();
            setRepCompletionLatched(false);
            setCompletionCountdown(null);
          }}
          handDebugStatus={
            isFaceHandExercise
              ? exerciseAnalysis.stableHand?.detected
                ? exerciseAnalysis.stableHand.isGhost
                  ? 'GHOST'
                  : 'LIVE'
                : 'LOST'
              : undefined
          }
        />
      )}

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
  cameraLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.base,
    gap: spacing.base,
    alignItems: 'center',
  },
  permissionTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  permissionDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  cameraClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  cameraZoomInner: {
    position: 'absolute',
  },
  completedContent: {
    flexGrow: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.base,
  },
  trophyWrap: {
    width: 120,
    height: 120,
    borderRadius: radius.full,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
  },
  resultLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  resultName: { ...typography.bodySmMedium, color: colors.text, flex: 1 },
  resultRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  resultScore: { ...typography.bodySmMedium, color: colors.primary },
  resultDur: { ...typography.caption, color: colors.textMuted },
  completedActions: { width: '100%', gap: spacing.sm, marginTop: spacing.sm },
  nonAnalyzableContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.base,
  },
  nonAnalyzablePoseName: { ...typography.h2, color: '#fff', textAlign: 'center' },
  nonAnalyzableInstructions: { ...typography.body, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
});

export default TrainingScreen;
