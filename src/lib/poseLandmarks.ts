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
 * Vision Camera frame pixel size (`frame.width` × `frame.height`). Raw landmark x/y from
 * ML Kit match this buffer — compare diagnostics using these, not swapped extents.
 */
export function getMlNormalizationExtent(
  frameWidth: number,
  frameHeight: number,
  _orientation: Orientation,
): { normW: number; normH: number } {
  const w = frameWidth > 0 ? frameWidth : 1;
  const h = frameHeight > 0 ? frameHeight : 1;
  return { normW: w, normH: h };
}

/**
 * Logical preview aspect for `resizeMode` math: upright video on screen swaps W/H when
 * the sensor buffer is landscape while the UI is portrait.
 */
export function getPreviewContentExtent(
  frameWidth: number,
  frameHeight: number,
  orientation: Orientation,
): { contentW: number; contentH: number } {
  const w = frameWidth > 0 ? frameWidth : 1;
  const h = frameHeight > 0 ? frameHeight : 1;
  if (orientation === 'landscape-left' || orientation === 'landscape-right') {
    return { contentW: h, contentH: w };
  }
  return { contentW: w, contentH: h };
}

/** Map buffer-normalized coords to preview-upright normalized coords (matches rotated `<Camera />`). */
function bufferNormToViewNorm(
  nx: number,
  ny: number,
  orientation: Orientation,
): { nx: number; ny: number } {
  'worklet';
  switch (orientation) {
    case 'landscape-right':
      return { nx: ny, ny: 1 - nx };
    case 'landscape-left':
      return { nx: 1 - ny, ny: nx };
    case 'portrait-upside-down':
      return { nx: 1 - nx, ny: 1 - ny };
    default:
      return { nx, ny };
  }
}

function getMlImageExtent(
  frameWidth: number,
  frameHeight: number,
  _orientation: Orientation,
): { normW: number; normH: number } {
  'worklet';
  const w = frameWidth > 0 ? frameWidth : 1;
  const h = frameHeight > 0 ? frameHeight : 1;
  return { normW: w, normH: h };
}

/**
 * Maps detector output to normalized landmarks for analyzer + overlay.
 *
 * - Divide by **buffer** `frame.width` / `frame.height` (ML Kit returns buffer pixels).
 * - Rotate to **preview-upright** space so x/y match `resizeMode="cover"` + mirror overlay.
 * - `flipXForAnalysis`: optional extra flip for anatomical left/right (usually off; overlay mirrors).
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
    let ny = lm.y / h;
    const rv = bufferNormToViewNorm(nx, ny, orientation);
    nx = rv.nx;
    ny = rv.ny;
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

/** İyi görünürlükteki noktalar — düşük güvenli kalça/outlier maxX şişirmesini logda gizler. */
export function rawLandmarkBoundsVisible(
  raw: Landmarks,
  minConfidence: number,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  'worklet';
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  let any = false;
  for (const key of POSE_LANDMARK_KEYS) {
    const lm = raw[key];
    if (lm.confidence < minConfidence) continue;
    any = true;
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }
  return any ? { minX, maxX, minY, maxY } : null;
}
