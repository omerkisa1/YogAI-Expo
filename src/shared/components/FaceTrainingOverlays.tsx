import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FaceRepResult } from '@/lib/faceRepCounter';
import type { FaceHandRepResult } from '@/lib/faceHandRepCounter';
import { getTrainingStrings, tKey, type AppLocale } from '@/lib/i18n';
import type { ExerciseAnalysisKind } from '@/lib/poseDomain';
import FaceFeedbackBanner from '@/shared/components/FaceFeedbackBanner';
import { ExerciseBar } from '@/shared/components/ExerciseBar';
import { FaceYogaCompletionOverlay } from '@/shared/components/FaceYogaCompletionOverlay';

type Props = {
  locale: AppLocale;
  analysisKind: ExerciseAnalysisKind;
  faceDetected: boolean;
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

export function FaceTrainingOverlays({
  locale,
  analysisKind,
  faceDetected,
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
  const strings = getTrainingStrings(locale);
  const isFace = analysisKind === 'face';
  const isFaceHand = analysisKind === 'face_hand';

  if (pipelineLoading) {
    return (
      <View style={styles.loadingBackdrop}>
        <Text style={styles.loadingText}>{strings.waitingForData}</Text>
      </View>
    );
  }

  if (!faceDetected) return null;

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
        <View style={styles.repCenter} pointerEvents="none">
          <Text style={[styles.repBig, repPulse && styles.repPulse]}>
            {faceRepResult.reps} / {faceRepResult.target}
          </Text>
          <Text style={styles.repHint}>{strings.reps}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${faceRepResult.progress * 100}%` }]} />
          </View>
        </View>

        <View style={styles.barBottom} pointerEvents="none">
          <ExerciseBar
            value={faceRepResult.currentValue}
            enterThreshold={faceEnterThreshold}
            label={tKey(strings, faceRepResult.barLabelKey)}
            minLabel={strings.closed}
            maxLabel={strings.open}
          />
        </View>

        <View style={styles.feedbackRight} pointerEvents="none">
          <FaceFeedbackBanner
            locale={locale}
            variant="face"
            feedbackState={faceRepResult.feedbackState}
            feedbackKey={faceRepResult.feedbackKey}
          />
        </View>
      </>
    );
  }

  if (isFaceHand && faceHandRepResult) {
    return (
      <>
        <View style={styles.repCenter} pointerEvents="none">
          <Text style={[styles.repBig, handRepPulse && styles.repPulse]}>
            {faceHandRepResult.reps} / {faceHandRepResult.target}
          </Text>
          <Text style={styles.repHint}>{strings.reps}</Text>
          {faceHandRepResult.holdProgress > 0 && faceHandRepResult.holdProgress < 1 && (
            <View style={[styles.progressTrack, { marginTop: 12 }]}>
              <View
                style={[styles.holdFill, { width: `${faceHandRepResult.holdProgress * 100}%` }]}
              />
            </View>
          )}
          <View style={[styles.progressTrack, { marginTop: 8, height: 4 }]}>
            <View
              style={[styles.progressFillMuted, { width: `${faceHandRepResult.progress * 100}%` }]}
            />
          </View>
        </View>

        <View style={styles.barBottom} pointerEvents="none">
          <ExerciseBar
            value={faceHandRepResult.currentProximity}
            enterThreshold={proximityThreshold}
            label={strings.handProximity}
          />
        </View>

        <View style={styles.feedbackRight} pointerEvents="none">
          <FaceFeedbackBanner
            locale={locale}
            variant="face_hand"
            feedbackState={faceHandRepResult.feedbackState}
            feedbackKey={faceHandRepResult.feedbackKey}
          />
        </View>
      </>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  loadingBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  repCenter: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '28%',
    zIndex: 20,
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  repBig: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  repPulse: {
    color: '#4ade80',
    transform: [{ scale: 1.15 }],
  },
  repHint: {
    marginTop: 4,
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
  },
  progressTrack: {
    marginTop: 12,
    height: 8,
    width: 192,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 4,
  },
  progressFillMuted: {
    height: '100%',
    backgroundColor: 'rgba(74,222,128,0.6)',
    borderRadius: 4,
  },
  holdFill: {
    height: '100%',
    backgroundColor: '#60a5fa',
    borderRadius: 4,
  },
  barBottom: {
    position: 'absolute',
    bottom: 96,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
  },
  feedbackRight: {
    position: 'absolute',
    top: 80,
    right: 16,
    zIndex: 20,
    maxWidth: 280,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
