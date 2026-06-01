import type { ExerciseAnalysisKind } from '@/lib/poseDomain';
import { resolveExerciseAnalysisKind } from '@/lib/poseDomain';
import { useFaceYogaPipeline } from '@/features/pose/useFaceYogaPipeline';

export type { ExerciseAnalysisKind };
export { resolveExerciseAnalysisKind };

type Params = {
  poseId: string;
  analysisKind: ExerciseAnalysisKind;
  repTarget?: number;
  active: boolean;
  cameraReady: boolean;
};

export function useExerciseAnalysis({
  poseId,
  analysisKind,
  repTarget,
  active,
  cameraReady,
}: Params) {
  const pipeline = useFaceYogaPipeline({
    poseId,
    analysisKind,
    repTarget,
    active,
    cameraReady,
  });

  return {
    ...pipeline,
    cameraReady,
    faceNotDetected: pipeline.isFaceMode && pipeline.showFaceLostBanner,
    showFaceLostBanner: pipeline.showFaceLostBanner,
    showCalibrationBanner: pipeline.showCalibrationBanner,
    effectiveRepTarget: pipeline.repResult?.target ?? repTarget ?? 0,
    faceLmLoading: pipeline.faceLmLoading,
    handLmLoading: pipeline.handLmLoading,
  };
}
