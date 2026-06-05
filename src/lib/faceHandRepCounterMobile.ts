import {
  distance2D,
  getClosestHandPointToRegion,
  getFaceWidthFromBox,
  getHandCenter,
  getRegionCenterOnFace,
  handNearRegion,
  isHandFist,
  isHandOpen,
  isHandOverlappingFace,
  type FaceHandRegion,
  type NormalizedFaceBox,
  type NormalizedPoint,
} from '@/lib/faceHandCoordinates';

export type MobileFaceHandMotionType = 'hold' | 'circular' | 'sweep';
export type MobileFaceHandSweepDirection = 'horizontal' | 'vertical' | 'any';

export type MobileFaceHandFeedbackState =
  | 'guide_hand'
  | 'guide_action'
  | 'guide_motion'
  | 'hold'
  | 'good'
  | 'complete';

export type FaceHandUiFeedbackState = MobileFaceHandFeedbackState;

export interface MobileFaceHandConfig {
  requiredRegion: FaceHandRegion;
  requiredHandShape: 'open' | 'fist' | 'any';
  motionType: MobileFaceHandMotionType;
  holdDurationMs: number;
  circularAngleDeg: number;
  sweepDistance: number;
  sweepDirection: MobileFaceHandSweepDirection;
  repTarget: number;
  feedbackKey: string;
  barLabelKey: string;
  overlapBarThreshold: number;
  requiresBlendshape?: string;
  blendshapeThreshold?: number;
  cooldownMs: number;
  stabilizeMs: number;
}

export interface MobileFaceHandResult {
  reps: number;
  target: number;
  isActive: boolean;
  holdProgress: number;
  isComplete: boolean;
  progress: number;
  feedbackKey: string;
  feedbackState: MobileFaceHandFeedbackState;
  overlapScore: number;
  handDetected: boolean;
  motionType: MobileFaceHandMotionType;
}

export interface FaceHandUiResult {
  reps: number;
  target: number;
  currentProximity: number;
  holdProgress: number;
  isComplete: boolean;
  progress: number;
  feedbackKey: string;
  feedbackState: FaceHandUiFeedbackState;
  barLabelKey: string;
  handDetected: boolean;
  overlapScore: number;
  motionType: MobileFaceHandMotionType;
  isActive: boolean;
}

type InternalPhase = 'guide_hand' | 'stabilizing' | 'active' | 'cooldown' | 'returning';

const CIRCULAR_MIN_RADIUS = 0.012;
const CIRCULAR_NOISE_GATE_DEG = 1.5;
const MOTION_GRACE_MS = 500;
const TRACK_TIP = 8;

const BASE_CONFIG = {
  overlapBarThreshold: 0.45,
  cooldownMs: 800,
  stabilizeMs: 300,
};

