import type { Orientation } from 'react-native-vision-camera';
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
 * Returns the image-space width/height that ML Kit uses for its coordinate output.
 *
 * ML Kit interprets the buffer *after* applying orientation, so when the raw
 * buffer is landscape (e.g. sensor) but the orientation flag says "portrait",
 * the coordinate system is effectively rotated – meaning we must swap W/H for
 * normalization.
 *
 * `frame.width` and `frame.height` are always the **raw buffer** dimensions
 * (typically landscape for most iOS sensors).
 */
function getMlImageExtent(
  frameWidth: number,
  frameHeight: number,
  orientation: Orientation,
): { normW: number; normH: number } {
  'worklet';
  const needsSwap =
    orientation === 'landscape-left' || orientation === 'landscape-right';
  return needsSwap
    ? { normW: frameHeight, normH: frameWidth }
    : { normW: frameWidth, normH: frameHeight };
}

/**
 * Maps detector output to normalized 0–1 landmarks (analyzer + overlay base coords).
 *
 * - `orientation` determines whether W/H must be swapped for normalization.
 * - `flipXForAnalysis` (default false) flips X so that analyzer sees anatomically-
 *   correct coordinates even on the selfie camera. The visual mirror effect is
 *   handled separately in `SkeletonOverlay`.
 */
export function landmarksFromDetector(
  raw: Landmarks,
  frameWidth: number,
  frameHeight: number,
  orientation: Orientation,
  flipXForAnalysis = false,
): LandmarkPoint[] {
  'worklet';
  const { normW, normH } = getMlImageExtent(frameWidth, frameHeight, orientation);
  const w = normW > 0 ? normW : 1;
  const h = normH > 0 ? normH : 1;

  return POSE_LANDMARK_KEYS.map((key, index) => {
    const lm = raw[key];
    let nx = lm.x / w;
    const ny = lm.y / h;
    if (flipXForAnalysis) {
      nx = 1 - nx;
    }
    return {
      index,
      x: nx,
      y: ny,
      z: 0,
      visibility: lm.confidence,
    };
  });
}

/**
 * Diagnostic: returns raw landmark bounds to verify normalization axis selection.
 * Use in DEV HUD to compare max(x) vs normW, max(y) vs normH.
 */
export function rawLandmarkBounds(raw: Landmarks): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  'worklet';
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const key of POSE_LANDMARK_KEYS) {
    const lm = raw[key];
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }
  return { minX, maxX, minY, maxY };
}
