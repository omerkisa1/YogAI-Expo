import type { Face } from 'react-native-vision-camera-face-detector';

export type FaceLandmark = { x: number; y: number; z: number };

const LANDMARK_COUNT = 478;

const emptyLandmarks = (): FaceLandmark[] =>
  Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0 }));

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const avg = (points: { x: number; y: number }[]) => {
  if (points.length === 0) return { x: 0.5, y: 0.5 };
  const s = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / points.length, y: s.y / points.length };
};

export function buildFaceLandmarksFromMlKit(face: Face): FaceLandmark[] {
  const lm = emptyLandmarks();
  const bounds = face.bounds;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const w = Math.max(bounds.width, 1e-6);
  const h = Math.max(bounds.height, 1e-6);

  const set = (idx: number, x: number, y: number, z = 0) => {
    lm[idx] = { x: clamp01(x), y: clamp01(y), z };
  };

  const contours = face.contours;
  const landmarks = face.landmarks;

  const forehead = contours?.FACE?.length
    ? avg(contours.FACE.slice(0, Math.min(8, contours.FACE.length)))
    : { x: cx, y: cy - h * 0.35 };
  const chin = contours?.FACE?.length
    ? avg(contours.FACE.slice(Math.max(0, contours.FACE.length - 6)))
    : { x: cx, y: cy + h * 0.42 };
  const leftCheek = landmarks?.LEFT_CHEEK ?? { x: cx - w * 0.28, y: cy };
  const rightCheek = landmarks?.RIGHT_CHEEK ?? { x: cx + w * 0.28, y: cy };
  const noseTip = landmarks?.NOSE_BASE ?? { x: cx, y: cy + h * 0.05 };
  const leftEye = avg(contours?.LEFT_EYE ?? []);
  const rightEye = avg(contours?.RIGHT_EYE ?? []);
  const mouthLeft = landmarks?.MOUTH_LEFT ?? { x: cx - w * 0.2, y: cy + h * 0.15 };
  const mouthRight = landmarks?.MOUTH_RIGHT ?? { x: cx + w * 0.2, y: cy + h * 0.15 };

  set(10, forehead.x / (bounds.x + w), (forehead.y - bounds.y) / h);
  set(152, (chin.x - bounds.x) / w, (chin.y - bounds.y) / h);
  set(234, (leftCheek.x - bounds.x) / w, (leftCheek.y - bounds.y) / h);
  set(454, (rightCheek.x - bounds.x) / w, (rightCheek.y - bounds.y) / h);
  set(168, (noseTip.x - bounds.x) / w, (noseTip.y - bounds.y) / h);
  set(1, (noseTip.x - bounds.x) / w, (noseTip.y - bounds.y) / h - 0.02);
  set(54, (mouthLeft.x - bounds.x) / w, (mouthLeft.y - bounds.y) / h);
  set(284, (mouthRight.x - bounds.x) / w, (mouthRight.y - bounds.y) / h);
  set(93, (leftCheek.x - bounds.x) / w, (leftCheek.y - bounds.y) / h);
  set(132, (leftCheek.x - bounds.x) / w + 0.02, (leftCheek.y - bounds.y) / h);
  set(361, (rightCheek.x - bounds.x) / w, (rightCheek.y - bounds.y) / h);
  set(323, (rightCheek.x - bounds.x) / w - 0.02, (rightCheek.y - bounds.y) / h);
  set(9, (forehead.x - bounds.x) / w, (forehead.y - bounds.y) / h + 0.02);
  set(8, (forehead.x - bounds.x) / w, (forehead.y - bounds.y) / h + 0.04);
  set(175, (chin.x - bounds.x) / w, (chin.y - bounds.y) / h - 0.02);
  set(199, (chin.x - bounds.x) / w, (chin.y - bounds.y) / h - 0.04);
  set(177, (leftCheek.x - bounds.x) / w - 0.05, (leftCheek.y - bounds.y) / h + 0.15);
  set(147, (leftCheek.x - bounds.x) / w - 0.08, (leftCheek.y - bounds.y) / h + 0.2);
  set(33, (leftEye.x - bounds.x) / w, (leftEye.y - bounds.y) / h);
  set(263, (rightEye.x - bounds.x) / w, (rightEye.y - bounds.y) / h);
  set(133, (leftCheek.x - bounds.x) / w, (leftCheek.y - bounds.y) / h - 0.05);
  set(362, (rightCheek.x - bounds.x) / w, (rightCheek.y - bounds.y) / h - 0.05);

  return lm;
}

