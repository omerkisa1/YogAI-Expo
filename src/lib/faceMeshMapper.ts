import type { Face } from 'react-native-vision-camera-face-detector';

export type FaceLandmark = { x: number; y: number; z: number };

type Point2D = { x: number; y: number };

const LANDMARK_COUNT = 478;

const emptyLandmarks = (): FaceLandmark[] =>
  Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0, y: 0, z: 0 }));

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function deadZone(v: number, threshold: number): number {
  return v < threshold ? 0 : v;
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

function meanPoint(points?: Point2D[]): Point2D | null {
  if (!points || points.length === 0) return null;
  const s = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / points.length, y: s.y / points.length };
}

function verticalExtent(points?: Point2D[]): number {
  if (!points || points.length === 0) return 0;
  let min = points[0].y;
  let max = points[0].y;
  for (const p of points) {
    if (p.y < min) min = p.y;
    if (p.y > max) max = p.y;
  }
  return max - min;
}

interface RawFaceMetrics {
  mouthOpenRatio: number;
  mouthWidthRatio: number;
  lipPuckerRatio: number;
  upperLipRaiseRatio: number;
  lowerLipDropRatio: number;
  leftEyeOpenRatio: number;
  rightEyeOpenRatio: number;
  leftBrowEyeDist: number;
  rightBrowEyeDist: number;
  noseWrinkleRatio: number;
  mouthCornerYDelta: number;
  smilingProbability: number;
  leftEyeOpenProbability: number;
  rightEyeOpenProbability: number;
  headYaw: number;
  headPitch: number;
}

interface FaceBaseline {
  mouthOpenRatio: number;
  mouthWidthRatio: number;
  upperLipRaiseRatio: number;
  leftEyeOpenRatio: number;
  rightEyeOpenRatio: number;
  leftBrowEyeDist: number;
  rightBrowEyeDist: number;
  noseWrinkleRatio: number;
  frameCount: number;
  isCalibrated: boolean;
}

const CALIBRATION_FRAMES = 15;

function createFaceBaseline(): FaceBaseline {
  return {
    mouthOpenRatio: 0,
    mouthWidthRatio: 0,
    upperLipRaiseRatio: 0,
    leftEyeOpenRatio: 0,
    rightEyeOpenRatio: 0,
    leftBrowEyeDist: 0,
    rightBrowEyeDist: 0,
    noseWrinkleRatio: 0,
    frameCount: 0,
    isCalibrated: false,
  };
}

function updateBaseline(baseline: FaceBaseline, metrics: RawFaceMetrics): FaceBaseline {
  if (baseline.isCalibrated) return baseline;

  const n = baseline.frameCount + 1;
  const lerp = (old: number, val: number) => old + (val - old) / n;

  return {
    mouthOpenRatio: lerp(baseline.mouthOpenRatio, metrics.mouthOpenRatio),
    mouthWidthRatio: lerp(baseline.mouthWidthRatio, metrics.mouthWidthRatio),
    upperLipRaiseRatio: lerp(baseline.upperLipRaiseRatio, metrics.upperLipRaiseRatio),
    leftEyeOpenRatio: lerp(baseline.leftEyeOpenRatio, metrics.leftEyeOpenRatio),
    rightEyeOpenRatio: lerp(baseline.rightEyeOpenRatio, metrics.rightEyeOpenRatio),
    leftBrowEyeDist: lerp(baseline.leftBrowEyeDist, metrics.leftBrowEyeDist),
    rightBrowEyeDist: lerp(baseline.rightBrowEyeDist, metrics.rightBrowEyeDist),
    noseWrinkleRatio: lerp(baseline.noseWrinkleRatio, metrics.noseWrinkleRatio),
    frameCount: n,
    isCalibrated: n >= CALIBRATION_FRAMES,
  };
}

