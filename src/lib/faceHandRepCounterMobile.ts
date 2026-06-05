import {
  distance2D,
  getClosestHandPointToRegion,
  getFaceWidthFromBox,
  getHandCenter,
  getRegionCenterOnFace,
  getSweepDisplacement,
  handNearChinRegion,
  handNearRegion,
  isPointInsideFaceBox,
  isHandFist,
  isHandOpen,
  isHandOverlappingFace,
  type FaceHandRegion,
  type NormalizedFaceBox,
  type NormalizedPoint,
} from '@/lib/faceHandCoordinates';
import {
  createMotionState,
  detectCircularMotion,
  hardResetMotionState,
  isMotionExpired,
  pauseMotion,
  resumeMotion,
  type MotionState,
} from '@/lib/faceHandMotionTracker';

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
  motionPaused?: boolean;
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
  motionPaused?: boolean;
}

type InternalPhase = 'guide_hand' | 'stabilizing' | 'active' | 'cooldown';

const MOTION_GRACE_MS = 800;
const OVERLAP_MEMORY_MS = 800;
const REP_COOLDOWN_MS = 500;
const SWEEP_NOISE_FLOOR = 0.01;
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
    sweepDistance: 0.17,
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
    blendshapeThreshold: 0.18,
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
    sweepDistance: 0.17,
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
    motionPaused: result.motionPaused,
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

  let reps = 0;
  let phase: InternalPhase = 'guide_hand';
  let phaseStart = 0;
  let lastOverlap = 0;
  let lastHoldProgress = 0;
  let lastOverlapScore = 0;
  let overlapMemoryUntil = 0;
  let cooldownStartTime = 0;
  const motionState: MotionState = createMotionState();

  let sweepHandStart: NormalizedPoint | null = null;
  let sweepMaxProgress = 0;
  let lockedSweepIdx: number | null = null;
  let trackedPoint: NormalizedPoint | null = null;

  let holdStartTime = 0;
  let graceStartTime = 0;

  function resetMotionState() {
    sweepHandStart = null;
    sweepMaxProgress = 0;
    lockedSweepIdx = null;
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
    hardResetMotionState(motionState);
    const closest = getClosestHandPointToRegion(handLandmarks, faceBox, config.requiredRegion);
    lockedSweepIdx = closest?.landmarkIndex ?? TRACK_TIP;
    trackedPoint = closest?.point ?? handLandmarks[TRACK_TIP] ?? fallback;

    if (motionType === 'sweep' && trackedPoint) {
      sweepHandStart = { x: trackedPoint.x, y: trackedPoint.y, z: trackedPoint.z ?? 0 };
      sweepMaxProgress = 0;
    }
    if (motionType === 'hold' && !config.requiresBlendshape) {
      holdStartTime = Date.now();
    }
  }

  function getTrackedPoint(handLandmarks: NormalizedPoint[]): NormalizedPoint {
    return handLandmarks[TRACK_TIP] ?? getHandCenter(handLandmarks);
  }

  function handleActiveDropout(
    proximity: number,
    handDet: boolean,
  ): MobileFaceHandResult | null {
    pauseMotion(motionState);
    if (isMotionExpired(motionState)) {
      phase = 'guide_hand';
      phaseStart = 0;
      overlapMemoryUntil = 0;
      hardResetMotionState(motionState);
      resetMotionState();
      return buildResult('guide_hand', proximity, handDet, 0, reps / target, false);
    }
    return buildResult(
      'hold',
      proximity,
      handDet,
      lastHoldProgress,
      reps / target,
      true,
      true,
    );
  }

  function update(
    handLandmarks: NormalizedPoint[] | null,
    faceBox: NormalizedFaceBox | null,
    blendshapes?: Map<string, number>,
    isGhostHand?: boolean,
  ): MobileFaceHandResult {
    if (reps >= target) {
      return buildResult('complete', lastOverlap, false, 1, 1, false);
    }

    const handDetected = handLandmarks !== null && handLandmarks.length >= 21;
    const now = Date.now();

    if (!handDetected || !faceBox) {
      if (phase === 'active') {
        const dropped = handleActiveDropout(lastOverlapScore, false);
        if (dropped) return dropped;
      }
      if (phase !== 'cooldown') {
        phase = 'guide_hand';
        phaseStart = 0;
        overlapMemoryUntil = 0;
        resetMotionState();
        hardResetMotionState(motionState);
      }
      return buildResult('guide_hand', 0, false, 0, reps / target, false);
    }

    if (motionState.isPaused) {
      resumeMotion(motionState);
    }

    const overlapMargin =
      config.requiredRegion === 'chin' && motionType === 'hold' ? 0.14 : 0.08;
    const overlap = isHandOverlappingFace(handLandmarks, faceBox, overlapMargin);
    if (overlap.overlapping) {
      overlapMemoryUntil = now + OVERLAP_MEMORY_MS;
    }
    const overlapOk = overlap.overlapping || now < overlapMemoryUntil;
    lastOverlap = overlap.overlapScore;
    lastOverlapScore = overlap.overlapScore;

    const regionNear =
      config.requiredRegion === 'chin' && motionType === 'hold'
        ? handNearChinRegion(handLandmarks, faceBox, 0.58)
        : handNearRegion(handLandmarks, faceBox, config.requiredRegion, 0.4);
    const handNearFace = overlapOk || regionNear;
    const proximity = overlap.overlapScore;

    const blendOk = blendshapeOk(config, blendshapes);
    const shapePasses = isGhostHand ? true : shapeOk(config, handLandmarks);

    if (motionType === 'sweep' && phase === 'active') {
      const liveTip =
        lockedSweepIdx !== null && handLandmarks[lockedSweepIdx]
          ? handLandmarks[lockedSweepIdx]
          : getTrackedPoint(handLandmarks);
      const onFace =
        isPointInsideFaceBox(liveTip, faceBox, 0.14) ||
        handNearFace ||
        sweepMaxProgress > 0.08;

      if (sweepHandStart && lockedSweepIdx !== null) {
        const faceWidth = getFaceWidthFromBox(faceBox);
        const sweepThreshold = Math.max(faceWidth * config.sweepDistance, 0.035);
        const rawDist = getSweepDisplacement(liveTip, sweepHandStart, config.sweepDirection);
        const netDist = Math.max(0, rawDist - SWEEP_NOISE_FLOOR);
        const frameProgress =
          sweepThreshold > 0 ? Math.min(netDist / sweepThreshold, 1) : 0;
        sweepMaxProgress = Math.max(sweepMaxProgress, frameProgress);
        lastHoldProgress = sweepMaxProgress;

        if (onFace || sweepMaxProgress > 0.08) {
          if (netDist >= sweepThreshold) {
            reps++;
            phase = 'cooldown';
            phaseStart = now;
            cooldownStartTime = now;
            resetMotionState();
            hardResetMotionState(motionState);
            lastHoldProgress = 1;
            const done = reps >= target;
            return buildResult(done ? 'complete' : 'good', proximity, true, 1, reps / target, false);
          }

          const feedbackState: MobileFaceHandFeedbackState =
            sweepMaxProgress > 0.06 ? 'hold' : 'guide_motion';
          return buildResult(
            feedbackState,
            proximity,
            true,
            sweepMaxProgress,
            reps / target,
            true,
          );
        }
      }

      const dropped = handleActiveDropout(proximity, true);
      if (dropped) return dropped;
      return buildResult(
        'hold',
        proximity,
        true,
        lastHoldProgress,
        reps / target,
        true,
        true,
      );
    }

    if (!handNearFace || !regionNear) {
      if (phase === 'active' && (motionType === 'circular' || motionType === 'hold')) {
        if (graceStartTime === 0) graceStartTime = now;
        if (now - graceStartTime < MOTION_GRACE_MS) {
          const dropped = handleActiveDropout(proximity, true);
          if (dropped) return dropped;
        }
      }
      phase = 'guide_hand';
      phaseStart = 0;
      overlapMemoryUntil = 0;
      resetMotionState();
      hardResetMotionState(motionState);
      return buildResult('guide_hand', proximity, true, 0, reps / target, false);
    }

    if (!shapePasses) {
      if (phase === 'active') {
        const dropped = handleActiveDropout(proximity, true);
        if (dropped) return dropped;
      }
      phase = 'guide_hand';
      phaseStart = 0;
      resetMotionState();
      hardResetMotionState(motionState);
      return buildResult('guide_action', proximity, true, 0, reps / target, false);
    }

    if (!blendOk && phase === 'guide_hand' && handNearFace && regionNear) {
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
      if (motionType === 'sweep') {
        return buildResult('guide_motion', proximity, true, 0, reps / target, true);
      }
    }

    if (phase === 'cooldown') {
      if (now - cooldownStartTime < REP_COOLDOWN_MS) {
        return buildResult('good', proximity, true, 1, reps / target, false);
      }
      phase = 'guide_hand';
      phaseStart = 0;
      cooldownStartTime = 0;
      resetMotionState();
      hardResetMotionState(motionState);
      return buildResult('guide_hand', proximity, true, 0, reps / target, false);
    }

    let holdProgress = 0;
    let feedbackState: MobileFaceHandFeedbackState = 'guide_motion';
    const tip = getTrackedPoint(handLandmarks);

    if (motionType === 'hold') {
      if (config.requiresBlendshape && !blendOk) {
        holdStartTime = 0;
        lastHoldProgress = 0;
        return buildResult('guide_action', proximity, true, 0, reps / target, true);
      }
      if (holdStartTime === 0) {
        holdStartTime = now;
      }
      const elapsed = now - holdStartTime;
      holdProgress = Math.min(elapsed / Math.max(config.holdDurationMs, 1), 1);
      lastHoldProgress = holdProgress;
      if (elapsed >= config.holdDurationMs) {
        reps++;
        phase = 'cooldown';
        phaseStart = now;
        cooldownStartTime = now;
        resetMotionState();
        hardResetMotionState(motionState);
        feedbackState = reps >= target ? 'complete' : 'good';
      } else {
        feedbackState = 'hold';
      }
    } else if (motionType === 'circular') {
      const handCenter = getHandCenter(handLandmarks);
      const circular = detectCircularMotion(
        motionState,
        handCenter.x,
        handCenter.y,
        config.circularAngleDeg || 330,
      );
      holdProgress = circular.progress;

      if (circular.isComplete) {
        reps++;
        phase = 'cooldown';
        phaseStart = now;
        cooldownStartTime = now;
        resetMotionState();
        hardResetMotionState(motionState);
        feedbackState = reps >= target ? 'complete' : 'good';
      } else if (holdProgress > 0.05) {
        feedbackState = 'hold';
      } else {
        feedbackState = 'guide_motion';
      }
    }

    lastHoldProgress = holdProgress;
    return buildResult(feedbackState, proximity, true, holdProgress, reps / target, true);
  }

  function buildResult(
    feedbackState: MobileFaceHandFeedbackState,
    overlapScore: number,
    handDet: boolean,
    holdProgress: number,
    progress: number,
    isActive: boolean,
    motionPaused = false,
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
      motionPaused,
    };
  }

  function reset() {
    reps = 0;
    phase = 'guide_hand';
    phaseStart = 0;
    lastOverlap = 0;
    lastHoldProgress = 0;
    lastOverlapScore = 0;
    overlapMemoryUntil = 0;
    cooldownStartTime = 0;
    resetMotionState();
    hardResetMotionState(motionState);
  }

  return { update, reset, getConfig: () => config };
}

export { createMobileFaceHandCounter };
