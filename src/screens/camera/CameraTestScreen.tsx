import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '@/shared/api/axiosInstance';
import Button from '@/shared/components/Button';
import type { RootStackParamList } from '@/navigation/types';
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

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

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

const CameraTestScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [screenState, setScreenState] = useState<ScreenState>('pose_selection');
  const [selectedPoseId, setSelectedPoseId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(POSE_DURATION);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const handleStart = () => {
    if (!selectedPoseId) return;
    setTimeLeft(POSE_DURATION);
    setScreenState('active');
    setIsTimerActive(true);
  };

  const handleStop = () => {
    stopTimer();
    setScreenState('pose_selection');
    setTimeLeft(POSE_DURATION);
  };

  const handleTryAnother = () => {
    stopTimer();
    setScreenState('pose_selection');
    setTimeLeft(POSE_DURATION);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
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

          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={18} color={colors.warning} />
            <Text style={styles.infoText}>
              Accuracy hesaplaması için landmark detection gerekli. Sonraki güncellemeyle gelecek.
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
    return (
      <View style={styles.cameraFullScreen}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <CameraView style={StyleSheet.absoluteFill} facing="front" mirror />

        <View style={[styles.timerOverlay, { top: insets.top + spacing.base }]}>
          <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
        </View>

        {selectedPose && (
          <View style={[styles.cameraBottomPanel, { paddingBottom: insets.bottom + spacing.base }]}>
            <Text style={styles.activePoseName} numberOfLines={1}>
              {selectedPose.name_tr || selectedPose.name_en}
            </Text>
            <DifficultyDots level={selectedPose.difficulty} />
            {(selectedPose.instructions_tr || selectedPose.instructions_en) ? (
              <Text style={styles.activeInstruction} numberOfLines={3}>
                {selectedPose.instructions_tr || selectedPose.instructions_en}
              </Text>
            ) : null}
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
  cameraBottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    gap: spacing.sm,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
  },
  activePoseName: {
    ...typography.h3,
    color: colors.textOnDark,
  },
  activeInstruction: {
    ...typography.bodySm,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 20,
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.warning,
    width: '100%',
  },
  infoText: {
    ...typography.bodySm,
    color: colors.warningDark,
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