export const MOBILE_FACE_HAND_CONFIGS: Record<string, MobileFaceHandConfig> = {
  face_hand_cheek_massage: {
    requiredRegion: 'cheek',
    requiredHandShape: 'any',
    motionType: 'circular',
    holdDurationMs: 0,
    circularAngleDeg: 330,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackCheekMassage',
    barLabelKey: 'cheekMassageLevel',
    ...BASE_CONFIG,
  },
  face_hand_forehead_smooth: {
    requiredRegion: 'forehead',
    requiredHandShape: 'any',
    motionType: 'sweep',
    holdDurationMs: 0,
    circularAngleDeg: 0,
    sweepDistance: 0.28,
    sweepDirection: 'horizontal',
    repTarget: 5,
    feedbackKey: 'feedbackForeheadSmooth',
    barLabelKey: 'foreheadSmoothLevel',
    ...BASE_CONFIG,
  },
  face_hand_jaw_release: {
    requiredRegion: 'chin',
    requiredHandShape: 'any',
    motionType: 'hold',
    holdDurationMs: 2500,
    circularAngleDeg: 0,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackJawRelease',
    barLabelKey: 'jawReleaseLevel',
    overlapBarThreshold: 0.4,
    requiresBlendshape: 'jawOpen',
    blendshapeThreshold: 0.25,
    cooldownMs: 600,
    stabilizeMs: 300,
  },
  face_hand_eye_press: {
    requiredRegion: 'eye',
    requiredHandShape: 'any',
    motionType: 'hold',
    holdDurationMs: 2000,
    circularAngleDeg: 0,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackEyePress',
    barLabelKey: 'eyePressLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 600,
    stabilizeMs: 300,
  },
  face_hand_temple_massage: {
    requiredRegion: 'temple',
    requiredHandShape: 'any',
    motionType: 'circular',
    holdDurationMs: 0,
    circularAngleDeg: 330,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackTempleMassage',
    barLabelKey: 'templeMassageLevel',
    ...BASE_CONFIG,
  },
  face_hand_nose_bridge: {
    requiredRegion: 'forehead',
    requiredHandShape: 'any',
    motionType: 'hold',
    holdDurationMs: 2000,
    circularAngleDeg: 0,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackNoseBridge',
    barLabelKey: 'noseBridgeLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 600,
    stabilizeMs: 300,
  },
  face_hand_chin_lift: {
    requiredRegion: 'chin',
    requiredHandShape: 'any',
    motionType: 'hold',
    holdDurationMs: 3000,
    circularAngleDeg: 0,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackChinLift',
    barLabelKey: 'chinLiftLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 600,
    stabilizeMs: 300,
  },
  face_hand_lip_press: {
    requiredRegion: 'cheek',
    requiredHandShape: 'any',
    motionType: 'hold',
    holdDurationMs: 2000,
    circularAngleDeg: 0,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackLipPress',
    barLabelKey: 'lipPressLevel',
    overlapBarThreshold: 0.4,
    requiresBlendshape: 'mouthPressLeft',
    blendshapeThreshold: 0.2,
    cooldownMs: 600,
    stabilizeMs: 300,
  },
  face_hand_brow_smooth: {
    requiredRegion: 'forehead',
    requiredHandShape: 'any',
    motionType: 'sweep',
    holdDurationMs: 0,
    circularAngleDeg: 0,
    sweepDistance: 0.28,
    sweepDirection: 'horizontal',
    repTarget: 5,
    feedbackKey: 'feedbackBrowSmooth',
    barLabelKey: 'browSmoothLevel',
    ...BASE_CONFIG,
  },
  face_hand_neck_side: {
    requiredRegion: 'chin',
    requiredHandShape: 'any',
    motionType: 'hold',
    holdDurationMs: 3000,
    circularAngleDeg: 0,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackNeckSide',
    barLabelKey: 'neckSideLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 600,
    stabilizeMs: 300,
  },
  face_hand_cheek_lift: {
    requiredRegion: 'cheek',
    requiredHandShape: 'any',
    motionType: 'sweep',
    holdDurationMs: 0,
    circularAngleDeg: 0,
    sweepDistance: 0.25,
    sweepDirection: 'vertical',
    repTarget: 5,
    feedbackKey: 'feedbackCheekLift',
    barLabelKey: 'cheekLiftLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 600,
    stabilizeMs: 300,
  },
  face_hand_jaw_side: {
    requiredRegion: 'temple',
    requiredHandShape: 'any',
    motionType: 'hold',
    holdDurationMs: 2500,
    circularAngleDeg: 0,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackJawSide',
    barLabelKey: 'jawSideLevel',
    overlapBarThreshold: 0.4,
    requiresBlendshape: 'jawRight',
    blendshapeThreshold: 0.1,
    cooldownMs: 600,
    stabilizeMs: 300,
  },
  face_hand_eye_brow_lift: {
    requiredRegion: 'forehead',
    requiredHandShape: 'any',
    motionType: 'hold',
    holdDurationMs: 2000,
    circularAngleDeg: 0,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackEyeBrowLift',
    barLabelKey: 'eyeBrowLiftLevel',
    overlapBarThreshold: 0.4,
    requiresBlendshape: 'eyeWideLeft',
    blendshapeThreshold: 0.25,
    cooldownMs: 600,
    stabilizeMs: 300,
  },
  face_hand_jawline_sculpt: {
    requiredRegion: 'chin',
    requiredHandShape: 'any',
    motionType: 'sweep',
    holdDurationMs: 0,
    circularAngleDeg: 0,
    sweepDistance: 0.45,
    sweepDirection: 'vertical',
    repTarget: 8,
    feedbackKey: 'feedbackJawlineSculpt',
    barLabelKey: 'jawlineSculptLevel',
    ...BASE_CONFIG,
    stabilizeMs: 500,
  },
  face_hand_under_eye_tap: {
    requiredRegion: 'eye',
    requiredHandShape: 'any',
    motionType: 'circular',
    holdDurationMs: 0,
    circularAngleDeg: 270,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackUnderEyeTap',
    barLabelKey: 'underEyeTapLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 800,
    stabilizeMs: 300,
  },
  face_hand_nasolabial_smooth: {
    requiredRegion: 'cheek',
    requiredHandShape: 'any',
    motionType: 'sweep',
    holdDurationMs: 0,
    circularAngleDeg: 0,
    sweepDistance: 0.35,
    sweepDirection: 'vertical',
    repTarget: 5,
    feedbackKey: 'feedbackNasolabialSmooth',
    barLabelKey: 'nasolabialSmoothLevel',
    ...BASE_CONFIG,
    stabilizeMs: 400,
  },
  face_hand_forehead_tap: {
    requiredRegion: 'forehead',
    requiredHandShape: 'any',
    motionType: 'circular',
    holdDurationMs: 0,
    circularAngleDeg: 270,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackForeheadTap',
    barLabelKey: 'foreheadTapLevel',
    ...BASE_CONFIG,
  },
  face_hand_chin_circular: {
    requiredRegion: 'chin',
    requiredHandShape: 'any',
    motionType: 'circular',
    holdDurationMs: 0,
    circularAngleDeg: 330,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackChinCircular',
    barLabelKey: 'chinCircularLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 800,
    stabilizeMs: 300,
  },
  face_hand_ear_to_shoulder: {
    requiredRegion: 'temple',
    requiredHandShape: 'any',
    motionType: 'hold',
    holdDurationMs: 3000,
    circularAngleDeg: 0,
    sweepDistance: 0,
    sweepDirection: 'any',
    repTarget: 5,
    feedbackKey: 'feedbackEarToShoulder',
    barLabelKey: 'earToShoulderLevel',
    overlapBarThreshold: 0.45,
    cooldownMs: 600,
    stabilizeMs: 400,
  },
};

