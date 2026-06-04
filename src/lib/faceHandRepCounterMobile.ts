import {
  getHandCenter,
  getHandRegionOnFace,
  isHandFist,
  isHandOpen,
  isHandOverlappingFace,
  type FaceHandRegion,
  type NormalizedFaceBox,
  type NormalizedPoint,
} from '@/lib/faceHandCoordinates';

export type MobileFaceHandFeedbackState = 'guide' | 'position' | 'hold' | 'good' | 'complete';

export type FaceHandUiFeedbackState =
  | 'guide_hand'
  | 'guide_action'
  | 'hold'
  | 'good'
  | 'complete';

export interface MobileFaceHandConfig {
  requiredRegion: FaceHandRegion;
  requiredHandShape: 'open' | 'fist' | 'any';
  holdDurationMs: number;
  repTarget: number;
  feedbackKey: string;
  barLabelKey: string;
  overlapBarThreshold: number;
  requiresBlendshape?: string;
  blendshapeThreshold?: number;
  cooldownMs: number;
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
}

type FHState = 'idle' | 'active' | 'cooldown';

export const MOBILE_FACE_HAND_CONFIGS: Record<string, MobileFaceHandConfig> = {
  face_hand_cheek_massage: {
    requiredRegion: 'cheek',
    requiredHandShape: 'open',
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: 'feedbackCheekMassage',
    barLabelKey: 'cheekMassageLevel',
    overlapBarThreshold: 0.45,
    cooldownMs: 800,
  },
  face_hand_forehead_smooth: {
    requiredRegion: 'forehead',
    requiredHandShape: 'open',
    holdDurationMs: 3000,
    repTarget: 5,
    feedbackKey: 'feedbackForeheadSmooth',
    barLabelKey: 'foreheadSmoothLevel',
    overlapBarThreshold: 0.45,
    cooldownMs: 800,
  },
  face_hand_jaw_release: {
    requiredRegion: 'chin',
    requiredHandShape: 'open',
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: 'feedbackJawRelease',
    barLabelKey: 'jawReleaseLevel',
    overlapBarThreshold: 0.4,
    requiresBlendshape: 'jawOpen',
    blendshapeThreshold: 0.3,
    cooldownMs: 600,
  },
  face_hand_eye_press: {
    requiredRegion: 'eye',
    requiredHandShape: 'open',
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: 'feedbackEyePress',
    barLabelKey: 'eyePressLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 600,
  },
  face_hand_temple_massage: {
    requiredRegion: 'temple',
    requiredHandShape: 'open',
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: 'feedbackTempleMassage',
    barLabelKey: 'templeMassageLevel',
    overlapBarThreshold: 0.45,
    cooldownMs: 800,
  },
  face_hand_nose_bridge: {
    requiredRegion: 'forehead',
    requiredHandShape: 'open',
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: 'feedbackNoseBridge',
    barLabelKey: 'noseBridgeLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 600,
  },
  face_hand_chin_lift: {
    requiredRegion: 'chin',
    requiredHandShape: 'open',
    holdDurationMs: 3000,
    repTarget: 5,
    feedbackKey: 'feedbackChinLift',
    barLabelKey: 'chinLiftLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 600,
  },
  face_hand_lip_press: {
    requiredRegion: 'cheek',
    requiredHandShape: 'any',
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: 'feedbackLipPress',
    barLabelKey: 'lipPressLevel',
    overlapBarThreshold: 0.4,
    requiresBlendshape: 'mouthPressLeft',
    blendshapeThreshold: 0.25,
    cooldownMs: 600,
  },
  face_hand_brow_smooth: {
    requiredRegion: 'forehead',
    requiredHandShape: 'open',
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: 'feedbackBrowSmooth',
    barLabelKey: 'browSmoothLevel',
    overlapBarThreshold: 0.45,
    cooldownMs: 800,
  },
  face_hand_neck_side: {
    requiredRegion: 'chin',
    requiredHandShape: 'open',
    holdDurationMs: 3000,
    repTarget: 5,
    feedbackKey: 'feedbackNeckSide',
    barLabelKey: 'neckSideLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 600,
  },
  face_hand_cheek_lift: {
    requiredRegion: 'cheek',
    requiredHandShape: 'open',
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: 'feedbackCheekLift',
    barLabelKey: 'cheekLiftLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 600,
  },
  face_hand_jaw_side: {
    requiredRegion: 'temple',
    requiredHandShape: 'open',
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: 'feedbackJawSide',
    barLabelKey: 'jawSideLevel',
    overlapBarThreshold: 0.4,
    requiresBlendshape: 'jawRight',
    blendshapeThreshold: 0.12,
    cooldownMs: 600,
  },
  face_hand_eye_brow_lift: {
    requiredRegion: 'forehead',
    requiredHandShape: 'open',
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: 'feedbackEyeBrowLift',
    barLabelKey: 'eyeBrowLiftLevel',
    overlapBarThreshold: 0.4,
    requiresBlendshape: 'eyeWideLeft',
    blendshapeThreshold: 0.3,
    cooldownMs: 600,
  },
  face_hand_jawline_sculpt: {
    requiredRegion: 'chin',
    requiredHandShape: 'open',
    holdDurationMs: 2000,
    repTarget: 8,
    feedbackKey: 'feedbackJawlineSculpt',
    barLabelKey: 'jawlineSculptLevel',
    overlapBarThreshold: 0.45,
    cooldownMs: 800,
  },
  face_hand_under_eye_tap: {
    requiredRegion: 'eye',
    requiredHandShape: 'open',
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: 'feedbackUnderEyeTap',
    barLabelKey: 'underEyeTapLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 800,
  },
  face_hand_nasolabial_smooth: {
    requiredRegion: 'cheek',
    requiredHandShape: 'open',
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: 'feedbackNasolabialSmooth',
    barLabelKey: 'nasolabialSmoothLevel',
    overlapBarThreshold: 0.45,
    cooldownMs: 800,
  },
  face_hand_forehead_tap: {
    requiredRegion: 'forehead',
    requiredHandShape: 'open',
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: 'feedbackForeheadTap',
    barLabelKey: 'foreheadTapLevel',
    overlapBarThreshold: 0.45,
    cooldownMs: 800,
  },
  face_hand_chin_circular: {
    requiredRegion: 'chin',
    requiredHandShape: 'open',
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: 'feedbackChinCircular',
    barLabelKey: 'chinCircularLevel',
    overlapBarThreshold: 0.4,
    cooldownMs: 800,
  },
  face_hand_ear_to_shoulder: {
    requiredRegion: 'temple',
    requiredHandShape: 'open',
    holdDurationMs: 3000,
    repTarget: 5,
    feedbackKey: 'feedbackEarToShoulder',
    barLabelKey: 'earToShoulderLevel',
    overlapBarThreshold: 0.45,
    cooldownMs: 600,
  },
};

