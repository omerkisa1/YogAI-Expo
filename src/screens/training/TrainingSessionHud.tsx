import React, { memo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Button from '@/shared/components/Button';
import Touchable from '@/shared/components/Touchable';
import ProgressBar from '@/shared/components/ProgressBar';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

const pillBg = 'rgba(255, 255, 255, 0.88)';
const pillBgDark = 'rgba(0, 0, 0, 0.55)';

export interface TrainingSessionHudProps {
  topInset: number;
  bottomInset: number;
  planTitle: string;
  exerciseIndex: number;
  exerciseCount: number;
  fps: number;
  showFps: boolean;
  onQuitPress: () => void;
  showCameraControls: boolean;
  cameraFacing: 'front' | 'back';
  onFlipCamera: () => void;
  previewScale: number;
  zoomPresets: readonly { scale: number; label: string }[];
  onSelectZoom: (scale: number) => void;
  showFullBodyWarning: boolean;
  sessionProgressPct: number;
  timerText: string;
  poseProgressPct: number;
  accuracyDisplay: string;
  showAccuracy: boolean;
  showNoAnalyzeHint: boolean;
  categoryLabel: string;
  categoryColor: string;
  poseName: string;
  instruction: string | null;
  nextPoseName: string | null;
  onCompletePose: () => void;
  onSkipPose: () => void;
  submitting: boolean;
}

const TrainingSessionHudInner = (props: TrainingSessionHudProps) => {
  const {
    topInset,
    bottomInset,
    planTitle,
    exerciseIndex,
    exerciseCount,
    fps,
    showFps,
    onQuitPress,
    showCameraControls,
    cameraFacing,
    onFlipCamera,
    previewScale,
    zoomPresets,
    onSelectZoom,
    showFullBodyWarning,
    sessionProgressPct,
    timerText,
    poseProgressPct,
    accuracyDisplay,
    showAccuracy,
    showNoAnalyzeHint,
    categoryLabel,
    categoryColor,
    poseName,
    instruction,
    nextPoseName,
    onCompletePose,
    onSkipPose,
    submitting,
  } = props;

  const bottomInner = (
    <View style={styles.bottomInner}>
      <ProgressBar progress={poseProgressPct} color={colors.primary} height={4} animated />
      {showAccuracy ? (
        <Text style={styles.accuracyLine}>
          Canlı skor: <Text style={styles.accuracyStrong}>{accuracyDisplay}</Text>
        </Text>
      ) : null}
      {showNoAnalyzeHint ? <Text style={styles.noAnalyzeHint}>Bu poz kamera analizi olmadan zamanlanır; skor bu adımda 0 kaydedilir.</Text> : null}
      <View style={styles.poseHeaderRow}>
        <View style={[styles.catBadge, { backgroundColor: `${categoryColor}33` }]}>
          <Text style={[styles.catBadgeText, { color: categoryColor }]}>{categoryLabel}</Text>
        </View>
        <Text style={styles.poseCountSmall}>
          {exerciseIndex + 1}/{exerciseCount}
        </Text>
      </View>
      <Text style={styles.poseName}>{poseName}</Text>
      {instruction ? (
        <Text style={styles.instruction} numberOfLines={3}>
          {instruction}
        </Text>
      ) : null}
      {nextPoseName ? (
        <Text style={styles.nextPose} numberOfLines={1}>
          Sonraki: {nextPoseName}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button title="Pozu Tamamla" onPress={onCompletePose} variant="primary" size="lg" fullWidth icon="check-circle-outline" loading={submitting} disabled={submitting} accessibilityLabel="Pozu tamamla" />
        <Button title="Pozu Atla" onPress={onSkipPose} variant="ghost" size="md" fullWidth disabled={submitting} accessibilityLabel="Pozu atla" />
      </View>
    </View>
  );

  const bottomPanel =
    Platform.OS === 'ios' ? (
      <BlurView intensity={48} tint="light" style={styles.bottomBlur}>
        {bottomInner}
      </BlurView>
    ) : (
      <View style={styles.bottomBlurAndroid}>{bottomInner}</View>
    );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.sessionProgressTrack, { top: topInset }]}>
        <ProgressBar progress={sessionProgressPct} color={colors.primary} height={3} animated />
      </View>

      <View style={[styles.topFloatingRow, { top: topInset + spacing.sm }]}>
        <Touchable onPress={onQuitPress} style={styles.roundPillLight} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel="Antrenmanı durdur">
          <MaterialCommunityIcons name="close" size={22} color={colors.text} />
        </Touchable>
        <View style={styles.titlePill}>
          <Text style={styles.titlePillMain} numberOfLines={1}>
            {planTitle}
          </Text>
          <Text style={styles.titlePillSub}>
            {exerciseIndex + 1}/{exerciseCount} poz
          </Text>
        </View>
        <View style={styles.fpsSlot}>
          {showFps ? (
            <View style={styles.fpsPill}>
              <Text style={styles.fpsText}>FPS {fps}</Text>
            </View>
          ) : (
            <View style={styles.fpsPlaceholder} />
          )}
        </View>
      </View>

      {showCameraControls ? (
        <View style={[styles.cameraControlsRow, { top: topInset + 56 }]}>
          <TouchableOpacity style={styles.darkPill} onPress={onFlipCamera} accessibilityRole="button" accessibilityLabel="Kamera çevir">
            <MaterialCommunityIcons name="camera-flip-outline" size={18} color={colors.textOnDark} />
            <Text style={styles.darkPillText}>{cameraFacing === 'front' ? 'Ön' : 'Arka'}</Text>
          </TouchableOpacity>
          <View style={styles.zoomRow}>
            {zoomPresets.map(z => (
              <TouchableOpacity
                key={z.label}
                style={[styles.zoomChip, previewScale === z.scale && styles.zoomChipActive]}
                onPress={() => onSelectZoom(z.scale)}
                accessibilityRole="button"
                accessibilityLabel={z.label}
              >
                <Text style={[styles.zoomChipText, previewScale === z.scale && styles.zoomChipTextActive]}>{z.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {showFullBodyWarning ? (
        <View style={[styles.warnPill, { top: topInset + (showCameraControls ? 112 : 56) }]}>
          <MaterialCommunityIcons name="arrow-expand-all" size={18} color={colors.warningDark} />
          <Text style={styles.warnPillText}>Kalça veya dizler net görünmüyor — uzaklaştırın veya tüm vücudu kadraja alın.</Text>
        </View>
      ) : null}

      <View style={styles.timerAnchor}>
        <View style={styles.timerPill}>
          <Text style={styles.timerText}>{timerText}</Text>
        </View>
      </View>

      <View style={[styles.bottomAnchor, { paddingBottom: Math.max(bottomInset, spacing.base) }]} pointerEvents="box-none">
        {bottomPanel}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sessionProgressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    zIndex: 5,
  },
  topFloatingRow: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 6,
  },
  roundPillLight: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: pillBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  titlePill: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    backgroundColor: pillBg,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  titlePillMain: {
    ...typography.bodySmMedium,
    color: colors.text,
    textAlign: 'center',
  },
  titlePillSub: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  fpsSlot: { width: 52, alignItems: 'flex-end' },
  fpsPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: pillBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  fpsText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  fpsPlaceholder: { width: 44, height: 36 },
  cameraControlsRow: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 6,
  },
  darkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: pillBgDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  darkPillText: {
    ...typography.captionMedium,
    color: colors.textOnDark,
  },
  zoomRow: { flexDirection: 'row', gap: spacing.xs },
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
  warnPill: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 243, 224, 0.92)',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 149, 0, 0.35)',
    zIndex: 7,
  },
  warnPillText: {
    ...typography.bodySmMedium,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  timerAnchor: {
    position: 'absolute',
    top: '22%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 6,
  },
  timerPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    minWidth: 120,
    alignItems: 'center',
    backgroundColor: pillBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  timerText: {
    ...typography.h2,
    color: colors.text,
    fontVariant: Platform.OS === 'ios' ? ['tabular-nums'] : undefined,
  },
  bottomAnchor: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    bottom: 0,
    maxHeight: '46%',
    zIndex: 8,
  },
  bottomBlur: {
    borderRadius: radius.xxl,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  bottomBlurAndroid: {
    borderRadius: radius.xxl,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  bottomInner: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  accuracyLine: {
    ...typography.bodySm,
    color: colors.textSecondary,
  },
  accuracyStrong: {
    ...typography.bodySmMedium,
    color: colors.primary,
  },
  noAnalyzeHint: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
  },
  poseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  catBadgeText: {
    ...typography.captionMedium,
  },
  poseCountSmall: {
    ...typography.caption,
    color: colors.textMuted,
  },
  poseName: {
    ...typography.h4,
    color: colors.text,
  },
  instruction: {
    ...typography.bodySm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  nextPose: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});

export const TrainingSessionHud = memo(TrainingSessionHudInner);
