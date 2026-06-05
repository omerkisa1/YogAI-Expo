import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createFaceRepCounter,
  FACE_EXERCISE_CONFIGS,
  type FaceRepResult,
} from '@/lib/faceRepCounter';
import {
  getFaceBBoxNormalized,
  normalizeHandLandmarks,
} from '@/lib/faceHandCoordinates';
import {
  createMobileFaceHandCounter,
  MOBILE_FACE_HAND_CONFIGS,
  toFaceHandUiResult,
  type FaceHandUiResult,
} from '@/lib/faceHandRepCounterMobile';
import type { ExerciseAnalysisKind } from '@/lib/poseDomain';
import { resetFaceBaseline, isBaselineCalibrated } from '@/lib/faceMeshMapper';
import { useFaceLandmarker } from '@/features/pose/useFaceLandmarker';
import { HAND_LANDMARKER_SUPPORTED, useHandLandmarker } from '@/features/pose/useHandLandmarker';
import { useStableFaceDetected } from '@/features/pose/useStableFaceDetected';
import { useStableHandDetected } from '@/features/pose/useStableHandDetected';

type Params = {
  poseId: string;
  analysisKind: ExerciseAnalysisKind;
  repTarget?: number;
  active: boolean;
  cameraReady: boolean;
  cameraFacing?: 'front' | 'back';
};