export function toFaceHandUiResult(result: MobileFaceHandResult, barLabelKey: string): FaceHandUiResult {
  const feedbackState: FaceHandUiFeedbackState =
    result.feedbackState === 'guide'
      ? 'guide_hand'
      : result.feedbackState === 'position'
        ? 'guide_action'
        : result.feedbackState;

  return {
    reps: result.reps,
    target: result.target,
    currentProximity: result.overlapScore,
    holdProgress: result.holdProgress,
    isComplete: result.isComplete,
    progress: result.progress,
    feedbackKey: result.feedbackKey,
    feedbackState,
    barLabelKey,
    handDetected: result.handDetected,
    overlapScore: result.overlapScore,
  };
}

function regionMatches(required: FaceHandRegion, detected: FaceHandRegion): boolean {
  if (required === 'any') return detected !== 'none';
  return required === detected;
}

function createMobileFaceHandCounter(poseId: string, customRepTarget?: number) {
  const config = MOBILE_FACE_HAND_CONFIGS[poseId];
  if (!config) return null;

  const target = customRepTarget && customRepTarget > 0 ? customRepTarget : config.repTarget;
  let state: FHState = 'idle';
  let reps = 0;
  let holdStartTime = 0;
  let cooldownStart = 0;
  let lastOverlap = 0;

  function update(
    handLandmarks: NormalizedPoint[] | null,
    faceBox: NormalizedFaceBox | null,
    blendshapes?: Map<string, number>,
  ): MobileFaceHandResult {
    if (reps >= target) {
      return buildResult('complete', 0, false, 1, 1, true);
    }

    const now = Date.now();
    const handDetected = handLandmarks !== null && handLandmarks.length >= 21;

    if (state === 'cooldown') {
      if (now - cooldownStart < config.cooldownMs) {
        return buildResult('good', lastOverlap, handDetected, 1, reps / target, false);
      }
      state = 'idle';
      holdStartTime = 0;
    }

    if (!handDetected || !faceBox) {
      state = 'idle';
      holdStartTime = 0;
      return buildResult('guide', 0, false, 0, reps / target, false);
    }

    const overlap = isHandOverlappingFace(handLandmarks, faceBox, 0.06);
    lastOverlap = overlap.overlapScore;

    if (!overlap.overlapping) {
      state = 'idle';
      holdStartTime = 0;
      return buildResult('guide', overlap.overlapScore, true, 0, reps / target, false);
    }

    const handCenter = getHandCenter(handLandmarks);
    const region = getHandRegionOnFace(handCenter, faceBox);
    const regionOk = regionMatches(config.requiredRegion, region);

    let shapeOk = true;
    if (config.requiredHandShape === 'open') shapeOk = isHandOpen(handLandmarks);
    if (config.requiredHandShape === 'fist') shapeOk = isHandFist(handLandmarks);

    let blendshapeOk = true;
    if (config.requiresBlendshape && blendshapes) {
      const val = blendshapes.get(config.requiresBlendshape) ?? 0;
      blendshapeOk = val >= (config.blendshapeThreshold ?? 0.3);
    }

    const isActive = regionOk && shapeOk && blendshapeOk;

    if (isActive) {
      if (state !== 'active') {
        state = 'active';
        holdStartTime = now;
      }
      const elapsed = now - holdStartTime;
      const holdProgress = Math.min(elapsed / config.holdDurationMs, 1);
      if (elapsed >= config.holdDurationMs) {
        reps++;
        state = 'cooldown';
        cooldownStart = now;
        holdStartTime = 0;
        const done = reps >= target;
        return buildResult(done ? 'complete' : 'good', overlap.overlapScore, true, 1, reps / target, true);
      }
      return buildResult('hold', overlap.overlapScore, true, holdProgress, reps / target, true);
    }

    state = 'idle';
    holdStartTime = 0;
    return buildResult('position', overlap.overlapScore, true, 0, reps / target, false);
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
    };
  }

  function reset() {
    state = 'idle';
    reps = 0;
    holdStartTime = 0;
    cooldownStart = 0;
    lastOverlap = 0;
  }

  return { update, reset, getConfig: () => config };
}

export { createMobileFaceHandCounter };
