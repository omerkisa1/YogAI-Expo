import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutChangeEvent,
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
  Camera,
  runAtTargetFps,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import type { Orientation } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { detectPose } from 'vision-camera-pose-detector';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import api from '@/shared/api/axiosInstance';
import Button from '@/shared/components/Button';
import {
  SkeletonOverlay,
  computeCoverCropTransform,
  type CoverCropTransform,
} from '@/shared/components/SkeletonOverlay';
import type { RootStackParamList } from '@/navigation/types';
import {
  analyzePoseClientSide,
  type AnalyzeResult,
  type LandmarkPoint,
  parseLandmarkRules,
  type LandmarkRule,
} from '@/lib/poseAnalyzer';
import {
  landmarksFromDetector,
  rawLandmarkBounds,
  POSE_LANDMARK_KEYS,
} from '@/lib/poseLandmarks';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'CameraTest'>;

type AnalyzablePose = {
  pose_id: string;
  name_en: string;
  name_tr: string;
  difficulty: number;
  is_analyzable: boolean;
  instructions_en: string;
  instructions_tr: string;
  category: string;
  landmark_rules?: unknown;
  landmarkRules?: unknown;
};

type AnalyzablePoseMeta = {
  pose_id: string;
  name_en: string;
  name_tr: string;
  difficulty: number;
  is_analyzable: boolean;
};

type ApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};

type ScreenState = 'pose_selection' | 'active' | 'completed';

