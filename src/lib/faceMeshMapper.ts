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

const squintFromEyeOpen = (open: number) => {
  if (open > 0.75) return 0;
  return clamp01((0.75 - open) / 0.35);
};

const BROW_NEUTRAL_RAW = 0.13;
const BROW_RAISE_SPAN = 0.065;

const mapBrowRaise = (raw: number) =>
  clamp01((raw - BROW_NEUTRAL_RAW) / BROW_RAISE_SPAN);

const mapBrowDown = (raw: number) => clamp01((0.14 - raw) / 0.06);

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
  const bounds = face.bounds;
  const boundsW = Math.max(bounds.width, 1);
  const boundsH = Math.max(bounds.height, 1);
  const contours = face.contours;
  const landmarks = face.landmarks;

  const mouthLeft = landmarks?.MOUTH_LEFT;
  const mouthRight = landmarks?.MOUTH_RIGHT;
  const mouthWidthNorm =
    mouthLeft && mouthRight
      ? clamp01(Math.hypot(mouthRight.x - mouthLeft.x, mouthRight.y - mouthLeft.y) / boundsW)
      : 0.35;

  const upperLip = contours?.UPPER_LIP_BOTTOM?.length
    ? avg(contours.UPPER_LIP_BOTTOM)
    : null;
  const lowerLip = contours?.LOWER_LIP_TOP?.length ? avg(contours.LOWER_LIP_TOP) : null;
  const lipGapNorm =
    upperLip && lowerLip
      ? clamp01(Math.hypot(upperLip.x - lowerLip.x, upperLip.y - lowerLip.y) / boundsH)
      : 0;

  const jawOpen = clamp01(lipGapNorm / 0.18);

  const leftBrow = contours?.LEFT_EYEBROW_TOP?.length ? avg(contours.LEFT_EYEBROW_TOP) : null;
  const rightBrow = contours?.RIGHT_EYEBROW_TOP?.length ? avg(contours.RIGHT_EYEBROW_TOP) : null;
  const leftEye = contours?.LEFT_EYE?.length ? avg(contours.LEFT_EYE) : null;
  const rightEye = contours?.RIGHT_EYE?.length ? avg(contours.RIGHT_EYE) : null;
  const browRaiseLeftRaw =
    leftBrow && leftEye
      ? Math.hypot(leftBrow.x - leftEye.x, leftBrow.y - leftEye.y) / boundsH
      : BROW_NEUTRAL_RAW;
  const browRaiseRightRaw =
    rightBrow && rightEye
      ? Math.hypot(rightBrow.x - rightEye.x, rightBrow.y - rightEye.y) / boundsH
      : BROW_NEUTRAL_RAW;

  const browRaiseLeft = mapBrowRaise(browRaiseLeftRaw);
  const browRaiseRight = mapBrowRaise(browRaiseRightRaw);
  const browInnerUp = Math.max(browRaiseLeft, browRaiseRight);
  const browDownLeft = mapBrowDown(browRaiseLeftRaw);
  const browDownRight = mapBrowDown(browRaiseRightRaw);

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

  const eyeSquintLeft = squintFromEyeOpen(leftEyeOpen);
  const eyeSquintRight = squintFromEyeOpen(rightEyeOpen);

  const noseBase = landmarks?.NOSE_BASE;
  const chin = contours?.FACE?.length
    ? avg(contours.FACE.slice(Math.max(0, contours.FACE.length - 4)))
    : null;
  const jawShiftX =
    noseBase && chin ? (chin.x - noseBase.x) / boundsW : 0;
  const jawRight = clamp01(Math.max(0, jawShiftX) / 0.12);
  const jawLeft = clamp01(Math.max(0, -jawShiftX) / 0.12);

  const lipPuckerSignal =
    upperLip && lowerLip && mouthLeft && mouthRight
      ? clamp01((1 - mouthWidthNorm) * clamp01(lipGapNorm / 0.06))
      : clamp01((1 - mouthWidthNorm) * 0.5);

  const mouthPucker = lipPuckerSignal;
  const mouthFunnel = clamp01(jawOpen * clamp01(1 - mouthWidthNorm * 1.2));
  const mouthShrugLower = clamp01(lipGapNorm / 0.12);

  const smileWidthFactor = clamp01((mouthWidthNorm - 0.3) / 0.22);
  const mouthSmile =
    smilingProb > 0.25
      ? clamp01(smileWidthFactor * clamp01((smilingProb - 0.2) / 0.55))
      : clamp01(smileWidthFactor * 0.15);

  const mouthCenterY =
    upperLip && lowerLip ? (upperLip.y + lowerLip.y) / 2 : bounds.y + boundsH * 0.62;
  const cornerDropLeft =
    mouthLeft && mouthCenterY ? clamp01((mouthLeft.y - mouthCenterY) / (boundsH * 0.08)) : 0;
  const cornerDropRight =
    mouthRight && mouthCenterY ? clamp01((mouthRight.y - mouthCenterY) / (boundsH * 0.08)) : 0;
  const mouthFrownLeft = clamp01(cornerDropLeft * (1 - mouthSmile * 0.85));
  const mouthFrownRight = clamp01(cornerDropRight * (1 - mouthSmile * 0.85));

  const leftCheek = landmarks?.LEFT_CHEEK;
  const rightCheek = landmarks?.RIGHT_CHEEK;
  const cheekPuff =
    leftCheek && rightCheek && mouthLeft && mouthRight
      ? clamp01(
          (Math.hypot(leftCheek.x - mouthLeft.x, leftCheek.y - mouthLeft.y) +
            Math.hypot(rightCheek.x - mouthRight.x, rightCheek.y - mouthRight.y)) /
            (boundsW * 0.9) -
            0.35,
        )
      : clamp01(jawOpen * 0.25);

  const mouthRollLower = clamp01(lipGapNorm / 0.14);
  const mouthRollUpper = clamp01(lipGapNorm / 0.16);

  return new Map<string, number>([
    ['jawOpen', jawOpen],
    ['jawRight', jawRight],
    ['jawLeft', jawLeft],
    ['mouthSmileLeft', mouthSmile],
    ['mouthSmileRight', mouthSmile],
    ['mouthPucker', mouthPucker],
    ['mouthFunnel', mouthFunnel],
    ['mouthShrugLower', mouthShrugLower],
    ['browRaiseLeft', browRaiseLeft],
    ['browRaiseRight', browRaiseRight],
    ['browInnerUp', browInnerUp],
    ['browOuterUpLeft', browRaiseLeft],
    ['browOuterUpRight', browRaiseRight],
    ['browDownLeft', browDownLeft],
    ['browDownRight', browDownRight],
    ['eyeSquintLeft', eyeSquintLeft],
    ['eyeSquintRight', eyeSquintRight],
    ['eyeWideLeft', clamp01(leftEyeOpen)],
    ['eyeWideRight', clamp01(rightEyeOpen)],
    ['eyeBlinkLeft', eyeSquintLeft],
    ['eyeBlinkRight', eyeSquintRight],
    ['cheekPuff', cheekPuff],
    ['mouthPressLeft', clamp01(mouthSmile * 0.2 + jawOpen * 0.15)],
    ['mouthPressRight', clamp01(mouthSmile * 0.2 + jawOpen * 0.15)],
    ['mouthFrownLeft', mouthFrownLeft],
    ['mouthFrownRight', mouthFrownRight],
    ['mouthRollLower', mouthRollLower],
    ['mouthRollUpper', mouthRollUpper],
    ['mouthUpperUpLeft', clamp01(jawOpen * 0.5)],
    ['mouthUpperUpRight', clamp01(jawOpen * 0.5)],
    ['noseSneerLeft', clamp01(browDownLeft * 0.5)],
    ['noseSneerRight', clamp01(browDownRight * 0.5)],
    ['mouthStretchLeft', clamp01(mouthWidthNorm)],
    ['mouthStretchRight', clamp01(mouthWidthNorm)],
    ['mouthDimpleLeft', mouthSmile],
    ['mouthDimpleRight', mouthSmile],
    ['mouthLeft', clamp01(Math.max(0, jawShiftX) / 0.1)],
    ['mouthRight', clamp01(Math.max(0, -jawShiftX) / 0.1)],
  ]);
}
