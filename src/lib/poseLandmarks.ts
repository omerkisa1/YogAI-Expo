import type { Landmarks } from 'vision-camera-pose-detector';

import type { LandmarkPoint } from '@/lib/poseAnalyzer';

/** Canonical MediaPipe / ML Kit order (33 points), keys match `vision-camera-pose-detector`. */
export const POSE_LANDMARK_KEYS = [
  'nose',
  'leftEyeInner',
  'leftEye',
  'leftEyeOuter',
  'rightEyeInner',
  'rightEye',
  'rightEyeOuter',
  'leftEar',
  'rightEar',
  'mouthLeft',
  'mouthRight',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftPinkyFinger',
  'rightPinkyFinger',
  'leftIndexFinger',
  'rightIndexFinger',
  'leftThumb',
  'rightThumb',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
  'leftHeel',
  'rightHeel',
  'leftFootIndex',
  'rightFootIndex',
] as const satisfies readonly (keyof Landmarks)[];

export type PoseLandmarkKey = (typeof POSE_LANDMARK_KEYS)[number];

/**
 * Maps detector output to normalized 0–1 landmarks (analyzer + overlay base coords).
 * Mirror is applied only in `SkeletonOverlay`, not here.
 */
export function landmarksFromDetector(
  raw: Landmarks,
  frameWidth: number,
  frameHeight: number,
): LandmarkPoint[] {
  'worklet';
  const w = frameWidth > 0 ? frameWidth : 1;
  const h = frameHeight > 0 ? frameHeight : 1;
  return POSE_LANDMARK_KEYS.map((key, index) => {
    const lm = raw[key];
    return {
      index,
      x: lm.x / w,
      y: lm.y / h,
      z: 0,
      visibility: lm.confidence,
    };
  });
}
