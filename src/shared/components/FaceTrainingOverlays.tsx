import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FaceRepResult } from '@/lib/faceRepCounter';
import type { FaceHandRepResult } from '@/lib/faceHandRepCounter';
import { getTrainingStrings, tKey, type AppLocale } from '@/lib/i18n';
import type { ExerciseAnalysisKind } from '@/lib/poseDomain';
import FaceFeedbackBanner from '@/shared/components/FaceFeedbackBanner';
import { ExerciseBar } from '@/shared/components/ExerciseBar';
import { FaceYogaCompletionOverlay } from '@/shared/components/FaceYogaCompletionOverlay';

const FOOTER_RESERVE = 140;

type Props = {
  locale: AppLocale;
  analysisKind: ExerciseAnalysisKind;
  faceDetected: boolean;
  showFaceLostBanner?: boolean;
  showCalibrationBanner?: boolean;
  faceRepResult: FaceRepResult | null;
  faceHandRepResult: FaceHandRepResult | null;
  repPulse: boolean;
  handRepPulse: boolean;
  faceEnterThreshold: number;
  proximityThreshold: number;
  pipelineLoading: boolean;
  completionCountdown: number | null;
  repCompletionLatched?: boolean;
  latchedTargetReps?: number;
  onRetry?: () => void;
};