export function buildBlendshapesFromMlKit(face: Face): Map<string, number> {
  const boundsW = Math.max(face.bounds.width, 1);
  const boundsH = Math.max(face.bounds.height, 1);
  const contours = face.contours;
  const landmarks = face.landmarks;

  const mouthLeft = landmarks?.MOUTH_LEFT;
  const mouthRight = landmarks?.MOUTH_RIGHT;
  const mouthWidthNorm =
    mouthLeft && mouthRight
      ? clamp01(Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y) / boundsW)
      : 0;

  const upperLip = contours?.UPPER_LIP_BOTTOM?.length
    ? avg(contours.UPPER_LIP_BOTTOM)
    : null;
  const lowerLip = contours?.LOWER_LIP_TOP?.length ? avg(contours.LOWER_LIP_TOP) : null;
  const jawOpenRaw =
    upperLip && lowerLip ? Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y) / boundsH : 0;

  const leftBrow = contours?.LEFT_EYEBROW_TOP?.length ? avg(contours.LEFT_EYEBROW_TOP) : null;
  const rightBrow = contours?.RIGHT_EYEBROW_TOP?.length ? avg(contours.RIGHT_EYEBROW_TOP) : null;
  const leftEye = contours?.LEFT_EYE?.length ? avg(contours.LEFT_EYE) : null;
  const rightEye = contours?.RIGHT_EYE?.length ? avg(contours.RIGHT_EYE) : null;
  const browRaiseLeftRaw =
    leftBrow && leftEye ? Math.hypot(leftBrow.x - leftEye.x, leftBrow.y - leftEye.y) / boundsH : 0;
  const browRaiseRightRaw =
    rightBrow && rightEye ? Math.hypot(rightBrow.x - rightEye.x, rightBrow.y - rightEye.y) / boundsH : 0;

  const leftEyeOpen =
    typeof face.leftEyeOpenProbability === 'number'
      ? clamp01(face.leftEyeOpenProbability)
      : 0.5;
  const rightEyeOpen =
    typeof face.rightEyeOpenProbability === 'number'
      ? clamp01(face.rightEyeOpenProbability)
      : 0.5;
  const smilingProb =
    typeof face.smilingProbability === 'number' ? clamp01(face.smilingProbability) : 0;

  const jawOpen = clamp01(jawOpenRaw / 0.2);
  const mouthSmile = smilingProb > 0 ? smilingProb : clamp01(mouthWidthNorm / 0.5);
  const browRaiseLeft = clamp01(browRaiseLeftRaw / 0.15);
  const browRaiseRight = clamp01(browRaiseRightRaw / 0.15);
  const browInnerUp = clamp01((browRaiseLeftRaw + browRaiseRightRaw) / 0.3);
  const eyeSquintLeft = clamp01(1 - leftEyeOpen);
  const eyeSquintRight = clamp01(1 - rightEyeOpen);
  const eyeWideLeft = clamp01(leftEyeOpen);
  const eyeWideRight = clamp01(rightEyeOpen);

  return new Map<string, number>([
    ['jawOpen', jawOpen],
    ['jawRight', clamp01(jawOpen * 0.6)],
    ['jawLeft', clamp01(jawOpen * 0.6)],
    ['mouthSmileLeft', mouthSmile],
    ['mouthSmileRight', mouthSmile],
    ['mouthPucker', clamp01(1 - mouthWidthNorm)],
    ['mouthFunnel', clamp01(jawOpen * 0.85)],
    ['mouthShrugLower', clamp01(jawOpen * 0.5)],
    ['browRaiseLeft', browRaiseLeft],
    ['browRaiseRight', browRaiseRight],
    ['browInnerUp', browInnerUp],
    ['browOuterUpLeft', browRaiseLeft],
    ['browOuterUpRight', browRaiseRight],
    ['browDownLeft', clamp01(1 - browRaiseLeft)],
    ['browDownRight', clamp01(1 - browRaiseRight)],
    ['eyeSquintLeft', eyeSquintLeft],
    ['eyeSquintRight', eyeSquintRight],
    ['eyeWideLeft', eyeWideLeft],
    ['eyeWideRight', eyeWideRight],
    ['eyeBlinkLeft', eyeSquintLeft],
    ['eyeBlinkRight', eyeSquintRight],
    ['cheekPuff', clamp01(mouthSmile * 0.4)],
    ['mouthPressLeft', clamp01(mouthSmile * 0.3)],
    ['mouthPressRight', clamp01(mouthSmile * 0.3)],
    ['mouthFrownLeft', clamp01(1 - mouthSmile)],
    ['mouthFrownRight', clamp01(1 - mouthSmile)],
    ['mouthRollLower', clamp01(jawOpen * 0.4)],
    ['mouthRollUpper', clamp01(jawOpen * 0.35)],
    ['mouthUpperUpLeft', clamp01(jawOpen * 0.5)],
    ['mouthUpperUpRight', clamp01(jawOpen * 0.5)],
    ['noseSneerLeft', clamp01(browRaiseLeft * 0.3)],
    ['noseSneerRight', clamp01(browRaiseRight * 0.3)],
    ['mouthStretchLeft', clamp01(mouthWidthNorm)],
    ['mouthStretchRight', clamp01(mouthWidthNorm)],
    ['mouthDimpleLeft', mouthSmile],
    ['mouthDimpleRight', mouthSmile],
    ['mouthLeft', clamp01(mouthWidthNorm * 0.5)],
    ['mouthRight', clamp01(mouthWidthNorm * 0.5)],
  ]);
}
