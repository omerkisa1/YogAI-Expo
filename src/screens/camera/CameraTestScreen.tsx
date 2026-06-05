import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera as VisionCamera,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
} from 'react-native-vision-camera';
import type { Orientation } from 'react-native-vision-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthReady } from '@/features/auth/hooks/useAuthReady';
import { useProfile } from '@/features/profile/hooks/useProfile';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import api from '@/shared/api/axiosInstance';
import type { AnalyzablePoseMeta, YogaApiResponse } from '@/features/pose/analyzablePoseTypes';
import { usePoseDetailAndRules, type RulesSourceUi } from '@/features/pose/usePoseDetailAndRules';
import { usePoseVisionPipeline } from '@/features/pose/usePoseVisionPipeline';
import { useExerciseAnalysis, resolveExerciseAnalysisKind } from '@/features/pose/useExerciseAnalysis';
import { useCombinedFaceHandVisionPipeline } from '@/features/pose/useCombinedFaceHandVisionPipeline';
import Button from '@/shared/components/Button';
import {
  SkeletonOverlay,
  computeContainFitTransform,
  computeCoverCropTransform,
} from '@/shared/components/SkeletonOverlay';
import type { RootStackParamList } from '@/navigation/types';
import { RULE_TRIANGLE_VISIBILITY, type AnalyzeResult, type LandmarkPoint } from '@/lib/poseAnalyzer';
import { filterAnalyzablePosesForUser } from '@/lib/analyzablePoseFilters';
import type { AppLocale } from '@/lib/i18n';
import { FaceTrainingOverlays } from '@/shared/components/FaceTrainingOverlays';
import { shouldWarnFullBodyLandmarks } from '@/lib/poseVisibilityGuards';
import { getPreviewContentExtent, POSE_LANDMARK_KEYS } from '@/lib/poseLandmarks';
import type { VisionPoseBundle } from '@/lib/poseDiagnosticsLog';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'CameraTest'>;

function RulesSourceBanner({ state }: { state: RulesSourceUi }) {
  if (state.phase === 'idle') return null;

  if (state.phase === 'loading') {
    return (
      <View style={[styles.rulesSourceBanner, styles.rulesSourceBannerMuted]}>
        <MaterialCommunityIcons name="timer-sand" size={18} color={colors.textSecondary} />
        <Text style={styles.rulesSourceBannerText}>Kurallar: poz detayı yükleniyor…</Text>
      </View>
    );
  }

  if (state.phase === 'error') {
    return (
      <View style={[styles.rulesSourceBanner, styles.rulesSourceBannerError]}>
        <MaterialCommunityIcons name="cloud-alert-outline" size={18} color={colors.error} />
        <Text style={[styles.rulesSourceBannerText, { color: colors.error }]}>
          Kurallar: poz detayı alınamadı
        </Text>
      </View>
    );
  }

  const { origin, count } = state;
  const isApi = origin === 'api';
  const isFallback = origin === 'fallback';

  return (
    <View
      style={[
        styles.rulesSourceBanner,
        isApi && styles.rulesSourceBannerApi,
        isFallback && styles.rulesSourceBannerWarn,
        !isApi && !isFallback && styles.rulesSourceBannerMuted,
      ]}
      accessibilityLabel={`Poz kuralları: ${isApi ? 'API' : isFallback ? 'yerel yedek' : 'tanımsız'}, ${count} kural`}
    >
      <MaterialCommunityIcons
        name={isApi ? 'cloud-check-outline' : isFallback ? 'database-alert-outline' : 'help-circle-outline'}
        size={18}
        color={isApi ? colors.success : isFallback ? colors.warning : colors.textSecondary}
      />
      <View style={styles.rulesSourceBannerTextCol}>
        <Text style={styles.rulesSourceBannerTitle}>
          Kurallar:{' '}
          <Text style={styles.rulesSourceBannerMono}>
            rulesOrigin={isApi ? 'api' : isFallback ? 'fallback' : 'none'}
          </Text>
          {` · ${count} kural`}
        </Text>
        <Text style={styles.rulesSourceBannerHint}>
          {isApi
            ? 'Backend landmark_rules kullanılıyor.'
            : isFallback
              ? "API'de kural yok; yerel test kuralları kullanılıyor."
              : 'Bu poz için ne API ne yerel kural tanımlı.'}
        </Text>
      </View>
    </View>
  );
}

type ScreenState = 'pose_selection' | 'active' | 'completed';

const POSE_DURATION = 30;
const VISIBILITY_DEBUG_THRESHOLD = RULE_TRIANGLE_VISIBILITY;

/** Metro’da `[YogAI.Pose]` ile filtrele. Release + fiziksel cihaz: `.env` içine `EXPO_PUBLIC_POSE_VERBOSE_LOG=1` */
const ENABLE_POSE_CONSOLE_LOG =
  __DEV__ || process.env.EXPO_PUBLIC_POSE_VERBOSE_LOG === '1';
/** rulesOrigin banner: yalnızca DEV veya EXPO_PUBLIC_POSE_VERBOSE_LOG */
const SHOW_VERBOSE_RULES_BANNER = ENABLE_POSE_CONSOLE_LOG;

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const landmarkDebugName = (index: number): string =>
  POSE_LANDMARK_KEYS[index] ?? `idx_${index}`;