function CompactRepCounter({
  reps,
  target,
  progress,
  pulse,
  repsLabel,
}: {
  reps: number;
  target: number;
  progress: number;
  pulse: boolean;
  repsLabel: string;
}) {
  return (
    <View style={styles.repCompact}>
      <Text style={[styles.repCompactValue, pulse && styles.repPulse]}>
        {reps} / {target}
      </Text>
      <Text style={styles.repCompactHint}>{repsLabel}</Text>
      <View style={styles.repCompactTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>
    </View>
  );
}

function RightHudStack({
  locale,
  variant,
  feedbackState,
  feedbackKey,
  reps,
  target,
  progress,
  pulse,
  repsLabel,
  dimmed,
}: {
  locale: AppLocale;
  variant: 'face' | 'face_hand';
  feedbackState: FaceRepResult['feedbackState'] | FaceHandRepResult['feedbackState'];
  feedbackKey: string;
  reps: number;
  target: number;
  progress: number;
  pulse: boolean;
  repsLabel: string;
  dimmed: boolean;
}) {
  return (
    <View style={[styles.rightColumn, dimmed && styles.dimmed]} pointerEvents="none">
      <FaceFeedbackBanner
        locale={locale}
        variant={variant}
        feedbackState={feedbackState}
        feedbackKey={feedbackKey}
      />
      <CompactRepCounter
        reps={reps}
        target={target}
        progress={progress}
        pulse={pulse}
        repsLabel={repsLabel}
      />
    </View>
  );
}

export function FaceTrainingOverlays({
  locale,
  analysisKind,
  faceDetected,
  showFaceLostBanner = false,
  showCalibrationBanner = false,
  faceRepResult,
  faceHandRepResult,
  repPulse,
  handRepPulse,
  faceEnterThreshold,
  proximityThreshold,
  pipelineLoading,
  completionCountdown,
  repCompletionLatched = false,
  latchedTargetReps = 0,
  onRetry,
}: Props) {
  const insets = useSafeAreaInsets();
  const strings = getTrainingStrings(locale);
  const isFace = analysisKind === 'face';
  const isFaceHand = analysisKind === 'face_hand';
  const barBottomOffset = insets.bottom + FOOTER_RESERVE;
  const dimmed = !faceDetected;

  const calibrationBanner =
    showCalibrationBanner && !showFaceLostBanner ? (
      <View style={[styles.calibrationBanner, { top: insets.top + 56 }]}>
        <Text style={styles.calibrationText}>
          {locale === 'tr'
            ? 'Kalibre ediliyor… Nötr yüzle bekleyin'
            : 'Calibrating… hold a neutral face'}
        </Text>
      </View>
    ) : null;

  const showFaceComplete = isFace && (faceRepResult?.isComplete || repCompletionLatched);
  if (showFaceComplete) {
    return (
      <FaceYogaCompletionOverlay
        strings={strings}
        targetReps={faceRepResult?.target ?? latchedTargetReps}
        countdown={completionCountdown}
        onRetry={completionCountdown === null ? onRetry : undefined}
      />
    );
  }

  const showFaceHandComplete =
    isFaceHand && (faceHandRepResult?.isComplete || repCompletionLatched);
  if (showFaceHandComplete) {
    return (
      <FaceYogaCompletionOverlay
        strings={strings}
        targetReps={faceHandRepResult?.target ?? latchedTargetReps}
        countdown={completionCountdown}
        onRetry={completionCountdown === null ? onRetry : undefined}
      />
    );
  }

  if (isFace && faceRepResult) {
    return (
      <>
        {pipelineLoading && (
          <View style={[styles.loadingPill, { top: insets.top + 120 }]}>
            <Text style={styles.loadingText}>{strings.waitingForData}</Text>
          </View>
        )}

        {calibrationBanner}

        {showFaceLostBanner && (
          <View style={[styles.faceLostBanner, { top: insets.top + 56 }]}>
            <Text style={styles.faceLostText}>
              {locale === 'tr' ? 'Yüz algılanmadı — kameraya bakın' : 'Face not detected — look at camera'}
            </Text>
          </View>
        )}

        <View style={[styles.rightColumnWrap, { top: insets.top + 72 }]} pointerEvents="none">
          <RightHudStack
            locale={locale}
            variant="face"
            feedbackState={faceRepResult.feedbackState}
            feedbackKey={faceRepResult.feedbackKey}
            reps={faceRepResult.reps}
            target={faceRepResult.target}
            progress={faceRepResult.progress}
            pulse={repPulse}
            repsLabel={strings.reps}
            dimmed={dimmed}
          />
        </View>

        <View style={[styles.barBottom, { bottom: barBottomOffset }]} pointerEvents="none">
          <View style={dimmed ? styles.dimmed : undefined}>
            <ExerciseBar
              value={faceRepResult.currentValue}
              enterThreshold={faceEnterThreshold}
              label={tKey(strings, faceRepResult.barLabelKey)}
              minLabel={strings.closed}
              maxLabel={strings.open}
            />
            {__DEV__ && (
              <Text style={styles.devValue}>
                {faceRepResult.currentValue.toFixed(3)}
              </Text>
            )}
          </View>
        </View>
      </>
    );
  }

  if (isFaceHand && faceHandRepResult) {
    return (
      <>
        {pipelineLoading && (
          <View style={[styles.loadingPill, { top: insets.top + 120 }]}>
            <Text style={styles.loadingText}>{strings.waitingForData}</Text>
          </View>
        )}

        {calibrationBanner}

        {showFaceLostBanner && (
          <View style={[styles.faceLostBanner, { top: insets.top + 56 }]}>
            <Text style={styles.faceLostText}>
              {locale === 'tr' ? 'Yüz algılanmadı — kameraya bakın' : 'Face not detected — look at camera'}
            </Text>
          </View>
        )}

        <View style={[styles.rightColumnWrap, { top: insets.top + 72 }]} pointerEvents="none">
          <RightHudStack
            locale={locale}
            variant="face_hand"
            feedbackState={faceHandRepResult.feedbackState}
            feedbackKey={faceHandRepResult.feedbackKey}
            reps={faceHandRepResult.reps}
            target={faceHandRepResult.target}
            progress={faceHandRepResult.progress}
            pulse={handRepPulse}
            repsLabel={strings.reps}
            dimmed={dimmed}
          />
        </View>

        <View style={[styles.barBottom, { bottom: barBottomOffset }]} pointerEvents="none">
          <View style={dimmed ? styles.dimmed : undefined}>
            <ExerciseBar
              value={faceHandRepResult.currentProximity}
              enterThreshold={proximityThreshold}
              label={strings.handProximity}
            />
          </View>
        </View>
      </>
    );
  }

  if (showFaceLostBanner) {
    return (
      <View style={[styles.faceLostBanner, { top: insets.top + 56 }]}>
        <Text style={styles.faceLostText}>
          {locale === 'tr' ? 'Yüz algılanmadı — kameraya bakın' : 'Face not detected — look at camera'}
        </Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loadingPill: {
    position: 'absolute',
    alignSelf: 'center',
    left: 24,
    right: 24,
    zIndex: 24,
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    overflow: 'hidden',
  },
  faceLostBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 25,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.92)',
  },
  faceLostText: {
    color: '#1a1a1a',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  calibrationBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 26,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.88)',
  },
  calibrationText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  rightColumnWrap: {
    position: 'absolute',
    right: 12,
    zIndex: 20,
    maxWidth: 200,
  },
  rightColumn: {
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dimmed: {
    opacity: 0.45,
  },
  repCompact: {
    alignItems: 'center',
    paddingTop: 4,
  },
  repCompactValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  repPulse: {
    color: '#4ade80',
  },
  repCompactHint: {
    marginTop: 2,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
  },
  repCompactTrack: {
    marginTop: 6,
    height: 4,
    width: '100%',
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 2,
  },
  barBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
  },
  devValue: {
    marginTop: 4,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
