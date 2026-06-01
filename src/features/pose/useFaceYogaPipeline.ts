import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createFaceRepCounter,
  FACE_EXERCISE_CONFIGS,
  type FaceRepResult,
} from '@/lib/faceRepCounter';
import {
  createFaceHandRepCounter,
  FACE_HAND_EXERCISE_CONFIGS,
  type FaceHandRepResult,
} from '@/lib/faceHandRepCounter';
import type { ExerciseAnalysisKind } from '@/lib/poseDomain';
import { useFaceLandmarker } from '@/features/pose/useFaceLandmarker';
import { useHandLandmarker } from '@/features/pose/useHandLandmarker';
import { useStableFaceDetected } from '@/features/pose/useStableFaceDetected';

type Params = {
  poseId: string;
  analysisKind: ExerciseAnalysisKind;
  repTarget?: number;
  active: boolean;
  cameraReady: boolean;
};

export function useFaceYogaPipeline({
  poseId,
  analysisKind,
  repTarget,
  active,
  cameraReady,
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
  const faceHandRepCounterRef = useRef<ReturnType<typeof createFaceHandRepCounter>>(null);
  const [faceRepResult, setFaceRepResult] = useState<FaceRepResult | null>(null);
  const [faceHandRepResult, setFaceHandRepResult] = useState<FaceHandRepResult | null>(null);
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

  useEffect(() => {
    faceRepCounterRef.current = null;
    faceHandRepCounterRef.current = null;
    setFaceRepResult(null);
    setFaceHandRepResult(null);
    prevRepsRef.current = 0;
    prevHandRepsRef.current = 0;
  }, [poseId]);

  useEffect(() => {
    if (!active || !isFaceMode || !cameraReady) {
      stopFaceLandmarker();
      stopHandLandmarker();
      return;
    }
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
    if (isFaceHand && FACE_HAND_EXERCISE_CONFIGS[poseId] && !faceHandRepCounterRef.current) {
      const counter = createFaceHandRepCounter(poseId, resolvedRepTarget);
      if (counter) {
        faceHandRepCounterRef.current = counter;
        setFaceHandRepResult(
          counter.update([], [], new Map()),
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
  }, [active, isFace, faceFrame]);

  useEffect(() => {
    if (!active || !isFaceHand) return;
    if (!faceFrame?.faceDetected) return;
    if (!faceHandRepCounterRef.current) return;

    const handsPayload = (handFrame?.hands ?? []).map(h => ({
      landmarks: h.landmarks,
    }));
    const r = faceHandRepCounterRef.current.update(
      handsPayload,
      faceFrame.faceLandmarks ?? [],
      faceFrame.blendshapes,
    );
    setFaceHandRepResult(r);
  }, [active, isFaceHand, faceFrame, handFrame]);

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
    isFaceHand && poseId ? FACE_HAND_EXERCISE_CONFIGS[poseId] : undefined;
  const faceEnterThreshold = faceConfig?.enterThreshold ?? 0.45;
  const proximityThreshold = faceHandConfig?.proximityThreshold ?? 0.15;

  const repAccuracy = useCallback((): number => {
    if (!repResult) return 0;
    const target = repResult.target || 1;
    return Math.min(100, Math.round((repResult.reps / target) * 100));
  }, [repResult]);

  const resetCounters = useCallback(() => {
    faceRepCounterRef.current?.reset();
    faceHandRepCounterRef.current?.reset();
    setFaceRepResult(null);
    setFaceHandRepResult(null);
  }, []);

  const faceDetected = stableFaceDetected || rawFaceDetected;
  const rawFaceDetectedOut = rawFaceDetected;
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
    faceDetected,
    rawFaceDetected: rawFaceDetectedOut,
    showFaceLostBanner,
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
  };
}