export function toFaceHandUiResult(result: MobileFaceHandResult, barLabelKey: string): FaceHandUiResult {
  return {
    reps: result.reps,
    target: result.target,
    currentProximity: result.overlapScore,
    holdProgress: result.holdProgress,
    isComplete: result.isComplete,
    progress: result.progress,
    feedbackKey: result.feedbackKey,
    feedbackState: result.feedbackState,
    barLabelKey,
    handDetected: result.handDetected,
    overlapScore: result.overlapScore,
    motionType: result.motionType,
    isActive: result.isActive,
  };
}

function shapeOk(config: MobileFaceHandConfig, landmarks: NormalizedPoint[]): boolean {
  if (config.requiredHandShape === 'any') return true;
  if (config.requiredHandShape === 'open') return isHandOpen(landmarks);
  return isHandFist(landmarks);
}

function blendshapeOk(
  config: MobileFaceHandConfig,
  blendshapes?: Map<string, number>,
): boolean {
  if (!config.requiresBlendshape) return true;
  const val = blendshapes?.get(config.requiresBlendshape) ?? 0;
  return val >= (config.blendshapeThreshold ?? 0.25);
}

function createMobileFaceHandCounter(poseId: string, customRepTarget?: number) {
  const config = MOBILE_FACE_HAND_CONFIGS[poseId];
  if (!config) return null;

  const target = customRepTarget && customRepTarget > 0 ? customRepTarget : config.repTarget;
  const motionType = config.motionType;
  const stabilizeMs = config.stabilizeMs;
  const cooldownMs = config.cooldownMs;

  let reps = 0;
  let phase: InternalPhase = 'guide_hand';
  let phaseStart = 0;
  let lastOverlap = 0;

  let prevAngleRad: number | null = null;
  let cumulativeAngleDeg = 0;

  let sweepStartPos: NormalizedPoint | null = null;
  let sweepBaselineDist = 0;
  let sweepComplete = false;
  let trackedPoint: NormalizedPoint | null = null;

  let holdStartTime = 0;
  let graceStartTime = 0;

  function resetMotionState() {
    prevAngleRad = null;
    cumulativeAngleDeg = 0;
    sweepStartPos = null;
    sweepBaselineDist = 0;
    sweepComplete = false;
    trackedPoint = null;
    holdStartTime = 0;
    graceStartTime = 0;
  }

  function initActivePhase(
    handLandmarks: NormalizedPoint[],
    faceBox: NormalizedFaceBox,
    fallback: NormalizedPoint,
  ) {
    resetMotionState();
    const closest = getClosestHandPointToRegion(handLandmarks, faceBox, config.requiredRegion);
    trackedPoint = closest?.point ?? handLandmarks[TRACK_TIP] ?? fallback;

    if (motionType === 'sweep') {
      sweepStartPos =
        getRegionCenterOnFace(faceBox, config.requiredRegion) ?? fallback;
      if (trackedPoint && sweepStartPos) {
        sweepBaselineDist = distance2D(trackedPoint, sweepStartPos);
      }
    }
    if (motionType === 'hold') {
      holdStartTime = Date.now();
    }
  }

  function getTrackedPoint(handLandmarks: NormalizedPoint[]): NormalizedPoint {
    return handLandmarks[TRACK_TIP] ?? getHandCenter(handLandmarks);
  }

  function update(
    handLandmarks: NormalizedPoint[] | null,
    faceBox: NormalizedFaceBox | null,
    blendshapes?: Map<string, number>,
  ): MobileFaceHandResult {
    if (reps >= target) {
      return buildResult('complete', lastOverlap, false, 1, 1, false);
    }

    const handDetected = handLandmarks !== null && handLandmarks.length >= 21;
    const now = Date.now();

    if (!handDetected || !faceBox) {
      phase = 'guide_hand';
      phaseStart = 0;
      resetMotionState();
      return buildResult('guide_hand', 0, false, 0, reps / target, false);
    }

    const overlap = isHandOverlappingFace(handLandmarks, faceBox, 0.08);
    lastOverlap = overlap.overlapScore;

    const regionNear = handNearRegion(handLandmarks, faceBox, config.requiredRegion, 0.4);
    const handNearFace = overlap.overlapping || regionNear;
    const proximity = overlap.overlapScore;

    const blendOk = blendshapeOk(config, blendshapes);
    const shapePasses = shapeOk(config, handLandmarks);

    if (motionType === 'sweep' && phase === 'active') {
      const tip = getTrackedPoint(handLandmarks);
      const onFace = overlap.overlapping || regionNear;

      if (onFace && sweepStartPos) {
        const faceWidth = getFaceWidthFromBox(faceBox);
        const sweepThreshold = Math.max(faceWidth * config.sweepDistance, 0.05);
        const dist = distance2D(tip, sweepStartPos);
        const netDist = Math.max(dist - sweepBaselineDist, 0);

        if (!sweepComplete && netDist >= sweepThreshold) {
          sweepComplete = true;
          reps++;
        }

        if (sweepComplete && !handNearFace) {
          const done = reps >= target;
          resetMotionState();
          phase = done ? 'guide_hand' : 'returning';
          phaseStart = now;
          return buildResult(done ? 'complete' : 'good', proximity, true, 1, reps / target, false);
        }

        const holdProgress = sweepThreshold > 0 ? Math.min(netDist / sweepThreshold, 1) : 0;
        const feedbackState: MobileFaceHandFeedbackState = sweepComplete
          ? 'good'
          : netDist > 0.01
            ? 'hold'
            : 'guide_motion';
        return buildResult(feedbackState, proximity, true, holdProgress, reps / target, true);
      }

      if (!sweepComplete) {
        phase = 'guide_hand';
        phaseStart = 0;
        resetMotionState();
      }
      return buildResult(sweepComplete ? 'good' : 'guide_hand', proximity, true, 0, reps / target, false);
    }

    if (!handNearFace || !regionNear) {
      if (phase === 'active' && motionType === 'circular') {
        if (graceStartTime === 0) graceStartTime = now;
        if (now - graceStartTime < MOTION_GRACE_MS) {
          const angleTarget = config.circularAngleDeg || 330;
          return buildResult(
            'hold',
            proximity,
            true,
            Math.min(cumulativeAngleDeg / angleTarget, 1),
            reps / target,
            true,
          );
        }
      }
      phase = 'guide_hand';
      phaseStart = 0;
      resetMotionState();
      return buildResult('guide_hand', proximity, true, 0, reps / target, false);
    }

    if (!shapePasses) {
      phase = 'guide_hand';
      phaseStart = 0;
      resetMotionState();
      return buildResult('guide_action', proximity, true, 0, reps / target, false);
    }

    if (!blendOk && phase !== 'active') {
      return buildResult('guide_action', proximity, true, 0, reps / target, false);
    }

    graceStartTime = 0;

    if (phase === 'guide_hand') {
      phase = 'stabilizing';
      phaseStart = now;
      resetMotionState();
    }

    if (phase === 'stabilizing') {
      if (now - phaseStart < stabilizeMs) {
        return buildResult('guide_hand', proximity, true, 0, reps / target, false);
      }
      phase = 'active';
      phaseStart = now;
      initActivePhase(handLandmarks, faceBox, getHandCenter(handLandmarks));
    }

    if (phase === 'cooldown') {
      if (now - phaseStart < cooldownMs) {
        return buildResult('good', proximity, true, 1, reps / target, false);
      }
      phase = 'active';
      phaseStart = now;
      initActivePhase(handLandmarks, faceBox, getHandCenter(handLandmarks));
    }

    if (phase === 'returning') {
      const origin = getRegionCenterOnFace(faceBox, config.requiredRegion);
      const tip = getTrackedPoint(handLandmarks);
      if (distance2D(tip, origin) < getFaceWidthFromBox(faceBox) * 0.3) {
        phase = 'stabilizing';
        phaseStart = now;
        resetMotionState();
      }
      return buildResult('guide_hand', proximity, true, 0, reps / target, false);
    }

    let holdProgress = 0;
    let feedbackState: MobileFaceHandFeedbackState = 'guide_motion';
    const tip = getTrackedPoint(handLandmarks);

    if (motionType === 'hold') {
      const elapsed = now - holdStartTime;
      holdProgress = Math.min(elapsed / Math.max(config.holdDurationMs, 1), 1);
      if (elapsed >= config.holdDurationMs) {
        reps++;
        phase = 'cooldown';
        phaseStart = now;
        resetMotionState();
        feedbackState = reps >= target ? 'complete' : 'good';
      } else {
        feedbackState = 'hold';
      }
    } else if (motionType === 'circular') {
      const center = getRegionCenterOnFace(faceBox, config.requiredRegion);
      const radius = distance2D(tip, center);
      const currentAngle = Math.atan2(tip.y - center.y, tip.x - center.x);

      if (prevAngleRad !== null && radius >= CIRCULAR_MIN_RADIUS) {
        let delta = currentAngle - prevAngleRad;
        while (delta > Math.PI) delta -= 2 * Math.PI;
        while (delta < -Math.PI) delta += 2 * Math.PI;
        const deltaDeg = Math.abs(delta) * (180 / Math.PI);
        if (deltaDeg >= CIRCULAR_NOISE_GATE_DEG) {
          cumulativeAngleDeg += deltaDeg;
        }
      }
      prevAngleRad = currentAngle;

      const angleTarget = config.circularAngleDeg || 330;
      holdProgress = Math.min(cumulativeAngleDeg / angleTarget, 1);

      if (cumulativeAngleDeg >= angleTarget) {
        reps++;
        phase = 'cooldown';
        phaseStart = now;
        resetMotionState();
        feedbackState = reps >= target ? 'complete' : 'good';
      } else if (cumulativeAngleDeg > 15) {
        feedbackState = 'hold';
      } else {
        feedbackState = 'guide_motion';
      }
    }

    return buildResult(feedbackState, proximity, true, holdProgress, reps / target, true);
  }

  function buildResult(
    feedbackState: MobileFaceHandFeedbackState,
    overlapScore: number,
    handDet: boolean,
    holdProgress: number,
    progress: number,
    isActive: boolean,
  ): MobileFaceHandResult {
    return {
      reps,
      target,
      isActive,
      holdProgress,
      isComplete: reps >= target,
      progress: Math.min(progress, 1),
      feedbackKey: config.feedbackKey,
      feedbackState,
      overlapScore,
      handDetected: handDet,
      motionType: config.motionType,
    };
  }

  function reset() {
    reps = 0;
    phase = 'guide_hand';
    phaseStart = 0;
    lastOverlap = 0;
    resetMotionState();
  }

  return { update, reset, getConfig: () => config };
}

export { createMobileFaceHandCounter };