const POSE_DURATION = 30;
const ANALYZE_THROTTLE_MS = 150;
const ML_TARGET_FPS = 10;
const VISIBILITY_DEBUG_THRESHOLD = 0.65;

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

  const rulesRef = useRef<LandmarkRule[]>([]);
  const lastAnalyzeAtRef = useRef(0);
  const lastResultRef = useRef<AnalyzeResult | null>(null);
  const fpsCountRef = useRef(0);
  const fpsLastTickRef = useRef(Date.now());

  const posesQuery = useQuery<AnalyzablePoseMeta[]>({
    queryKey: ['analyzable-poses'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AnalyzablePoseMeta[]>>('/api/v1/yoga/poses/analyzable');
      return res.data.data;
    },
  });

  const poseDetailQuery = useQuery<AnalyzablePose>({
    queryKey: ['pose-detail', selectedPoseId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<AnalyzablePose>>(`/api/v1/yoga/poses/${selectedPoseId}`);
      return res.data.data;
    },
    enabled: !!selectedPoseId,
  });

  const selectedPose = poseDetailQuery.data;

  useEffect(() => {
    rulesRef.current = parseLandmarkRules(
      selectedPose?.landmark_rules ?? selectedPose?.landmarkRules,
    );
  }, [selectedPose?.landmark_rules, selectedPose?.landmarkRules]);

  const device = useCameraDevice('front');
  const screen = Dimensions.get('window');
  const format = useCameraFormat(device, [
    { fps: 30 },
    { videoAspectRatio: screen.height / screen.width },
  ]);

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

  const onFrameInfoFromWorklet = useRunOnJS(
    (info: {
      w: number;
      h: number;
      orientation: Orientation;
      isMirrored: boolean;
      rawBounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
    }) => {
      setFrameInfo(info);
    },
    [],
  );

  const onPoseFromWorklet = useRunOnJS((points: LandmarkPoint[]) => {
    setLandmarks(points);

    const now = Date.now();
    fpsCountRef.current += 1;
    if (now - fpsLastTickRef.current >= 1000) {
      setFps(fpsCountRef.current);
      fpsCountRef.current = 0;
      fpsLastTickRef.current = now;
    }

    const rules = rulesRef.current;
    if (points.length === 0 || rules.length === 0) {
      setAnalyzeResult(null);
      lastResultRef.current = null;
      return;
    }

    if (now - lastAnalyzeAtRef.current >= ANALYZE_THROTTLE_MS) {
      lastAnalyzeAtRef.current = now;
      const result = analyzePoseClientSide(rules, points);
      lastResultRef.current = result;
      setAnalyzeResult(result);
    }
  }, []);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      runAtTargetFps(ML_TARGET_FPS, () => {
        'worklet';
        const pose = detectPose(frame);
        if (pose == null) {
          onPoseFromWorklet([]);
          onFrameInfoFromWorklet({
            w: frame.width,
            h: frame.height,
            orientation: frame.orientation,
            isMirrored: frame.isMirrored,
            rawBounds: null,
          });
          return;
        }
        const bounds = rawLandmarkBounds(pose);
        onFrameInfoFromWorklet({
          w: frame.width,
          h: frame.height,
          orientation: frame.orientation,
          isMirrored: frame.isMirrored,
          rawBounds: bounds,
        });
        const mapped = landmarksFromDetector(
          pose,
          frame.width,
          frame.height,
          frame.orientation,
          /* flipXForAnalysis */ false,
        );
        onPoseFromWorklet(mapped);
      });
    },
    [onPoseFromWorklet, onFrameInfoFromWorklet],
  );

  const isAnalyzing = screenState === 'active';

  const handleStart = () => {
    if (!selectedPoseId) return;
    setTimeLeft(POSE_DURATION);
    setScreenState('active');
    setLandmarks([]);
    setAnalyzeResult(null);
    lastResultRef.current = null;
    setCompletedAccuracy(null);
    setIsTimerActive(true);
  };

  const handleStop = () => {
    stopTimer();
    setScreenState('pose_selection');
    setTimeLeft(POSE_DURATION);
    setLandmarks([]);
    setAnalyzeResult(null);
    fpsCountRef.current = 0;
    setFps(0);
  };

  const handleTryAnother = () => {
    stopTimer();
    setScreenState('pose_selection');
    setTimeLeft(POSE_DURATION);
    setCompletedAccuracy(null);
  };

  const onCameraLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
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
          <Text style={styles.permissionDesc}>Ön kamera bu cihazda kullanılamıyor.</Text>
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
              {selectedPose.name_tr || selectedPose.name_en}
            </Text>
          )}
          <Text style={styles.completedDuration}>Süre: {POSE_DURATION} saniye</Text>
          {completedAccuracy != null && (
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
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isAnalyzing}
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
            cropTransform={
              devResizeMode === 'cover' && frameInfo
                ? computeCoverCropTransform(
                    overlaySize.width,
                    overlaySize.height,
                    frameInfo.w,
                    frameInfo.h,
                  )
                : undefined
            }
          />
        )}

        <View style={[styles.fpsPill, { top: insets.top + spacing.sm }]}>
          <Text style={styles.fpsText}>FPS: {fps}</Text>
        </View>

        <View style={[styles.timerOverlay, { top: insets.top + spacing.sm + 44 }]}>
          <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
        </View>

        <ScrollView
          style={styles.accuracyScroll}
          contentContainerStyle={[
            styles.accuracyScrollContent,
            { paddingBottom: insets.bottom + spacing.base },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
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

          {analyzeResult && analyzeResult.rules.length > 0 && (
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
                const feedback = rule.feedbackTr ?? rule.feedbackEn ?? '';
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

          {__DEV__ && (
            <View style={styles.devRow}>
              <Text style={styles.devLabel}>Geliştirici: landmark görünürlük</Text>
              <Switch value={showDevDebug} onValueChange={setShowDevDebug} />
            </View>
          )}

          {__DEV__ && (
            <View style={styles.devRow}>
              <Text style={styles.devLabel}>resizeMode: {devResizeMode}</Text>
              <Switch
                value={devResizeMode === 'contain'}
                onValueChange={v => setDevResizeMode(v ? 'contain' : 'cover')}
              />
            </View>
          )}

          {__DEV__ && showDevDebug && frameInfo && (
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

          {__DEV__ && showDevDebug && landmarks.length > 0 && (
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
                Poz: {selectedPose.name_tr || selectedPose.name_en}
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
        <View style={styles.cameraPreviewPlaceholder}>
          <MaterialCommunityIcons name="camera-outline" size={48} color={colors.textMuted} />
          <Text style={styles.placeholderText}>Poz seçin ve başlatın</Text>
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

        {posesQuery.data && posesQuery.data.length === 0 && (
          <Text style={styles.emptyText}>Analiz edilebilir poz bulunamadı.</Text>
        )}

        {posesQuery.data && posesQuery.data.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipList}
          >
            {posesQuery.data.map(pose => {
              const isSelected = selectedPoseId === pose.pose_id;
              return (
                <TouchableOpacity
                  key={pose.pose_id}
                  onPress={() => setSelectedPoseId(pose.pose_id)}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  accessibilityRole="button"
                  accessibilityLabel={pose.name_tr || pose.name_en}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {pose.name_tr || pose.name_en}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {selectedPose && (
          <View style={styles.poseDetailCard}>
            <View style={styles.poseDetailHeader}>
              <Text style={styles.poseDetailName}>
                {selectedPose.name_tr || selectedPose.name_en}
              </Text>
              <DifficultyDots level={selectedPose.difficulty} />
            </View>
            {(selectedPose.instructions_tr || selectedPose.instructions_en) ? (
              <Text style={styles.poseDetailInstruction} numberOfLines={3}>
                {selectedPose.instructions_tr || selectedPose.instructions_en}
              </Text>
            ) : null}
          </View>
        )}

        {poseDetailQuery.isLoading && selectedPoseId && (
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
          disabled={!selectedPoseId || poseDetailQuery.isLoading}
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
  cameraPreviewPlaceholder: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  placeholderText: {
    ...typography.bodySm,
    color: colors.textMuted,
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