function extractMetrics(face: Face): RawFaceMetrics {
  const bounds = face.bounds;
  const faceWidth = Math.max(bounds.width, 1);
  const faceHeight = Math.max(bounds.height, 1);
  const contours = face.contours;
  const landmarks = face.landmarks;

  const smilingProbability =
    typeof face.smilingProbability === 'number' ? clamp01(face.smilingProbability) : 0;
  const leftEyeOpenProbability =
    typeof face.leftEyeOpenProbability === 'number' ? clamp01(face.leftEyeOpenProbability) : 1;
  const rightEyeOpenProbability =
    typeof face.rightEyeOpenProbability === 'number' ? clamp01(face.rightEyeOpenProbability) : 1;
  const headYaw = typeof face.yawAngle === 'number' ? face.yawAngle : 0;
  const headPitch = typeof face.pitchAngle === 'number' ? face.pitchAngle : 0;

  const upperLipBottomCenter = meanPoint(contours?.UPPER_LIP_BOTTOM);
  const lowerLipTopCenter = meanPoint(contours?.LOWER_LIP_TOP);
  const upperLipTopCenter = meanPoint(contours?.UPPER_LIP_TOP);

  const mouthOpenDist =
    upperLipBottomCenter && lowerLipTopCenter
      ? dist(upperLipBottomCenter, lowerLipTopCenter)
      : 0;
  const mouthOpenRatio = mouthOpenDist / faceHeight;

  const mouthLeft: Point2D | undefined =
    landmarks?.MOUTH_LEFT ?? contours?.UPPER_LIP_TOP?.[0];
  const upperLipTop = contours?.UPPER_LIP_TOP;
  const mouthRight: Point2D | undefined =
    landmarks?.MOUTH_RIGHT ?? (upperLipTop ? upperLipTop[upperLipTop.length - 1] : undefined);

  const mouthWidth =
    mouthLeft && mouthRight ? dist(mouthLeft, mouthRight) : faceWidth * 0.4;
  const mouthWidthRatio = mouthWidth / faceWidth;

  const upperLipRaiseRatio =
    upperLipTopCenter && upperLipBottomCenter
      ? dist(upperLipTopCenter, upperLipBottomCenter) / faceHeight
      : 0;

  const narrowMouth = clamp01((0.38 - mouthWidthRatio) / 0.1);
  const lipPuckerRatio = clamp01(narrowMouth * 0.5 + upperLipRaiseRatio * 8);

  const leftEyeExtent = verticalExtent(contours?.LEFT_EYE);
  const rightEyeExtent = verticalExtent(contours?.RIGHT_EYE);
  const leftEyeOpenRatio = clamp01(leftEyeExtent / (faceHeight * 0.06));
  const rightEyeOpenRatio = clamp01(rightEyeExtent / (faceHeight * 0.06));

  const leftBrowCenter = meanPoint(contours?.LEFT_EYEBROW_BOTTOM);
  const rightBrowCenter = meanPoint(contours?.RIGHT_EYEBROW_BOTTOM);
  const leftEyeCenter = meanPoint(contours?.LEFT_EYE);
  const rightEyeCenter = meanPoint(contours?.RIGHT_EYE);
  const leftBrowEyeDist =
    leftBrowCenter && leftEyeCenter ? dist(leftBrowCenter, leftEyeCenter) / faceHeight : 0;
  const rightBrowEyeDist =
    rightBrowCenter && rightEyeCenter ? dist(rightBrowCenter, rightEyeCenter) / faceHeight : 0;

  const noseBridgeTop = contours?.NOSE_BRIDGE?.[0];
  const noseBottomCenter = meanPoint(contours?.NOSE_BOTTOM);
  const noseWrinkleRatio =
    noseBridgeTop && noseBottomCenter
      ? dist(noseBridgeTop, noseBottomCenter) / faceHeight
      : 0;

  const cornerY =
    mouthLeft && mouthRight ? (mouthLeft.y + mouthRight.y) / 2 : 0;
  const centerY = upperLipBottomCenter ? upperLipBottomCenter.y : cornerY;
  const mouthCornerYDelta = (centerY - cornerY) / faceHeight;

  return {
    mouthOpenRatio,
    mouthWidthRatio,
    lipPuckerRatio,
    upperLipRaiseRatio,
    lowerLipDropRatio: mouthOpenRatio * 0.7,
    leftEyeOpenRatio,
    rightEyeOpenRatio,
    leftBrowEyeDist,
    rightBrowEyeDist,
    noseWrinkleRatio,
    mouthCornerYDelta,
    smilingProbability,
    leftEyeOpenProbability,
    rightEyeOpenProbability,
    headYaw,
    headPitch,
  };
}