export function useFaceYogaPipeline({
  poseId,
  analysisKind,
  repTarget,
  active,
  cameraReady,
  cameraFacing = 'front',
}: Params) {
  const isFace = analysisKind === 'face';
  const isFaceHand = analysisKind === 'face_hand';
  const isFaceMode = isFace || isFaceHand;

  const faceLandmarker = useFaceLandmarker();
  const handLandmarker = useHandLandmarker();
  const {
    start: startFaceLandmarker,
    stop: stopFaceLandmarker,
    currentFrame: faceFrame,
    isLoading: faceLmLoading,
    error: faceLmError,
  } = faceLandmarker;
  const {
    start: startHandLandmarker,
    stop: stopHandLandmarker,
    currentFrame: handFrame,
    isLoading: handLmLoading,
    error: handLmError,
  } = handLandmarker;

  const faceRepCounterRef = useRef<ReturnType<typeof createFaceRepCounter>>(null);
  const mobileFaceHandCounterRef = useRef<ReturnType<typeof createMobileFaceHandCounter>>(null);
  const [faceRepResult, setFaceRepResult] = useState<FaceRepResult | null>(null);
  const [faceHandRepResult, setFaceHandRepResult] = useState<FaceHandUiResult | null>(null);
  const [repPulse, setRepPulse] = useState(false);
  const [handRepPulse, setHandRepPulse] = useState(false);
  const prevRepsRef = useRef(0);
  const prevHandRepsRef = useRef(0);

  const resolvedRepTarget = repTarget && repTarget > 0 ? repTarget : undefined;
  const rawFaceDetected = !!faceFrame?.faceDetected;
  const { stableFaceDetected, showFaceLostBanner: stableFaceLost } = useStableFaceDetected(
    rawFaceDetected,
    active && isFaceMode,
    faceFrame?.timestamp,
  );
  const showFaceLostBanner = active && isFaceMode && stableFaceLost;

  const stableHand = useStableHandDetected({
    rawHands: handFrame?.hands,
    isActive: active && isFaceHand,
    frameTick: handFrame?.timestamp,
    appearFrames: 1,
    disappearFrames: 8,
    maxGhostMs: 600,
  });

  const [isCalibrating, setIsCalibrating] = useState(false);

  useEffect(() => {
    faceRepCounterRef.current = null;
    mobileFaceHandCounterRef.current = null;
    setFaceRepResult(null);
    setFaceHandRepResult(null);
    prevRepsRef.current = 0;
    prevHandRepsRef.current = 0;
    resetFaceBaseline();
    setIsCalibrating(true);
  }, [poseId]);

  useEffect(() => {
    if (!active || !isFaceMode || !cameraReady) {
      stopFaceLandmarker();
      stopHandLandmarker();
      return;
    }
    resetFaceBaseline();
    setIsCalibrating(true);
    startFaceLandmarker();
    if (isFaceHand) {
      startHandLandmarker();
    } else {
      stopHandLandmarker();
    }
    return () => {
      stopFaceLandmarker();
      stopHandLandmarker();
    };
  }, [
    active,
    cameraReady,
    isFaceMode,
    isFaceHand,
    startFaceLandmarker,
    startHandLandmarker,
    stopFaceLandmarker,
    stopHandLandmarker,
  ]);

  useEffect(() => {
    if (!active || !poseId || !isFaceMode) return;

    if (isFace && FACE_EXERCISE_CONFIGS[poseId] && !faceRepCounterRef.current) {
      const counter = createFaceRepCounter(poseId, resolvedRepTarget);
      if (counter) {
        faceRepCounterRef.current = counter;
        setFaceRepResult(counter.update(new Map()));
      }
    }
    if (isFaceHand && MOBILE_FACE_HAND_CONFIGS[poseId] && !mobileFaceHandCounterRef.current) {
      const counter = createMobileFaceHandCounter(poseId, resolvedRepTarget);
      if (counter) {
        mobileFaceHandCounterRef.current = counter;
        const cfg = counter.getConfig();
        setFaceHandRepResult(
          toFaceHandUiResult(
            counter.update(null, null, new Map()),
            cfg.barLabelKey,
          ),
        );
      }
    }
  }, [active, poseId, isFace, isFaceHand, isFaceMode, resolvedRepTarget]);

  useEffect(() => {
    if (!active || !isFace) return;
    if (!faceFrame?.faceDetected) return;
    if (faceFrame.blendshapes.size === 0) return;
    if (!faceRepCounterRef.current) return;

    const r = faceRepCounterRef.current.update(
      faceFrame.blendshapes,
      faceFrame.faceLandmarks ?? undefined,
    );
    setFaceRepResult(r);
    setIsCalibrating(!isBaselineCalibrated());
  }, [active, isFace, faceFrame]);

  useEffect(() => {
    if (!active || !isFaceHand) return;
    if (!faceFrame?.faceDetected) return;
    if (!mobileFaceHandCounterRef.current) return;

    const frameWidth = handFrame?.frameWidth || faceFrame.frameWidth;
    const frameHeight = handFrame?.frameHeight || faceFrame.frameHeight;
    const isMirrored = cameraFacing === 'front';

    const faceBBox =
      faceFrame.faceBoundingBox && frameWidth > 0 && frameHeight > 0
        ? getFaceBBoxNormalized(
            faceFrame.faceBoundingBox,
            frameWidth,
            frameHeight,
            true,
            isMirrored,
          )
        : null;

    if (!stableHand.detected) {
      const mobileResult = mobileFaceHandCounterRef.current.update(null, faceBBox, faceFrame.blendshapes);
      const cfg = mobileFaceHandCounterRef.current.getConfig();
      setFaceHandRepResult(toFaceHandUiResult(mobileResult, cfg.barLabelKey));
      setIsCalibrating(!isBaselineCalibrated());
      return;
    }

    const normalizedHand = stableHand.landmarks
      ? normalizeHandLandmarks(
          stableHand.landmarks,
          frameWidth,
          frameHeight,
          true,
          isMirrored,
        )
      : null;

    const mobileResult = mobileFaceHandCounterRef.current.update(
      normalizedHand,
      faceBBox,
      faceFrame.blendshapes,
      stableHand.isGhost,
    );
    const cfg = mobileFaceHandCounterRef.current.getConfig();
    setFaceHandRepResult(toFaceHandUiResult(mobileResult, cfg.barLabelKey));
    setIsCalibrating(!isBaselineCalibrated());

    if (__DEV__) {
      const now = Date.now();
      const lastLog = (globalThis as { __fhLastLog?: number }).__fhLastLog ?? 0;
      if (now - lastLog > 800) {
        (globalThis as { __fhLastLog?: number }).__fhLastLog = now;
        console.log('[FH_DEBUG]', {
          handPlugin: HAND_LANDMARKER_SUPPORTED,
          handReady: handFrame?.handReady ?? false,
          poseReady: handFrame?.poseReady ?? false,
          pluginReturnedNull: handFrame?.pluginReturnedNull ?? true,
          nativeHandCount: handFrame?.nativeHandCount ?? 0,
          detectMode: handFrame?.detectMode ?? '',
          frameOrientation: handFrame?.frameOrientation ?? '?',
          rawHandCount: handFrame?.hands?.length ?? 0,
          stableHand: stableHand.isGhost ? 'GHOST' : 'LIVE',
          handDetected: mobileResult.handDetected,
          handLandmarkCount: stableHand.landmarks?.length ?? 0,
          faceBBox: faceBBox ? 'YES' : 'NO',
          overlapScore: mobileResult.overlapScore.toFixed(2),
          feedbackState: mobileResult.feedbackState,
          motionType: mobileResult.motionType,
          motionPaused: mobileResult.motionPaused ?? false,
          isActive: mobileResult.isActive,
          holdProgress: mobileResult.holdProgress.toFixed(2),
          reps: mobileResult.reps,
        });
      }
    }
  }, [active, isFaceHand, faceFrame, handFrame, cameraFacing, stableHand]);

  useEffect(() => {
    if (!faceRepResult) {
      prevRepsRef.current = 0;
      return;
    }
    if (faceRepResult.reps < prevRepsRef.current) {
      prevRepsRef.current = faceRepResult.reps;
      return;
    }
    if (faceRepResult.reps > prevRepsRef.current) {
      prevRepsRef.current = faceRepResult.reps;
      setRepPulse(true);
      const id = setTimeout(() => setRepPulse(false), 300);
      return () => clearTimeout(id);
    }
  }, [faceRepResult]);

  useEffect(() => {
    if (!faceHandRepResult) {
      prevHandRepsRef.current = 0;
      return;
    }
    if (faceHandRepResult.reps < prevHandRepsRef.current) {
      prevHandRepsRef.current = faceHandRepResult.reps;
      return;
    }
    if (faceHandRepResult.reps > prevHandRepsRef.current) {
      prevHandRepsRef.current = faceHandRepResult.reps;
      setHandRepPulse(true);
      const id = setTimeout(() => setHandRepPulse(false), 300);
      return () => clearTimeout(id);
    }
  }, [faceHandRepResult]);

  const repResult = isFace ? faceRepResult : isFaceHand ? faceHandRepResult : null;
  const faceConfig = isFace && poseId ? FACE_EXERCISE_CONFIGS[poseId] : undefined;
  const faceHandConfig =
    isFaceHand && poseId ? MOBILE_FACE_HAND_CONFIGS[poseId] : undefined;
  const faceEnterThreshold = faceConfig?.enterThreshold ?? 0.45;
  const proximityThreshold = faceHandConfig?.overlapBarThreshold ?? 0.45;

  const repAccuracy = useCallback((): number => {
    if (!repResult) return 0;
    const target = repResult.target || 1;
    return Math.min(100, Math.round((repResult.reps / target) * 100));
  }, [repResult]);

  const resetCounters = useCallback(() => {
    faceRepCounterRef.current?.reset();
    mobileFaceHandCounterRef.current?.reset();
    setFaceRepResult(null);
    setFaceHandRepResult(null);
  }, []);

  const faceDetected = stableFaceDetected || rawFaceDetected;
  const rawFaceDetectedOut = rawFaceDetected;
  const showCalibrationBanner = active && isFace && faceDetected && isCalibrating;
  const hasRepUi = isFace ? faceRepResult != null : isFaceHand ? faceHandRepResult != null : false;
  const pipelineLoading =
    active &&
    cameraReady &&
    !hasRepUi &&
    (faceLmLoading || (isFaceHand && handLmLoading));
  const pipelineError = faceLmError ?? (isFaceHand ? handLmError : null);

  return {
    isFaceMode,
    isFaceHand,
    isFace,
    faceRepResult,
    faceHandRepResult,
    repResult,
    faceFps: faceFrame?.fps,
    faceFrame,
    handFrame,
    faceDetected,
    rawFaceDetected: rawFaceDetectedOut,
    showFaceLostBanner,
    showCalibrationBanner,
    pipelineLoading,
    pipelineError,
    repAccuracy,
    isRepComplete: repResult?.isComplete ?? false,
    repPulse,
    handRepPulse,
    faceConfig,
    faceHandConfig,
    faceEnterThreshold,
    proximityThreshold,
    resetCounters,
    faceLmLoading,
    handLmLoading,
    stableHand,
  };
}