function accuracyColor(accuracy: number): string {
  if (accuracy >= 80) return colors.success;
  if (accuracy >= 50) return colors.warning;
  return colors.error;
}

const DifficultyDots = ({ level }: { level: number }) => (
  <View style={styles.difficultyRow}>
    {[1, 2, 3, 4, 5].map(i => (
      <View
        key={i}
        style={[
          styles.difficultyDot,
          { backgroundColor: i <= level ? colors.primary : colors.borderLight },
        ]}
      />
    ))}
  </View>
);

type RuleListIconName =
  | 'check-circle'
  | 'alert'
  | 'eye-off'
  | 'close-circle';

const CameraTestScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const authReady = useAuthReady();
  const profileQuery = useProfile();
  const locale = (profileQuery.data?.preferred_language ?? 'tr') as AppLocale;

  const [screenState, setScreenState] = useState<ScreenState>('pose_selection');
  const [selectedPoseId, setSelectedPoseId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(POSE_DURATION);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [landmarks, setLandmarks] = useState<LandmarkPoint[]>([]);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null);
  const [fps, setFps] = useState(0);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [showDevDebug, setShowDevDebug] = useState(false);
  const [completedAccuracy, setCompletedAccuracy] = useState<number | null>(null);
  const [completedReps, setCompletedReps] = useState<number | null>(null);

  /** DEV: frame metadata for diagnostics */
  const [frameInfo, setFrameInfo] = useState<{
    w: number;
    h: number;
    orientation: Orientation;
    isMirrored: boolean;
    rawBounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
  } | null>(null);

  /** DEV: toggle between cover / contain for quick visual testing */
  const [devResizeMode, setDevResizeMode] = useState<'cover' | 'contain'>('cover');

  const posesQuery = useQuery<AnalyzablePoseMeta[]>({
    queryKey: ['analyzable-poses'],
    queryFn: async () => {
      const res = await api.get<YogaApiResponse<AnalyzablePoseMeta[]>>('/api/v1/yoga/poses/analyzable');
      return res.data.data;
    },
    enabled: authReady,
    staleTime: 10 * 60 * 1000,
  });

  const userPoses = useMemo(
    () => filterAnalyzablePosesForUser(posesQuery.data ?? []),
    [posesQuery.data],
  );

  const bodyPoses = useMemo(
    () => userPoses.filter(p => !p.analysis_kind || p.analysis_kind === 'body'),
    [userPoses],
  );
  const facePoses = useMemo(
    () => userPoses.filter(p => p.analysis_kind === 'face'),
    [userPoses],
  );
  const faceHandPoses = useMemo(
    () => userPoses.filter(p => p.analysis_kind === 'face_hand'),
    [userPoses],
  );

  useEffect(() => {
    if (selectedPoseId && !userPoses.some(p => p.pose_id === selectedPoseId)) {
      setSelectedPoseId(null);
    }
  }, [userPoses, selectedPoseId]);

  const {
    selectedPose,
    isPoseDetailLoading,
    rulesRef,
    rulesOriginRef,
    rulesSourceUi,
  } = usePoseDetailAndRules(selectedPoseId);

  const analysisKind = useMemo(
    () =>
      resolveExerciseAnalysisKind(
        selectedPoseId ?? '',
        selectedPose?.analysis_kind,
      ),
    [selectedPose?.analysis_kind, selectedPoseId],
  );

  const isFaceExercise = analysisKind === 'face';
  const isFaceHandExercise = analysisKind === 'face_hand';
  const isFaceMode = isFaceExercise || isFaceHandExercise;
  const isBodyExercise = analysisKind === 'body';
  const isRepExercise = isFaceMode;
  const isTimedExercise = isBodyExercise;
  const isAnalyzing = screenState === 'active';

  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  /** Önizleme: 1 = tam kadraj; <1 = daha “uzak” (küçük görüntü). ML tam çözünürlükte kalır. */
  const [previewScale, setPreviewScale] = useState<number>(1);
  const [instructionCardWidth, setInstructionCardWidth] = useState(
    () => Dimensions.get('window').width - spacing.base * 2,
  );
  const [instructionPageIndex, setInstructionPageIndex] = useState(0);
  const [showPoseRuleDetails, setShowPoseRuleDetails] = useState(false);

  const debugFrameCountRef = useRef(0);
  const DEBUG_MAX_FRAMES = 10;

  const overlayLayoutRef = useRef({ w: 0, h: 0 });
  const selectedPoseIdRef = useRef<string | null>(null);
  const formatVideoRef = useRef<{ vw: number; vh: number } | null>(null);
  const devResizeModeRef = useRef<'cover' | 'contain'>('cover');

  const onDevAnalyzeFrame = useCallback(
    (payload: {
      bundle: VisionPoseBundle;
      smoothedPoints: LandmarkPoint[];
      analyze: AnalyzeResult;
    }) => {
      if (!__DEV__) return;
      if (debugFrameCountRef.current >= DEBUG_MAX_FRAMES) return;
      debugFrameCountRef.current++;
      const fc = debugFrameCountRef.current;
      const { bundle, smoothedPoints, analyze: analyzeJustComputed } = payload;

      const pick = (pts: LandmarkPoint[], idx: number) =>
        pts.find(l => l.index === idx);
      const fmt = (p: LandmarkPoint | undefined) =>
        p
          ? `x=${p.x.toFixed(4)} y=${p.y.toFixed(4)} vis=${p.visibility.toFixed(3)}`
          : 'N/A';

      const rawPts = bundle.points;
      console.log(`\n[YogAI.Debug] Frame ${fc}/${DEBUG_MAX_FRAMES}`);
      console.log(`  Raw  R.shoulder(12): ${fmt(pick(rawPts, 12))}`);
      console.log(`  Raw  R.elbow(14):    ${fmt(pick(rawPts, 14))}`);
      console.log(`  Raw  R.wrist(16):    ${fmt(pick(rawPts, 16))}`);
      console.log(`  Raw  R.hip(24):      ${fmt(pick(rawPts, 24))}`);
      console.log(`  Smooth R.shoulder:   ${fmt(pick(smoothedPoints, 12))}`);
      console.log(`  Smooth R.elbow:      ${fmt(pick(smoothedPoints, 14))}`);

      analyzeJustComputed.rules.forEach(r => {
        console.log(
          `  Rule "${r.ruleId}": angle=${r.angleDegrees.toFixed(1)}° [${r.angleMin}–${r.angleMax}] score=${r.scorePercent.toFixed(0)}% status=${r.status}`,
        );
      });
      console.log(`  OVERALL: ${analyzeJustComputed.accuracyPercent.toFixed(1)}%`);

      if (fc === DEBUG_MAX_FRAMES) {
        console.log('\n[YogAI.Debug] 10 frame dump complete. Debug logging stopped.');
      }
    },
    [],
  );

  useEffect(() => {
    selectedPoseIdRef.current = selectedPoseId;
  }, [selectedPoseId]);

  useEffect(() => {
    devResizeModeRef.current = devResizeMode;
  }, [devResizeMode]);

  const device = useCameraDevice(cameraFacing);
  const cameraReady = Boolean(device && overlaySize.width > 0 && isAnalyzing);

  const exerciseAnalysis = useExerciseAnalysis({
    poseId: selectedPoseId ?? '',
    analysisKind,
    repTarget: selectedPose?.rep_target,
    active: isAnalyzing && isFaceMode,
    cameraReady,
    cameraFacing,
  });

  const handDebugRef = useRef(0);
  useEffect(() => {
    if (!__DEV__ || !isFaceHandExercise) return;
    const hf = exerciseAnalysis.handFrame;
    if (!hf) return;
    const now = Date.now();
    if (now - handDebugRef.current < 1200) return;
    handDebugRef.current = now;
    const first = hf.hands[0];
    console.log('[HAND_DEBUG]', {
      handsCount: hf.hands.length,
      firstHandLandmarks: first?.landmarks?.length ?? 0,
      handReady: hf.handReady,
      nativeHandCount: hf.nativeHandCount,
    });
  }, [isFaceHandExercise, exerciseAnalysis.handFrame]);

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

  const { frameProcessor: faceHandFrameProcessor } = useCombinedFaceHandVisionPipeline({
    active: isAnalyzing && isFaceMode,
    enableHands: isFaceHandExercise,
    cameraFacing,
  });

  const { frameProcessor, lastResultRef, resetSmoothers, fpsCountRef } =
    usePoseVisionPipeline({
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
      onDevAnalyzeFrame: __DEV__ ? onDevAnalyzeFrame : undefined,
    });

  useEffect(() => {
    debugFrameCountRef.current = 0;
    resetSmoothers();
    exerciseAnalysis.resetCounters();
    setCompletedReps(null);
  }, [exerciseAnalysis.resetCounters, selectedPoseId, resetSmoothers]);

  useEffect(() => {
    if (!isRepExercise || !isAnalyzing || !exerciseAnalysis.isRepComplete) return;
    setCompletedReps(exerciseAnalysis.repResult?.reps ?? 0);
    setScreenState('completed');
  }, [exerciseAnalysis.isRepComplete, exerciseAnalysis.repResult?.reps, isAnalyzing, isRepExercise]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsTimerActive(false);
  }, []);

  useEffect(() => {
    if (!isTimerActive) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopTimer();
          setCompletedAccuracy(lastResultRef.current?.accuracyPercent ?? null);
          setScreenState('completed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerActive, stopTimer]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const previewScaleSafe = Math.max(previewScale, 0.05);
  const previewInnerW =
    overlaySize.width > 0 ? overlaySize.width / previewScaleSafe : 0;
  const previewInnerH =
    overlaySize.height > 0 ? overlaySize.height / previewScaleSafe : 0;

  const coverCropTransform = useMemo(() => {
    if (devResizeMode !== 'cover' || !frameInfo || previewInnerW <= 0) {
      return undefined;
    }
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
  }, [
    devResizeMode,
    frameInfo?.w,
    frameInfo?.h,
    frameInfo?.orientation,
    previewInnerW,
    previewInnerH,
  ]);

  const containFitTransform = useMemo(() => {
    if (devResizeMode !== 'contain' || !frameInfo || previewInnerW <= 0) {
      return undefined;
    }
    const { contentW, contentH } = getPreviewContentExtent(
      frameInfo.w,
      frameInfo.h,
      frameInfo.orientation,
    );
    return computeContainFitTransform(
      previewInnerW,
      previewInnerH,
      contentW,
      contentH,
    );
  }, [
    devResizeMode,
    frameInfo?.w,
    frameInfo?.h,
    frameInfo?.orientation,
    previewInnerW,
    previewInnerH,
  ]);

  const showFullBodyWarning = useMemo(
    () => (isBodyExercise ? shouldWarnFullBodyLandmarks(landmarks) : false),
    [isBodyExercise, landmarks],
  );

  const handleStart = () => {
    if (!selectedPoseId) return;
    setScreenState('active');
    setLandmarks([]);
    setAnalyzeResult(null);
    resetSmoothers();
    debugFrameCountRef.current = 0;
    lastResultRef.current = null;
    setCompletedAccuracy(null);
    setCompletedReps(null);
    exerciseAnalysis.resetCounters();
    if (isTimedExercise) {
      setTimeLeft(POSE_DURATION);
      setIsTimerActive(true);
    } else {
      setTimeLeft(0);
      setIsTimerActive(false);
    }
  };

  const handleStop = () => {
    stopTimer();
    resetSmoothers();
    setScreenState('pose_selection');
    setTimeLeft(POSE_DURATION);
    setLandmarks([]);
    setAnalyzeResult(null);
    exerciseAnalysis.resetCounters();
    setCompletedReps(null);
    fpsCountRef.current = 0;
    setFps(0);
  };

  const handleTryAnother = () => {
    stopTimer();
    setScreenState('pose_selection');
    setTimeLeft(POSE_DURATION);
    setCompletedAccuracy(null);
    setCompletedReps(null);
    exerciseAnalysis.resetCounters();
  };

  const onCameraLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    overlayLayoutRef.current = { w: width, h: height };
    setOverlaySize({ width, height });
  };

  const targetPercentDisplay = useMemo(() => {
    if (!analyzeResult || analyzeResult.rules.length === 0) return null;
    const targets = analyzeResult.rules.filter(r => r.ruleType === 'target');
    if (targets.length === 0) return null;
    const avg =
      targets.reduce((s, r) => s + r.scorePercent, 0) / targets.length;
    return Math.round(avg * 10) / 10;
  }, [analyzeResult]);

  if (device == null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.permissionContainer}>
          <MaterialCommunityIcons name="camera-off" size={64} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>Kamera bulunamadı</Text>
          <Text style={styles.permissionDesc}>
            {cameraFacing === 'front' ? 'Ön kamera' : 'Arka kamera'} bu cihazda kullanılamıyor.
          </Text>
          <Button
            title="Geri Dön"
            onPress={() => navigation.goBack()}
            variant="outline"
            size="lg"
            fullWidth
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.permissionContainer}>
          <MaterialCommunityIcons name="camera-off" size={64} color={colors.textMuted} />
          <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
          <Text style={styles.permissionDesc}>
            Yoga pozlarınızı analiz etmek için kamera erişimine ihtiyacımız var.
          </Text>
          <Button
            title="İzin Ver"
            onPress={() => void requestPermission()}
            variant="primary"
            size="lg"
            fullWidth
            accessibilityLabel="Kamera iznine izin ver"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'completed') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={[styles.completedContainer, { paddingBottom: insets.bottom + spacing.base }]}>
          <MaterialCommunityIcons name="check-circle" size={72} color={colors.success} />
          <Text style={styles.completedTitle}>Poz Tamamlandı!</Text>
          {selectedPose && (
            <Text style={styles.completedPoseName}>
              {locale === 'tr' ? (selectedPose.name_tr || selectedPose.name_en) : (selectedPose.name_en || selectedPose.name_tr)}
            </Text>
          )}
          {completedReps != null ? (
            <Text style={styles.completedDuration}>
              Tekrar: {completedReps} / {exerciseAnalysis.repResult?.target ?? selectedPose?.rep_target ?? completedReps}
            </Text>
          ) : (
            <Text style={styles.completedDuration}>Süre: {POSE_DURATION} saniye</Text>
          )}
          {completedAccuracy != null && completedReps == null && (
            <Text style={styles.completedAccuracy}>
              Son doğruluk: {completedAccuracy.toFixed(1)}%
            </Text>
          )}

          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              ML Kit vücut tespiti ve kural skorları gerçek zamanlı uygulandı. Antrenman akışında da aynı
              mantık kullanılabilir.
            </Text>
          </View>

          <View style={styles.completedActions}>
            <Button
              title="Başka Poz Dene"
              onPress={handleTryAnother}
              variant="primary"
              size="lg"
              fullWidth
              icon="refresh"
              accessibilityLabel="Başka poz dene"
            />
            <Button
              title="Geri Dön"
              onPress={() => navigation.goBack()}
              variant="outline"
              size="lg"
              fullWidth
              icon="arrow-left"
              accessibilityLabel="Geri dön"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'active') {
    const acc = analyzeResult?.accuracyPercent ?? 0;
    const accTint = accuracyColor(acc);

    return (
      <View style={styles.cameraFullScreen} onLayout={onCameraLayout}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
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
                isActive={isAnalyzing}
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
            completionCountdown={null}
            onRetry={() => exerciseAnalysis.resetCounters()}
          />
        )}

        <View style={[styles.cameraControlsRow, { top: insets.top + spacing.sm }]}>
          <TouchableOpacity
            style={styles.cameraControlChip}
            onPress={() => setCameraFacing(f => (f === 'front' ? 'back' : 'front'))}
            accessibilityRole="button"
            accessibilityLabel={cameraFacing === 'front' ? 'Arka kameraya geç' : 'Ön kameraya geç'}
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
                style={[
                  styles.zoomChip,
                  previewScale === z.scale && styles.zoomChipActive,
                ]}
                onPress={() => setPreviewScale(z.scale)}
                accessibilityRole="button"
                accessibilityLabel={`Önizleme ${z.label}`}
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

        {isBodyExercise && (
          <View style={[styles.fpsPill, { top: insets.top + spacing.sm + 44 }]}> 
            <Text style={styles.fpsText}>FPS: {fps}</Text>
          </View>
        )}

        {isTimedExercise && (
          <View style={[styles.timerOverlay, { top: insets.top + spacing.sm + 88 }]}> 
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          </View>
        )}

        {showFullBodyWarning && (
          <View
            style={[styles.fullBodyWarningBanner, { top: insets.top + spacing.sm + 148 }]}
            accessibilityRole="alert"
          >
            <MaterialCommunityIcons name="arrow-expand-all" size={24} color="#1a1a1a" />
            <Text style={styles.fullBodyWarningText}>
              Kalça veya dizler net görünmüyor. Telefonu biraz uzaklaştırın veya tüm vücudu kadraja
              alın.
            </Text>
          </View>
        )}

        {isFaceMode && isAnalyzing && selectedPose ? (
          <View
            style={[
              styles.faceActiveFooter,
              { paddingBottom: insets.bottom + spacing.sm },
            ]}
          >
            <Text style={styles.activePoseName} numberOfLines={1}>
              Poz:{' '}
              {locale === 'tr'
                ? selectedPose.name_tr || selectedPose.name_en
                : selectedPose.name_en || selectedPose.name_tr}
            </Text>
            <Button
              title="Durdur"
              onPress={handleStop}
              variant="danger"
              size="lg"
              fullWidth
              icon="stop-circle-outline"
              accessibilityLabel="Antrenmanı durdur"
            />
          </View>
        ) : null}

        {!isFaceMode && (
        <ScrollView
          style={styles.accuracyScroll}
          contentContainerStyle={[
            styles.accuracyScrollContent,
            { paddingBottom: insets.bottom + spacing.base },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {isBodyExercise && SHOW_VERBOSE_RULES_BANNER ? (
            <RulesSourceBanner state={rulesSourceUi} />
          ) : null}

          {isBodyExercise && (
            <View style={styles.accuracyPanel}>
              <Text style={styles.accuracyLabel}>Accuracy</Text>
              <Text style={[styles.accuracyPercent, { color: accTint }]}> 
                {analyzeResult ? `${acc.toFixed(1)}%` : '—'}
              </Text>
              <View style={[styles.progressTrack, { borderColor: accTint }]}> 
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, Math.max(0, acc))}%`,
                      backgroundColor: accTint,
                    },
                  ]}
                />
              </View>
              {analyzeResult && (
                <Text style={styles.targetRow}>
                  Hedef (kural ort.):{' '}
                  {targetPercentDisplay != null ? `${targetPercentDisplay.toFixed(1)}%` : '—'} | Fault: −
                  {analyzeResult.faultPenaltyTotal.toFixed(1)}%
                </Text>
              )}
            </View>
          )}

          {isBodyExercise && analyzeResult && analyzeResult.rules.length > 0 ? (
            <TouchableOpacity
              style={styles.ruleDetailsToggle}
              onPress={() => setShowPoseRuleDetails(v => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPoseRuleDetails ? 'Kural detaylarını gizle' : 'Kural detaylarını göster'}
            >
              <MaterialCommunityIcons
                name={showPoseRuleDetails ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.text}
              />
              <Text style={styles.ruleDetailsToggleText}>
                {showPoseRuleDetails ? 'Kural detaylarını gizle' : 'Kural detaylarını göster (geliştirici)'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {isBodyExercise && showPoseRuleDetails && analyzeResult && analyzeResult.rules.length > 0 && (
            <View style={styles.rulesCard}>
              {analyzeResult.rules.map(rule => {
                const border =
                  rule.status === 'good'
                    ? colors.success
                    : rule.status === 'needs_improvement'
                      ? colors.warning
                      : rule.status === 'low_visibility'
                        ? colors.textMuted
                        : colors.error;
                const iconName: RuleListIconName =
                  rule.status === 'good'
                    ? 'check-circle'
                    : rule.status === 'needs_improvement'
                      ? 'alert'
                      : rule.status === 'low_visibility'
                        ? 'eye-off'
                        : 'close-circle';
                const feedback = locale === 'tr'
                  ? (rule.feedbackTr || rule.feedbackEn || '')
                  : (rule.feedbackEn || rule.feedbackTr || '');
                return (
                  <View key={rule.ruleId} style={[styles.ruleRow, { borderLeftColor: border }]}> 
                    <View style={styles.ruleRowHeader}>
                      <MaterialCommunityIcons name={iconName} size={20} color={border} />
                      <Text style={styles.ruleTitle}>{rule.ruleId}</Text>
                      <Text style={styles.ruleAngle}>
                        {rule.angleDegrees.toFixed(1)}° [{rule.angleMin}–{rule.angleMax}°] →{' '}
                        {rule.scorePercent.toFixed(0)}%
                      </Text>
                    </View>
                    {rule.status === 'fault_detected' && rule.penaltyPercent != null && (
                      <Text style={styles.ruleFault}>Fault! −{rule.penaltyPercent}%</Text>
                    )}
                    {feedback.length > 0 && rule.status !== 'good' && (
                      <Text style={styles.ruleFeedback}>{feedback}</Text>
                    )}
                    {rule.status === 'low_visibility' && feedback.length === 0 && (
                      <Text style={styles.ruleFeedback}>Görünmüyor — aydınlatma / mesafe</Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {isBodyExercise && __DEV__ && (
            <View style={styles.devRow}>
              <Text style={styles.devLabel}>Geliştirici: landmark görünürlük</Text>
              <Switch value={showDevDebug} onValueChange={setShowDevDebug} />
            </View>
          )}

          {isBodyExercise && __DEV__ && (
            <View style={styles.devRow}>
              <Text style={styles.devLabel}>resizeMode: {devResizeMode}</Text>
              <Switch
                value={devResizeMode === 'contain'}
                onValueChange={v => setDevResizeMode(v ? 'contain' : 'cover')}
              />
            </View>
          )}

          {isBodyExercise && __DEV__ && showDevDebug && frameInfo && (
            <View style={styles.devCard}>
              <Text style={styles.devCardTitle}>[DEV] Frame Info</Text>
              <Text style={styles.devLine}>
                frame: {frameInfo.w}×{frameInfo.h}  orient: {frameInfo.orientation}  mirror: {String(frameInfo.isMirrored)}
              </Text>
              <Text style={styles.devLine}>
                overlay: {overlaySize.width.toFixed(0)}×{overlaySize.height.toFixed(0)}  mode: {devResizeMode}
              </Text>
              {frameInfo.rawBounds && (
                <Text style={styles.devLine}>
                  raw lm X: [{frameInfo.rawBounds.minX.toFixed(0)}–{frameInfo.rawBounds.maxX.toFixed(0)}]  Y: [{frameInfo.rawBounds.minY.toFixed(0)}–{frameInfo.rawBounds.maxY.toFixed(0)}]
                </Text>
              )}
            </View>
          )}

          {isBodyExercise && __DEV__ && showDevDebug && landmarks.length > 0 && (
            <View style={styles.devCard}>
              <Text style={styles.devCardTitle}>[DEV] Landmark visibility</Text>
              {landmarks.map(lm => {
                const ok = lm.visibility >= VISIBILITY_DEBUG_THRESHOLD;
                return (
                  <Text key={lm.index} style={styles.devLine}>
                    {lm.index} ({landmarkDebugName(lm.index)}): {lm.visibility.toFixed(2)}{' '}
                    {ok ? '✓' : '✗'} (&lt; {VISIBILITY_DEBUG_THRESHOLD})
                  </Text>
                );
              })}
            </View>
          )}

          {selectedPose && (
            <View style={styles.activeFooter}>
              <Text style={styles.activePoseName} numberOfLines={1}>
                Poz: {locale === 'tr' ? (selectedPose.name_tr || selectedPose.name_en) : (selectedPose.name_en || selectedPose.name_tr)}
              </Text>
              <Button
                title="Durdur"
                onPress={handleStop}
                variant="danger"
                size="lg"
                fullWidth
                icon="stop-circle-outline"
                accessibilityLabel="Antrenmanı durdur"
              />
            </View>
          )}
        </ScrollView>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Poz Testi</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={styles.instructionCardOuter}
          onLayout={e => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setInstructionCardWidth(w);
          }}
        >
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
              const w = instructionCardWidth || 1;
              const ix = Math.round(e.nativeEvent.contentOffset.x / w);
              setInstructionPageIndex(Math.min(1, Math.max(0, ix)));
            }}
          >
            <View style={[styles.instructionPage, { width: instructionCardWidth }]}>
              {!selectedPoseId ? (
                <>
                  <MaterialCommunityIcons name="gesture-tap" size={40} color={colors.textMuted} />
                  <Text style={styles.instructionCardTitle}>Poz seçin</Text>
                  <Text style={styles.instructionCardBody}>
                    Aşağıdan bir poz seçerek talimatları burada göreceksin. Ardından kamerayı açıp
                    pratik yapabilirsin.
                  </Text>
                </>
              ) : isPoseDetailLoading ? (
                <>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.instructionCardBody}>Talimatlar yükleniyor…</Text>
                </>
              ) : selectedPose ? (
                <>
                  <Text style={styles.instructionCardTitle}>
                    {locale === 'tr' ? (selectedPose.name_tr || selectedPose.name_en) : (selectedPose.name_en || selectedPose.name_tr)}
                  </Text>
                  <DifficultyDots level={selectedPose.difficulty} />
                  {(selectedPose.instructions_tr || selectedPose.instructions_en) ? (
                    <Text style={styles.instructionCardBodyFull}>
                      {locale === 'tr' ? (selectedPose.instructions_tr || selectedPose.instructions_en) : (selectedPose.instructions_en || selectedPose.instructions_tr)}
                    </Text>
                  ) : (
                    <Text style={styles.instructionCardBody}>Bu poz için talimat metni yok.</Text>
                  )}
                </>
              ) : (
                <Text style={styles.instructionCardBody}>Poz detayı alınamadı.</Text>
              )}
            </View>
            <View style={[styles.instructionPage, styles.motionPreviewPage, { width: instructionCardWidth }]}>
              <MaterialCommunityIcons name="animation-play" size={40} color={colors.textMuted} />
              <Text style={styles.motionPreviewTitle}>Hareket önizlemesi</Text>
              <Text style={styles.motionPreviewHint}>
                Yakında: GIF veya animasyon ile pozu buradan kaydırarak izleyebileceksin.
              </Text>
            </View>
          </ScrollView>
          <View style={styles.carouselDots}>
            {[0, 1].map(i => (
              <View
                key={i}
                style={[styles.carouselDot, instructionPageIndex === i && styles.carouselDotActive]}
              />
            ))}
          </View>
        </View>

        <Text style={styles.sectionLabel}>Poz Seçin</Text>

        {posesQuery.isLoading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Pozlar yükleniyor...</Text>
          </View>
        )}

        {posesQuery.isError && (
          <View style={styles.errorRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.error} />
            <Text style={styles.errorText}>Pozlar yüklenemedi. Tekrar deneyin.</Text>
          </View>
        )}

        {!posesQuery.isLoading && userPoses.length === 0 && (
          <Text style={styles.emptyText}>Analiz edilebilir poz bulunamadı.</Text>
        )}

        {bodyPoses.length > 0 && (
          <View style={styles.poseSection}>
            <Text style={styles.poseSectionTitle}>Vucut Yogasi</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipList}
            >
              {bodyPoses.map(pose => {
                const isSelected = selectedPoseId === pose.pose_id;
                return (
                  <TouchableOpacity
                    key={pose.pose_id}
                    onPress={() => setSelectedPoseId(pose.pose_id)}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={locale === 'tr' ? (pose.name_tr || pose.name_en) : (pose.name_en || pose.name_tr)}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {locale === 'tr' ? (pose.name_tr || pose.name_en) : (pose.name_en || pose.name_tr)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {facePoses.length > 0 && (
          <View style={styles.poseSection}>
            <Text style={styles.poseSectionTitle}>Yuz Yogasi</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipList}
            >
              {facePoses.map(pose => {
                const isSelected = selectedPoseId === pose.pose_id;
                return (
                  <TouchableOpacity
                    key={pose.pose_id}
                    onPress={() => setSelectedPoseId(pose.pose_id)}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={locale === 'tr' ? (pose.name_tr || pose.name_en) : (pose.name_en || pose.name_tr)}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {locale === 'tr' ? (pose.name_tr || pose.name_en) : (pose.name_en || pose.name_tr)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {faceHandPoses.length > 0 && (
          <View style={styles.poseSection}>
            <Text style={styles.poseSectionTitle}>Elle Yuz Yogasi</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipList}
            >
              {faceHandPoses.map(pose => {
                const isSelected = selectedPoseId === pose.pose_id;
                return (
                  <TouchableOpacity
                    key={pose.pose_id}
                    onPress={() => setSelectedPoseId(pose.pose_id)}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    accessibilityRole="button"
                    accessibilityLabel={locale === 'tr' ? (pose.name_tr || pose.name_en) : (pose.name_en || pose.name_tr)}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {locale === 'tr' ? (pose.name_tr || pose.name_en) : (pose.name_en || pose.name_tr)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {selectedPoseId && SHOW_VERBOSE_RULES_BANNER && isBodyExercise ? (
          <RulesSourceBanner state={rulesSourceUi} />
        ) : null}

        {isPoseDetailLoading && selectedPoseId && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingText}>Poz detayı yükleniyor...</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.startButtonBar, { paddingBottom: Math.max(insets.bottom, spacing.base) }]}>
        <Button
          title="Kamerayı Aç ve Başla"
          onPress={handleStart}
          variant="primary"
          size="lg"
          fullWidth
          icon="camera-outline"
          disabled={!selectedPoseId || isPoseDetailLoading}
          accessibilityLabel="Kamerayı aç ve antrenmanı başlat"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  backButton: {
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  headerTitle: {
    ...typography.h4,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    gap: spacing.base,
  },
  instructionCardOuter: {
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  instructionPage: {
    minHeight: 220,
    padding: spacing.base,
    gap: spacing.sm,
    justifyContent: 'flex-start',
  },
  motionPreviewPage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  instructionCardTitle: {
    ...typography.h4,
    color: colors.text,
  },
  instructionCardBody: {
    ...typography.bodySm,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  instructionCardBodyFull: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  motionPreviewTitle: {
    ...typography.bodySmMedium,
    color: colors.text,
  },
  motionPreviewHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  carouselDotActive: {
    backgroundColor: colors.primary,
    width: 14,
  },
  cameraClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  cameraZoomInner: {
    position: 'absolute',
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
  zoomChips: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
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
  zoomChipTextActive: {
    color: colors.textOnDark,
  },
  ruleDetailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(248,247,244,0.92)',
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  ruleDetailsToggleText: {
    ...typography.bodySmMedium,
    color: colors.text,
    flex: 1,
  },
  sectionLabel: {
    ...typography.h4,
    color: colors.text,
    marginTop: spacing.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  errorText: {
    ...typography.bodySm,
    color: colors.error,
  },
  emptyText: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  chipList: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  poseSection: {
    gap: spacing.sm,
  },
  poseSectionTitle: {
    ...typography.bodySmMedium,
    color: colors.textSecondary,
  },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.bodySmMedium,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.textOnPrimary,
  },
  repCounterContainer: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  repText: {
    ...typography.h1,
    color: colors.textOnDark,
  },
  repPulse: {
    color: colors.success,
    transform: [{ scale: 1.05 }],
  },
  repLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.success,
  },
  barContainer: {
    gap: spacing.xs,
    padding: spacing.base,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  barLabel: {
    ...typography.bodySmMedium,
    color: colors.textOnDark,
  },
  barBg: {
    height: 10,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  thresholdLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  faceFeedback: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.base,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  faceFeedbackText: {
    ...typography.bodySmMedium,
    color: colors.textOnDark,
  },
  faceWarning: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255, 243, 224, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.35)',
  },
  faceWarningText: {
    ...typography.bodySmMedium,
    color: colors.warningDark,
    textAlign: 'center',
  },
  poseDetailCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.sm,
  },
  poseDetailHeader: {
    gap: spacing.xs,
  },
  poseDetailName: {
    ...typography.h4,
    color: colors.text,
  },
  poseDetailInstruction: {
    ...typography.bodySm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  rulesSourceBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.base,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rulesSourceBannerApi: {
    backgroundColor: 'rgba(45, 139, 94, 0.12)',
    borderColor: 'rgba(45, 139, 94, 0.35)',
  },
  rulesSourceBannerWarn: {
    backgroundColor: 'rgba(200, 138, 0, 0.14)',
    borderColor: 'rgba(200, 138, 0, 0.45)',
  },
  rulesSourceBannerMuted: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderLight,
  },
  rulesSourceBannerError: {
    backgroundColor: 'rgba(200, 60, 60, 0.08)',
    borderColor: 'rgba(200, 60, 60, 0.35)',
  },
  rulesSourceBannerTextCol: {
    flex: 1,
    gap: spacing.xs,
  },
  rulesSourceBannerTitle: {
    ...typography.bodySmMedium,
    color: colors.text,
  },
  rulesSourceBannerMono: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
  },
  rulesSourceBannerHint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  rulesSourceBannerText: {
    ...typography.bodySm,
    color: colors.textSecondary,
    flex: 1,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  startButtonBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.base,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.base,
  },
  permissionTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
  },
  permissionDesc: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  cameraFullScreen: {
    flex: 1,
    backgroundColor: colors.text,
  },
  fpsPill: {
    position: 'absolute',
    left: spacing.base,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  fpsText: {
    ...typography.bodySmMedium,
    color: colors.textOnDark,
    fontVariant: Platform.OS === 'ios' ? ['tabular-nums'] : undefined,
  },
  timerOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  timerText: {
    ...typography.h2,
    color: colors.textOnDark,
    fontVariant: Platform.OS === 'ios' ? ['tabular-nums'] : undefined,
  },
  hipWarningBanner: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  hipWarningText: {
    ...typography.bodySmMedium,
    color: colors.textOnDark,
    flex: 1,
    lineHeight: 20,
  },
  fullBodyWarningBanner: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 224, 130, 0.95)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderWidth: 2,
    borderColor: 'rgba(200, 138, 0, 0.65)',
  },
  fullBodyWarningText: {
    ...typography.bodySmMedium,
    color: '#1a1a1a',
    flex: 1,
    lineHeight: 20,
  },
  accuracyScroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '52%',
  },
  accuracyScrollContent: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  accuracyPanel: {
    backgroundColor: 'rgba(248,247,244,0.88)',
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(45,139,94,0.35)',
    gap: spacing.xs,
  },
  accuracyLabel: {
    ...typography.bodySmMedium,
    color: colors.textSecondary,
  },
  accuracyPercent: {
    ...typography.h2,
    fontVariant: Platform.OS === 'ios' ? ['tabular-nums'] : undefined,
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  targetRow: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  rulesCard: {
    backgroundColor: 'rgba(248,247,244,0.9)',
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  ruleRow: {
    borderLeftWidth: 4,
    paddingLeft: spacing.sm,
    gap: spacing.xs,
  },
  ruleRowHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ruleTitle: {
    ...typography.bodySmMedium,
    color: colors.text,
    flex: 1,
    minWidth: 120,
  },
  ruleAngle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    flexBasis: '100%',
  },
  ruleFault: {
    ...typography.bodySmMedium,
    color: colors.error,
  },
  ruleFeedback: {
    ...typography.bodySm,
    color: colors.text,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(248,247,244,0.85)',
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  devLabel: {
    ...typography.bodySm,
    color: colors.text,
  },
  devCard: {
    backgroundColor: 'rgba(30,30,30,0.85)',
    padding: spacing.base,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  devCardTitle: {
    ...typography.bodySmMedium,
    color: colors.textOnDark,
    marginBottom: spacing.xs,
  },
  devLine: {
    ...typography.bodySm,
    color: colors.textOnDark,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  faceActiveFooter: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    bottom: 0,
    zIndex: 22,
    gap: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  activeFooter: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  activePoseName: {
    ...typography.h4,
    color: colors.textOnDark,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  completedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.base,
  },
  completedTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  completedPoseName: {
    ...typography.h4,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  completedDuration: {
    ...typography.body,
    color: colors.textMuted,
  },
  completedAccuracy: {
    ...typography.h4,
    color: colors.primary,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    width: '100%',
  },
  infoText: {
    ...typography.bodySm,
    flex: 1,
    lineHeight: 20,
  },
  completedActions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});

export default CameraTestScreen;