function metricsToBlendshapes(
  metrics: RawFaceMetrics,
  baseline: FaceBaseline,
): Map<string, number> {
  const map = new Map<string, number>();
  const cal = baseline.isCalibrated;

  const jawOpen = cal
    ? normalize(metrics.mouthOpenRatio, baseline.mouthOpenRatio + 0.02, baseline.mouthOpenRatio + 0.15)
    : clamp01(metrics.mouthOpenRatio * 5);
  map.set('jawOpen', deadZone(jawOpen, 0.05));

  const smileRaw = metrics.smilingProbability;
  const smile = cal
    ? normalize(smileRaw, 0.38, 0.88)
    : clamp01((smileRaw - 0.38) / 0.5);
  map.set('mouthSmileLeft', deadZone(smile, 0.1));
  map.set('mouthSmileRight', deadZone(smile, 0.1));
  map.set('mouthDimpleLeft', deadZone(smile, 0.1));
  map.set('mouthDimpleRight', deadZone(smile, 0.1));

  const widthShrink = cal ? baseline.mouthWidthRatio - metrics.mouthWidthRatio : 0;
  const puckerFromWidth = cal ? normalize(widthShrink, 0.015, 0.1) : 0;
  const puckerFromLip = cal
    ? normalize(metrics.upperLipRaiseRatio, baseline.upperLipRaiseRatio * 1.05, baseline.upperLipRaiseRatio + 0.035)
    : clamp01(metrics.lipPuckerRatio * 1.2);
  const pucker = cal ? clamp01(Math.max(puckerFromWidth, puckerFromLip * 0.85)) : clamp01(metrics.lipPuckerRatio * 1.2);
  const puckerCorrected = jawOpen > 0.3 ? pucker * 0.2 : pucker;
  map.set('mouthPucker', deadZone(puckerCorrected, 0.08));

  const leftEyeSquint = cal
    ? normalize(1 - metrics.leftEyeOpenProbability, 0.35, 0.78)
    : clamp01((1 - metrics.leftEyeOpenProbability - 0.35) / 0.43);
  const rightEyeSquint = cal
    ? normalize(1 - metrics.rightEyeOpenProbability, 0.35, 0.78)
    : clamp01((1 - metrics.rightEyeOpenProbability - 0.35) / 0.43);
  map.set('eyeSquintLeft', deadZone(leftEyeSquint, 0.05));
  map.set('eyeSquintRight', deadZone(rightEyeSquint, 0.05));
  map.set('eyeBlinkLeft', deadZone(leftEyeSquint, 0.05));
  map.set('eyeBlinkRight', deadZone(rightEyeSquint, 0.05));
  map.set('eyeWideLeft', clamp01(metrics.leftEyeOpenProbability));
  map.set('eyeWideRight', clamp01(metrics.rightEyeOpenProbability));

  const browRaiseRaw = (metrics.leftBrowEyeDist + metrics.rightBrowEyeDist) / 2;
  const baseBrow = (baseline.leftBrowEyeDist + baseline.rightBrowEyeDist) / 2;
  const browRaise = cal
    ? normalize(browRaiseRaw, baseBrow * 1.05, baseBrow * 1.4)
    : 0;
  map.set('browInnerUp', deadZone(browRaise, 0.05));

  const browDown = cal
    ? normalize(baseBrow * 0.95 - browRaiseRaw, 0, baseBrow * 0.25)
    : 0;
  map.set('browDownLeft', deadZone(browDown, 0.05));
  map.set('browDownRight', deadZone(browDown, 0.05));

  const jawRight = clamp01(Math.max(0, metrics.headYaw / 20));
  const jawLeft = clamp01(Math.max(0, -metrics.headYaw / 20));
  map.set('jawRight', deadZone(jawRight, 0.03));
  map.set('jawLeft', deadZone(jawLeft, 0.03));

  const mouthFunnel = cal
    ? normalize(metrics.mouthOpenRatio, baseline.mouthOpenRatio + 0.03, baseline.mouthOpenRatio + 0.08)
    : clamp01(metrics.mouthOpenRatio * 8);
  const funnelCorrected = jawOpen > 0.4 ? 0 : mouthFunnel;
  const funnelWithPucker = Math.max(funnelCorrected, pucker * 0.5);
  map.set('mouthFunnel', deadZone(funnelWithPucker, 0.05));

  const upperLipRaise = cal
    ? normalize(metrics.upperLipRaiseRatio, baseline.upperLipRaiseRatio * 1.08, baseline.upperLipRaiseRatio + 0.035)
    : clamp01(metrics.upperLipRaiseRatio * 15);
  map.set('mouthShrugUpper', deadZone(upperLipRaise, 0.05));
  map.set('mouthUpperUpLeft', deadZone(upperLipRaise, 0.05));
  map.set('mouthUpperUpRight', deadZone(upperLipRaise, 0.05));

  const frown = cal
    ? normalize(-metrics.mouthCornerYDelta, 0, 0.03)
    : clamp01(-metrics.mouthCornerYDelta * 30);
  const frownCorrected = smile > 0.2 ? 0 : frown;
  map.set('mouthFrownLeft', deadZone(frownCorrected, 0.05));
  map.set('mouthFrownRight', deadZone(frownCorrected, 0.05));

  const noseWrinkle = cal
    ? normalize(baseline.noseWrinkleRatio - metrics.noseWrinkleRatio, 0, baseline.noseWrinkleRatio * 0.15)
    : 0;
  map.set('noseSneerLeft', deadZone(noseWrinkle, 0.05));
  map.set('noseSneerRight', deadZone(noseWrinkle, 0.05));

  const lipRollDelta = cal ? metrics.upperLipRaiseRatio - baseline.upperLipRaiseRatio : 0;
  const mouthRollUpper = cal ? normalize(lipRollDelta, 0.004, 0.028) : 0;
  const rollCorrected = jawOpen > 0.3 ? 0 : mouthRollUpper;
  map.set('mouthRollUpper', deadZone(rollCorrected, 0.05));
  map.set('mouthRollLower', deadZone(rollCorrected * 0.8, 0.05));

  const chinRaise = clamp01(Math.abs(metrics.headPitch) / 12);
  const chinCorrected = puckerCorrected > 0.3 ? clamp01(chinRaise * 1.25 + puckerCorrected * 0.35) : chinRaise;
  map.set('chinRaiser', deadZone(clamp01(chinCorrected), 0.05));

  const cheekPuff = cal
    ? normalize(metrics.mouthWidthRatio, baseline.mouthWidthRatio * 1.05, baseline.mouthWidthRatio * 1.25)
    : 0;
  map.set('cheekPuff', deadZone(cheekPuff, 0.05));

  map.set('mouthPressLeft', clamp01(smile * 0.2 + jawOpen * 0.15));
  map.set('mouthPressRight', clamp01(smile * 0.2 + jawOpen * 0.15));

  return map;
}

