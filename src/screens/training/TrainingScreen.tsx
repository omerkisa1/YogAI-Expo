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
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { CameraView } from 'expo-camera';
import {
  Camera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import type { Orientation } from 'react-native-vision-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePlan } from '@/features/plans/hooks/usePlan';
import { usePoseDetailAndRules } from '@/features/pose/usePoseDetailAndRules';
import { usePoseVisionPipeline } from '@/features/pose/usePoseVisionPipeline';
import { useCompleteTrainingSession, useSubmitPose } from '@/features/training/hooks/useTraining';
import AppModal from '@/shared/components/AppModal';
import Button from '@/shared/components/Button';
import {
  SkeletonOverlay,
  computeContainFitTransform,
  computeCoverCropTransform,
} from '@/shared/components/SkeletonOverlay';
import ErrorView from '@/shared/components/ErrorView';
import LoadingView from '@/shared/components/LoadingView';
import ProgressBar from '@/shared/components/ProgressBar';
import Touchable from '@/shared/components/Touchable';
import type { Exercise } from '@/shared/types/plan';
import type { RootStackParamList } from '@/navigation/types';
import type { AnalyzeResult, LandmarkPoint } from '@/lib/poseAnalyzer';
import { getPreviewContentExtent } from '@/lib/poseLandmarks';
import { shouldWarnFullBodyLandmarks } from '@/lib/poseVisibilityGuards';
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

/** Son kaydedilen skor: son ~5 saniyedeki smoothing’li accuracy örneklerinin ortalaması (throttle ~150ms). */
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

const TrainingScreen = ({ route, navigation }: Props) => {
  const { planId, sessionId } = route.params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { hasPermission, requestPermission } = useCameraPermission();

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

  const [landmarks, setLandmarks] = useState<LandmarkPoint[]>([]);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [fps, setFps] = useState(0);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
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
  const planTitle = planQuery.data?.title_tr || planQuery.data?.title_en || 'Antrenman';

  const poseIdForRules = currentExercise?.is_analyzable ? currentExercise.pose_id : null;

  const { rulesRef, rulesOriginRef } = usePoseDetailAndRules(poseIdForRules);

  useEffect(() => {
    selectedPoseIdRef.current = poseIdForRules;
  }, [poseIdForRules]);

  const device = useCameraDevice(cameraFacing);
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
    onSmoothedAccuracy: currentExercise?.is_analyzable ? onSmoothedAccuracy : undefined,
  });

  useEffect(() => {
    accuracySamplesRef.current = [];
    resetSmoothers();
    setLandmarks([]);
    setAnalyzeResult(null);
    setFps(0);
    lastResultRef.current = null;
  }, [currentIndex, currentExercise?.pose_id, resetSmoothers]);

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

  const handlePoseComplete = useCallback(
    async (skipped = false) => {
      if (!currentExercise || isSubmitting) return;
      stopTimer();
      setIsSubmitting(true);

      const elapsed = Math.max(1, elapsedRef.current);

      let accuracy = 0;
      if (skipped) {
        accuracy = 0;
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

  const handleQuitConfirm = () => {
    stopTimer();
    setShowQuitModal(false);
    navigation.goBack();
  };

  const coverCropTransform = useMemo(() => {
    if (!frameInfo || overlaySize.width <= 0) return undefined;
    const { contentW, contentH } = getPreviewContentExtent(
      frameInfo.w,
      frameInfo.h,
      frameInfo.orientation,
    );
    return computeCoverCropTransform(
      overlaySize.width,
      overlaySize.height,
      contentW,
      contentH,
    );
  }, [frameInfo, overlaySize.width, overlaySize.height]);

  const containFitTransform = useMemo(() => undefined, []);

  const showFullBodyWarning = useMemo(
    () =>
      Boolean(currentExercise?.is_analyzable && shouldWarnFullBodyLandmarks(landmarks)),
    [currentExercise?.is_analyzable, landmarks],
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
                    {r.exercise.name_tr || r.exercise.name_en}
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
  const progressPercent =
    totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 0;
  const categoryColor = categoryColorMap[currentExercise.category] ?? colors.textMuted;
  const categoryLabel = categoryLabelMap[currentExercise.category] ?? currentExercise.category;

  const analyzableMissingDevice =
    currentExercise.is_analyzable && device == null;

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

  const liveAcc = analyzeResult?.accuracyPercent;

  return (
    <View style={styles.fullScreen} onLayout={onCameraLayout}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {currentExercise.is_analyzable && device ? (
        <>
          <View
            style={[styles.cameraScaledWrap, { transform: [{ scale: previewScale }] }]}
            pointerEvents="box-none"
          >
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={screenState === 'posing'}
              format={format}
              fps={30}
              photo={false}
              video={false}
              audio={false}
              enableBufferCompression={false}
              frameProcessor={frameProcessor}
              pixelFormat="yuv"
              videoStabilizationMode="off"
              outputOrientation="device"
              resizeMode={devResizeMode}
            />
            {landmarks.length > 0 && overlaySize.width > 0 && (
              <SkeletonOverlay
                landmarks={landmarks}
                mirror
                width={overlaySize.width}
                height={overlaySize.height}
                cropTransform={coverCropTransform}
                containFit={containFitTransform}
              />
            )}
          </View>

          <View style={[styles.cameraControlsRow, { top: insets.top + spacing.sm }]}>
            <TouchableOpacity
              style={styles.cameraControlChip}
              onPress={() => setCameraFacing(f => (f === 'front' ? 'back' : 'front'))}
              accessibilityRole="button"
              accessibilityLabel="Kamera çevir"
            >
              <MaterialCommunityIcons name="camera-flip-outline" size={20} color={colors.textOnDark} />
              <Text style={styles.cameraControlChipText}>
                {cameraFacing === 'front' ? 'Ön' : 'Arka'}
              </Text>
            </TouchableOpacity>
            <View style={styles.zoomChips}>
              {[
                { scale: 0.88, label: 'Uzak' },
                { scale: 1, label: '1×' },
                { scale: 1.06, label: 'Yakın' },
              ].map(z => (
                <TouchableOpacity
                  key={z.label}
                  style={[styles.zoomChip, previewScale === z.scale && styles.zoomChipActive]}
                  onPress={() => setPreviewScale(z.scale)}
                >
                  <Text
                    style={[
                      styles.zoomChipText,
                      previewScale === z.scale && styles.zoomChipTextActive,
                    ]}
                  >
                    {z.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {showFullBodyWarning && (
            <View style={[styles.fullBodyWarn, { top: insets.top + 120 }]}>
              <MaterialCommunityIcons name="arrow-expand-all" size={22} color="#1a1a1a" />
              <Text style={styles.fullBodyWarnText}>
                Kalça veya dizler net görünmüyor — uzaklaştırın veya tüm vücudu kadraja alın.
              </Text>
            </View>
          )}
        </>
      ) : (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={cameraFacing === 'back' ? 'back' : 'front'}
          mirror={cameraFacing === 'front'}
        />
      )}

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
          <Text style={styles.topTitle} numberOfLines={1}>
            {planTitle}
          </Text>
          <Text style={styles.topProgress}>
            {currentIndex + 1}/{exercises.length} poz
          </Text>
        </View>
        <View style={styles.fpsMini}>
          {currentExercise.is_analyzable ? (
            <Text style={styles.fpsMiniText}>FPS {fps}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.progressBarWrap}>
        <ProgressBar
          progress={(currentIndex / exercises.length) * 100}
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

        {currentExercise.is_analyzable ? (
          <Text style={styles.accuracyLive}>
            Canlı skor:{' '}
            <Text style={styles.accuracyLiveValue}>
              {liveAcc != null ? `${liveAcc.toFixed(1)}%` : '—'}
            </Text>
          </Text>
        ) : (
          <Text style={styles.noAnalyzeHint}>
            Bu poz kamera analizi olmadan zamanlanır; skor bu adımda 0 kaydedilir.
          </Text>
        )}

        <View style={styles.poseHeaderRow}>
          <View style={[styles.catBadge, { backgroundColor: `${categoryColor}33` }]}>
            <Text style={[styles.catBadgeText, { color: categoryColor }]}>{categoryLabel}</Text>
          </View>
          <Text style={styles.poseNumber}>
            {currentIndex + 1}/{exercises.length}
          </Text>
        </View>

        <Text style={styles.poseName}>{currentExercise.name_tr || currentExercise.name_en}</Text>

        {currentExercise.instructions_tr || currentExercise.instructions_en ? (
          <Text style={styles.poseInstruction} numberOfLines={3}>
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
  errorWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.base,
    gap: spacing.base,
    alignItems: 'center',
  },
  permissionTitle: { ...typography.h3, color: colors.text, textAlign: 'center' },
  permissionDesc: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  cameraScaledWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  cameraControlsRow: {
    position: 'absolute',
    right: spacing.base,
    left: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  cameraControlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  cameraControlChipText: {
    ...typography.captionMedium,
    color: colors.textOnDark,
  },
  zoomChips: { flexDirection: 'row', gap: spacing.xs },
  zoomChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  zoomChipActive: {
    backgroundColor: 'rgba(45,139,94,0.85)',
    borderColor: 'rgba(255,255,255,0.45)',
  },
  zoomChipText: {
    ...typography.captionMedium,
    color: 'rgba(255,255,255,0.85)',
  },
  zoomChipTextActive: { color: colors.textOnDark },
  fullBodyWarn: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 224, 130, 0.95)',
    borderRadius: radius.md,
    padding: spacing.base,
    borderWidth: 2,
    borderColor: 'rgba(200, 138, 0, 0.65)',
    zIndex: 3,
  },
  fullBodyWarnText: {
    ...typography.bodySmMedium,
    color: '#1a1a1a',
    flex: 1,
    lineHeight: 20,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.full,
  },
  topCenter: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  topTitle: { ...typography.bodySmMedium, color: colors.textOnDark },
  topProgress: { ...typography.caption, color: 'rgba(255,255,255,0.7)' },
  fpsMini: { width: 44, alignItems: 'flex-end' },
  fpsMiniText: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  progressBarWrap: { marginHorizontal: spacing.base, marginBottom: spacing.xs },
  timerOverlay: {
    position: 'absolute',
    top: '22%',
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
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    gap: spacing.sm,
    maxHeight: '46%',
  },
  accuracyLive: { ...typography.bodySm, color: 'rgba(255,255,255,0.75)' },
  accuracyLiveValue: { ...typography.bodySmMedium, color: colors.primaryLight },
  noAnalyzeHint: { ...typography.caption, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },
  poseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
});

export default TrainingScreen;