let globalBaseline = createFaceBaseline();

export function resetFaceBaseline(): void {
  globalBaseline = createFaceBaseline();
}

export function isBaselineCalibrated(): boolean {
  return globalBaseline.isCalibrated;
}

export function mapMLKitToBlendshapes(face: Face): Map<string, number> {
  const metrics = extractMetrics(face);
  globalBaseline = updateBaseline(globalBaseline, metrics);
  return metricsToBlendshapes(metrics, globalBaseline);
}

export function buildFaceLandmarksFromMlKit(face: Face): FaceLandmark[] {
  const lm = emptyLandmarks();
  const bounds = face.bounds;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const w = Math.max(bounds.width, 1e-6);
  const h = Math.max(bounds.height, 1e-6);

  const contours = face.contours;
  const landmarks = face.landmarks;

  const set = (idx: number, x: number, y: number, z = 0) => {
    lm[idx] = { x: clamp01(x), y: clamp01(y), z };
  };

  const forehead = meanPoint(contours?.FACE?.slice(0, Math.min(8, contours?.FACE?.length ?? 0))) ?? {
    x: cx,
    y: cy - h * 0.35,
  };
  const chin =
    meanPoint(contours?.FACE?.slice(Math.max(0, (contours?.FACE?.length ?? 0) - 6))) ?? {
      x: cx,
      y: cy + h * 0.42,
    };
  const leftCheek = landmarks?.LEFT_CHEEK ?? { x: cx - w * 0.28, y: cy };
  const rightCheek = landmarks?.RIGHT_CHEEK ?? { x: cx + w * 0.28, y: cy };
  const noseTip = landmarks?.NOSE_BASE ?? { x: cx, y: cy + h * 0.05 };
  const leftEye = meanPoint(contours?.LEFT_EYE) ?? { x: cx - w * 0.2, y: cy - h * 0.1 };
  const rightEye = meanPoint(contours?.RIGHT_EYE) ?? { x: cx + w * 0.2, y: cy - h * 0.1 };
  const mouthLeft = landmarks?.MOUTH_LEFT ?? { x: cx - w * 0.2, y: cy + h * 0.15 };
  const mouthRight = landmarks?.MOUTH_RIGHT ?? { x: cx + w * 0.2, y: cy + h * 0.15 };

  const pitchMag = Math.abs(typeof face.pitchAngle === 'number' ? face.pitchAngle : 0);
  const chinZ = -pitchMag * 0.006;
  const foreheadZ = pitchMag * 0.006;

  set(10, (forehead.x - bounds.x) / w, (forehead.y - bounds.y) / h, foreheadZ);
  set(152, (chin.x - bounds.x) / w, (chin.y - bounds.y) / h, chinZ);
  set(234, (leftCheek.x - bounds.x) / w, (leftCheek.y - bounds.y) / h);
  set(454, (rightCheek.x - bounds.x) / w, (rightCheek.y - bounds.y) / h);
  set(168, (noseTip.x - bounds.x) / w, (noseTip.y - bounds.y) / h);
  set(1, (noseTip.x - bounds.x) / w, (noseTip.y - bounds.y) / h - 0.02);
  set(54, (mouthLeft.x - bounds.x) / w, (mouthLeft.y - bounds.y) / h);
  set(284, (mouthRight.x - bounds.x) / w, (mouthRight.y - bounds.y) / h);
  set(33, (leftEye.x - bounds.x) / w, (leftEye.y - bounds.y) / h);
  set(263, (rightEye.x - bounds.x) / w, (rightEye.y - bounds.y) / h);

  return lm;
}
