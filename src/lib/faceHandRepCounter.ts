export type FaceHandFeedbackState =
  | "guide_tilt"
  | "guide_hand"
  | "guide_action"
  | "guide_motion"
  | "hold"
  | "good"
  | "complete";

export interface FaceHandRepConfig {
  poseId: string;
  handTarget:
    | "cheek_left"
    | "cheek_right"
    | "forehead"
    | "chin"
    | "jaw_left"
    | "jaw_right"
    | "eye_left"
    | "eye_right"
    | "temple_left"
    | "temple_right"
    | "nose_bridge"
    | "lips"
    | "between_brows"
    | "neck_left"
    | "neck_right"
    | "under_eye_left"
    | "under_eye_right"
    | "nasolabial_left"
    | "nasolabial_right";
  requiredBlendshape?: string;
  blendshapeThreshold?: number;
  proximityThreshold: number;
  holdDurationMs: number;
  repTarget: number;
  feedbackKey: string;
  barLabelKey: string;
  motionType?: "hold" | "circular" | "sweep";
  motionAngleTarget?: number;
  sweepTarget?: string;
  sweepDistanceRatio?: number;
  acceptBothHands?: boolean;
  stabilizeMs?: number;
  cooldownMs?: number;
  headTiltRequired?: "left" | "right" | "any";
  headTiltMinDeviation?: number;
}

export interface FaceHandRepResult {
  reps: number;
  target: number;
  handNearFace: boolean;
  holdProgress: number;
  isComplete: boolean;
  progress: number;
  feedbackKey: string;
  feedbackState: FaceHandFeedbackState;
  currentProximity: number;
  barLabelKey: string;
}

const FACE_REGION_LANDMARKS: Record<string, number[]> = {
  cheek_left: [234, 93, 132],
  cheek_right: [454, 323, 361],
  forehead: [10, 151, 9],
  chin: [152, 175, 199],
  jaw_left: [172, 136, 150],
  jaw_right: [397, 365, 379],
  eye_left: [33, 133, 159],
  eye_right: [263, 362, 386],
  temple_left: [54, 103, 67],
  temple_right: [284, 332, 297],
  nose_bridge: [6, 197, 195],
  lips: [13, 14, 0],
  between_brows: [9, 168, 8],
  neck_left: [234, 177, 147],
  neck_right: [454, 401, 376],
  under_eye_left: [133, 173, 155],
  under_eye_right: [362, 398, 384],
  nasolabial_left: [37, 72, 38],
  nasolabial_right: [267, 302, 268],
};

const HAND_FINGERTIP_INDICES = [4, 8, 12, 16, 20];
const HAND_PALM_INDEX = 0;
const ALL_HAND_INDICES = [...HAND_FINGERTIP_INDICES, HAND_PALM_INDEX];

const CIRCULAR_NOISE_GATE_DEG = 1.5;
const CIRCULAR_MIN_RADIUS = 0.012;
const MOTION_GRACE_MS = 500;
const SWEEP_LIFT_THRESHOLD = 0.30;

type Point2D = { x: number; y: number };
type Landmark = { x: number; y: number; z: number };
type HandPayload = { landmarks: Landmark[] };

type InternalPhase = "guide_hand" | "stabilizing" | "active" | "cooldown" | "returning";

function calculateDistance2D(p1: Point2D, p2: Point2D): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function getFaceRegionCenter(faceLandmarks: Landmark[], region: string): Point2D | null {
  const indices = FACE_REGION_LANDMARKS[region];
  if (!indices || faceLandmarks.length === 0) return null;
  return {
    x: indices.reduce((sum, i) => sum + (faceLandmarks[i]?.x ?? 0), 0) / indices.length,
    y: indices.reduce((sum, i) => sum + (faceLandmarks[i]?.y ?? 0), 0) / indices.length,
  };
}

function getFaceWidth(faceLandmarks: Landmark[]): number {
  const left = faceLandmarks[54];
  const right = faceLandmarks[284];
  if (!left || !right) return 0.3;
  return Math.max(calculateDistance2D(left, right), 0.05);
}

// Returns true when any tracked hand point is within SWEEP_LIFT_THRESHOLD of the nose bridge.
// Used to detect "hand still on face" vs "hand lifted away".
function isHandNearFaceGeneral(hands: HandPayload[], faceLandmarks: Landmark[]): boolean {
  if (hands.length === 0 || faceLandmarks.length === 0) return false;
  const nose = faceLandmarks[168];
  if (!nose) return false;
  const nosePos: Point2D = { x: nose.x, y: nose.y };
  for (const hand of hands) {
    for (const idx of ALL_HAND_INDICES) {
      const tip = hand.landmarks[idx];
      if (!tip) continue;
      if (calculateDistance2D(tip, nosePos) < SWEEP_LIFT_THRESHOLD) return true;
    }
  }
  return false;
}

// Returns true when point is inside the face bounding box (landmarks 10=top, 152=bottom,
// 234=left-ear, 454=right-ear) plus margin. Used to keep tracking during a full sweep.
function isPointInsideFaceBox(
  point: Point2D,
  faceLandmarks: Landmark[],
  margin: number,
): boolean {
  const top = faceLandmarks[10];
  const bottom = faceLandmarks[152];
  const left = faceLandmarks[234];
  const right = faceLandmarks[454];
  if (!top || !bottom || !left || !right) return false;
  return (
    point.x >= left.x - margin &&
    point.x <= right.x + margin &&
    point.y >= top.y - margin &&
    point.y <= bottom.y + margin
  );
}

// Estimates head yaw: 0.5 = straight, >0.58 = turned left, <0.42 = turned right.
function estimateHeadYaw(faceLandmarks: Landmark[]): number {
  const nose = faceLandmarks[1];
  const leftEar = faceLandmarks[234];
  const rightEar = faceLandmarks[454];
  if (!nose || !leftEar || !rightEar) return 0.5;
  const earWidth = rightEar.x - leftEar.x;
  if (Math.abs(earWidth) < 0.01) return 0.5;
  return (nose.x - leftEar.x) / earWidth;
}

function isHeadTilted(
  faceLandmarks: Landmark[],
  required: "left" | "right" | "any",
  minDeviation = 0.08,
): boolean {
  if (faceLandmarks.length === 0) return true;
  const yaw = estimateHeadYaw(faceLandmarks);
  const dev = Math.abs(yaw - 0.5);
  if (required === "any") return dev >= minDeviation;
  if (required === "left") return yaw < 0.5 - minDeviation;
  return yaw > 0.5 + minDeviation;
}

function getClosestHandInfo(
  hands: HandPayload[],
  faceLandmarks: Landmark[],
  region: string,
): { distance: number; handIndex: number; landmarkIndex: number; point: Point2D } | null {
  const regionIndices = FACE_REGION_LANDMARKS[region];
  if (!regionIndices || hands.length === 0 || faceLandmarks.length === 0) return null;

  const regionCenter: Point2D = {
    x: regionIndices.reduce((sum, i) => sum + (faceLandmarks[i]?.x ?? 0), 0) / regionIndices.length,
    y: regionIndices.reduce((sum, i) => sum + (faceLandmarks[i]?.y ?? 0), 0) / regionIndices.length,
  };

  let minDist = Infinity;
  let bestHand = 0;
  let bestLandmark = HAND_PALM_INDEX;
  let bestPoint: Point2D = { x: 0, y: 0 };

  for (let h = 0; h < hands.length; h++) {
    const hand = hands[h];
    for (const lmIdx of ALL_HAND_INDICES) {
      const tip = hand.landmarks[lmIdx];
      if (!tip) continue;
      const dist = calculateDistance2D(tip, regionCenter);
      if (dist < minDist) {
        minDist = dist;
        bestHand = h;
        bestLandmark = lmIdx;
        bestPoint = { x: tip.x, y: tip.y };
      }
    }
  }

  return { distance: minDist, handIndex: bestHand, landmarkIndex: bestLandmark, point: bestPoint };
}

export const FACE_HAND_EXERCISE_CONFIGS: Record<string, FaceHandRepConfig> = {
  face_hand_cheek_massage: {
    poseId: "face_hand_cheek_massage",
    handTarget: "cheek_right",
    proximityThreshold: 0.15,
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: "feedbackCheekMassage",
    barLabelKey: "cheekMassageLevel",
    motionType: "circular",
    motionAngleTarget: 330,
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 800,
  },
  face_hand_forehead_smooth: {
    poseId: "face_hand_forehead_smooth",
    handTarget: "forehead",
    proximityThreshold: 0.13,
    holdDurationMs: 3000,
    repTarget: 5,
    feedbackKey: "feedbackForeheadSmooth",
    barLabelKey: "foreheadSmoothLevel",
    motionType: "sweep",
    sweepDistanceRatio: 0.28,
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 800,
  },
  face_hand_jaw_release: {
    poseId: "face_hand_jaw_release",
    handTarget: "chin",
    requiredBlendshape: "jawOpen",
    blendshapeThreshold: 0.3,
    proximityThreshold: 0.09,
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: "feedbackJawRelease",
    barLabelKey: "jawReleaseLevel",
    motionType: "hold",
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 600,
  },
  face_hand_eye_press: {
    poseId: "face_hand_eye_press",
    handTarget: "eye_left",
    proximityThreshold: 0.08,
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: "feedbackEyePress",
    barLabelKey: "eyePressLevel",
    motionType: "hold",
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 600,
  },
  face_hand_temple_massage: {
    poseId: "face_hand_temple_massage",
    handTarget: "temple_left",
    proximityThreshold: 0.15,
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: "feedbackTempleMassage",
    barLabelKey: "templeMassageLevel",
    motionType: "circular",
    motionAngleTarget: 330,
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 800,
  },
  face_hand_nose_bridge: {
    poseId: "face_hand_nose_bridge",
    handTarget: "nose_bridge",
    proximityThreshold: 0.08,
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: "feedbackNoseBridge",
    barLabelKey: "noseBridgeLevel",
    motionType: "hold",
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 600,
  },
  face_hand_chin_lift: {
    poseId: "face_hand_chin_lift",
    handTarget: "chin",
    proximityThreshold: 0.08,
    holdDurationMs: 3000,
    repTarget: 5,
    feedbackKey: "feedbackChinLift",
    barLabelKey: "chinLiftLevel",
    motionType: "hold",
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 600,
  },
  face_hand_lip_press: {
    poseId: "face_hand_lip_press",
    handTarget: "lips",
    requiredBlendshape: "mouthPressLeft",
    blendshapeThreshold: 0.25,
    proximityThreshold: 0.08,
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: "feedbackLipPress",
    barLabelKey: "lipPressLevel",
    motionType: "hold",
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 600,
  },
  face_hand_brow_smooth: {
    poseId: "face_hand_brow_smooth",
    handTarget: "between_brows",
    proximityThreshold: 0.13,
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: "feedbackBrowSmooth",
    barLabelKey: "browSmoothLevel",
    motionType: "sweep",
    sweepDistanceRatio: 0.28,
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 800,
  },
  face_hand_neck_side: {
    poseId: "face_hand_neck_side",
    handTarget: "neck_left",
    proximityThreshold: 0.1,
    holdDurationMs: 3000,
    repTarget: 5,
    feedbackKey: "feedbackNeckSide",
    barLabelKey: "neckSideLevel",
    motionType: "hold",
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 600,
  },
  face_hand_cheek_lift: {
    poseId: "face_hand_cheek_lift",
    handTarget: "cheek_left",
    proximityThreshold: 0.08,
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: "feedbackCheekLift",
    barLabelKey: "cheekLiftLevel",
    motionType: "hold",
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 600,
  },
  face_hand_jaw_side: {
    poseId: "face_hand_jaw_side",
    handTarget: "jaw_left",
    requiredBlendshape: "jawRight",
    blendshapeThreshold: 0.12,
    proximityThreshold: 0.08,
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: "feedbackJawSide",
    barLabelKey: "jawSideLevel",
    motionType: "hold",
    acceptBothHands: false,
    stabilizeMs: 300,
    cooldownMs: 600,
  },
  face_hand_eye_brow_lift: {
    poseId: "face_hand_eye_brow_lift",
    handTarget: "forehead",
    requiredBlendshape: "eyeWideLeft",
    blendshapeThreshold: 0.3,
    proximityThreshold: 0.08,
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: "feedbackEyeBrowLift",
    barLabelKey: "eyeBrowLiftLevel",
    motionType: "hold",
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 600,
  },
  face_hand_jawline_sculpt: {
    poseId: "face_hand_jawline_sculpt",
    handTarget: "chin",
    proximityThreshold: 0.13,
    holdDurationMs: 2000,
    repTarget: 8,
    feedbackKey: "feedbackJawlineSculpt",
    barLabelKey: "jawlineSculptLevel",
    motionType: "sweep",
    sweepDistanceRatio: 0.60,
    acceptBothHands: true,
    stabilizeMs: 500,
    cooldownMs: 800,
    headTiltRequired: "any",
    headTiltMinDeviation: 0.08,
  },
  face_hand_under_eye_tap: {
    poseId: "face_hand_under_eye_tap",
    handTarget: "under_eye_left",
    proximityThreshold: 0.10,
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: "feedbackUnderEyeTap",
    barLabelKey: "underEyeTapLevel",
    motionType: "circular",
    motionAngleTarget: 270,
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 800,
  },
  face_hand_nasolabial_smooth: {
    poseId: "face_hand_nasolabial_smooth",
    handTarget: "nasolabial_right",
    proximityThreshold: 0.12,
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: "feedbackNasolabialSmooth",
    barLabelKey: "nasolabialSmoothLevel",
    motionType: "sweep",
    sweepDistanceRatio: 0.40,
    acceptBothHands: true,
    stabilizeMs: 400,
    cooldownMs: 800,
  },
  face_hand_forehead_tap: {
    poseId: "face_hand_forehead_tap",
    handTarget: "forehead",
    proximityThreshold: 0.13,
    holdDurationMs: 2000,
    repTarget: 5,
    feedbackKey: "feedbackForeheadTap",
    barLabelKey: "foreheadTapLevel",
    motionType: "circular",
    motionAngleTarget: 270,
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 800,
  },
  face_hand_chin_circular: {
    poseId: "face_hand_chin_circular",
    handTarget: "chin",
    proximityThreshold: 0.10,
    holdDurationMs: 2500,
    repTarget: 5,
    feedbackKey: "feedbackChinCircular",
    barLabelKey: "chinCircularLevel",
    motionType: "circular",
    motionAngleTarget: 330,
    acceptBothHands: true,
    stabilizeMs: 300,
    cooldownMs: 800,
  },
  face_hand_ear_to_shoulder: {
    poseId: "face_hand_ear_to_shoulder",
    handTarget: "neck_right",
    proximityThreshold: 0.12,
    holdDurationMs: 3000,
    repTarget: 5,
    feedbackKey: "feedbackEarToShoulder",
    barLabelKey: "earToShoulderLevel",
    motionType: "hold",
    acceptBothHands: true,
    stabilizeMs: 400,
    cooldownMs: 600,
    headTiltRequired: "right",
    headTiltMinDeviation: 0.08,
  },
};

function createFaceHandRepCounter(poseId: string, customRepTarget?: number) {
  const config = FACE_HAND_EXERCISE_CONFIGS[poseId];
  if (!config) return null;

  const target = customRepTarget && customRepTarget > 0 ? customRepTarget : config.repTarget;
  const motionType = config.motionType ?? "hold";
  const stabilizeMs = config.stabilizeMs ?? 300;
  const cooldownMs = config.cooldownMs ?? 800;

  let reps = 0;
  let currentProximity = 0;
  let phase: InternalPhase = "guide_hand";
  let phaseStart = 0;

  let prevAngleRad: number | null = null;
  let cumulativeAngleDeg = 0;

  let sweepStartPos: Point2D | null = null;
  let sweepBaselineDist = 0;
  let sweepComplete = false;

  // Locked landmark tracking for sweep: once active, we follow the same
  // specific fingertip/palm across frames to prevent fingertip-switching jumps.
  let lockedHandIdx: number | null = null;
  let lockedLandmarkIdx: number | null = null;

  let holdStartTime = 0;
  let graceStartTime = 0;

  function resetMotionState() {
    prevAngleRad = null;
    cumulativeAngleDeg = 0;
    sweepStartPos = null;
    sweepBaselineDist = 0;
    sweepComplete = false;
    lockedHandIdx = null;
    lockedLandmarkIdx = null;
    holdStartTime = 0;
    graceStartTime = 0;
  }

  // Returns the current position of the locked landmark, or null if lost.
  function getLockedPoint(hands: HandPayload[]): Point2D | null {
    if (lockedHandIdx === null || lockedLandmarkIdx === null) return null;
    const hand = hands[lockedHandIdx];
    if (!hand) return null;
    const lm = hand.landmarks[lockedLandmarkIdx];
    if (!lm) return null;
    return { x: lm.x, y: lm.y };
  }

  function initActivePhase(
    hands: HandPayload[],
    faceLandmarks: Landmark[],
    fallbackPoint: Point2D,
  ) {
    resetMotionState();
    if (motionType === "sweep") {
      const lock = getClosestHandInfo(hands, faceLandmarks, config.handTarget);
      if (lock) {
        lockedHandIdx = lock.handIndex;
        lockedLandmarkIdx = lock.landmarkIndex;
      }
      // Anchor sweep measurement to the face region center, not the hand position.
      // This guarantees the user must sweep the full distance from the anatomical
      // target (e.g. chin) regardless of where they placed their hand.
      sweepStartPos =
        getFaceRegionCenter(faceLandmarks, config.handTarget) ??
        (lock ? lock.point : { x: fallbackPoint.x, y: fallbackPoint.y });

      // Record how far the locked hand point already is from the anchor at rest.
      // Subtracting this baseline from every subsequent measurement gives pure
      // travel distance, so a hand resting at chin-center starts at netDist = 0.
      const lockedPt = getLockedPoint(hands);
      if (lockedPt && sweepStartPos) {
        sweepBaselineDist = calculateDistance2D(lockedPt, sweepStartPos);
      }
    }
    if (motionType === "hold") {
      holdStartTime = Date.now();
    }
  }

  function update(
    hands: HandPayload[],
    faceLandmarks: Landmark[],
    blendshapes?: Map<string, number>,
  ): FaceHandRepResult {
    if (reps >= target) {
      return {
        reps: target,
        target,
        handNearFace: false,
        holdProgress: 1,
        isComplete: true,
        progress: 1,
        feedbackKey: config.feedbackKey,
        feedbackState: "complete",
        currentProximity: 0,
        barLabelKey: config.barLabelKey,
      };
    }

    const closest = getClosestHandInfo(hands, faceLandmarks, config.handTarget);
    currentProximity = closest ? 1 - Math.min(closest.distance / 0.2, 1) : 0;
    const handNearFace = closest !== null && closest.distance < config.proximityThreshold;

    let blendshapeOk = true;
    if (config.requiredBlendshape && blendshapes) {
      const val = blendshapes.get(config.requiredBlendshape) ?? 0;
      blendshapeOk = val >= (config.blendshapeThreshold ?? 0.3);
    }

    const conditionMet = handNearFace && blendshapeOk;
    const now = Date.now();

    // Head-tilt gate: only active in guide_hand phase, before user places hand.
    if (
      config.headTiltRequired &&
      phase === "guide_hand" &&
      faceLandmarks.length > 0 &&
      !isHeadTilted(faceLandmarks, config.headTiltRequired, config.headTiltMinDeviation)
    ) {
      return {
        reps,
        target,
        handNearFace,
        holdProgress: 0,
        isComplete: false,
        progress: reps / target,
        feedbackKey: config.feedbackKey,
        feedbackState: "guide_tilt",
        currentProximity,
        barLabelKey: config.barLabelKey,
      };
    }

    // ── SWEEP: dedicated branch — handles full start→sweep→lift→return cycle ──
    if (motionType === "sweep" && phase === "active") {
      const trackedPoint = getLockedPoint(hands) ?? closest?.point ?? null;
      const handOnFace =
        trackedPoint !== null && isPointInsideFaceBox(trackedPoint, faceLandmarks, 0.06);
      const handNearFaceGeneral = isHandNearFaceGeneral(hands, faceLandmarks);

      if (handOnFace && sweepStartPos && trackedPoint) {
        const faceWidth = getFaceWidth(faceLandmarks);
        const sweepRatio = config.sweepDistanceRatio ?? 0.25;
        const sweepThreshold = Math.max(faceWidth * sweepRatio, 0.05);

        // netDist: how far the hand has actually MOVED from its resting position.
        // Subtracting the baseline eliminates the initial offset between the hand
        // and the face-region anchor, so the counter can only fire after genuine
        // travel — not just because the fingertip started a few pixels away.
        const dist = calculateDistance2D(trackedPoint, sweepStartPos);
        const netDist = Math.max(dist - sweepBaselineDist, 0);

        if (!sweepComplete && netDist >= sweepThreshold) {
          sweepComplete = true;
          reps++;
        }

        if (sweepComplete && !handNearFaceGeneral) {
          const done = reps >= target;
          resetMotionState();
          phase = done ? "guide_hand" : "returning";
          phaseStart = now;
          return {
            reps,
            target,
            handNearFace,
            holdProgress: 1,
            isComplete: done,
            progress: Math.min(reps / target, 1),
            feedbackKey: config.feedbackKey,
            feedbackState: done ? "complete" : "good",
            currentProximity,
            barLabelKey: config.barLabelKey,
          };
        }

        const holdProgress = sweepThreshold > 0 ? Math.min(netDist / sweepThreshold, 1) : 0;
        return {
          reps,
          target,
          handNearFace,
          holdProgress,
          isComplete: reps >= target,
          progress: Math.min(reps / target, 1),
          feedbackKey: config.feedbackKey,
          feedbackState: sweepComplete
            ? "good"
            : netDist > 0.01
              ? "hold"
              : "guide_motion",
          currentProximity,
          barLabelKey: config.barLabelKey,
        };
      }

      // Hand left the face bounding box
      if (sweepComplete && !handNearFaceGeneral) {
        const done = reps >= target;
        resetMotionState();
        phase = done ? "guide_hand" : "returning";
        phaseStart = now;
        return {
          reps,
          target,
          handNearFace: false,
          holdProgress: 1,
          isComplete: done,
          progress: Math.min(reps / target, 1),
          feedbackKey: config.feedbackKey,
          feedbackState: done ? "complete" : "good",
          currentProximity,
          barLabelKey: config.barLabelKey,
        };
      }

      if (!sweepComplete) {
        phase = "guide_hand";
        phaseStart = 0;
        resetMotionState();
      }

      return {
        reps,
        target,
        handNearFace,
        holdProgress: sweepComplete ? 1 : 0,
        isComplete: false,
        progress: reps / target,
        feedbackKey: config.feedbackKey,
        feedbackState: sweepComplete ? "good" : "guide_hand",
        currentProximity,
        barLabelKey: config.barLabelKey,
      };
    }
    // ── END SWEEP BRANCH ──────────────────────────────────────────────────────

    if (!conditionMet) {
      if (phase === "active" && motionType === "circular") {
        if (graceStartTime === 0) graceStartTime = now;
        if (now - graceStartTime < MOTION_GRACE_MS) {
          return {
            reps,
            target,
            handNearFace: false,
            holdProgress: Math.min(cumulativeAngleDeg / (config.motionAngleTarget ?? 330), 1),
            isComplete: false,
            progress: reps / target,
            feedbackKey: config.feedbackKey,
            feedbackState: "hold",
            currentProximity,
            barLabelKey: config.barLabelKey,
          };
        }
      }

      if (phase !== "guide_hand") {
        phase = "guide_hand";
        phaseStart = 0;
        resetMotionState();
      }

      const feedbackState: FaceHandFeedbackState =
        handNearFace && !blendshapeOk ? "guide_action" : "guide_hand";

      return {
        reps,
        target,
        handNearFace,
        holdProgress: 0,
        isComplete: false,
        progress: reps / target,
        feedbackKey: config.feedbackKey,
        feedbackState,
        currentProximity,
        barLabelKey: config.barLabelKey,
      };
    }

    graceStartTime = 0;

    if (phase === "guide_hand") {
      phase = "stabilizing";
      phaseStart = now;
      resetMotionState();
    }

    if (phase === "stabilizing") {
      if (now - phaseStart < stabilizeMs) {
        return {
          reps,
          target,
          handNearFace,
          holdProgress: 0,
          isComplete: false,
          progress: reps / target,
          feedbackKey: config.feedbackKey,
          feedbackState: "guide_hand",
          currentProximity,
          barLabelKey: config.barLabelKey,
        };
      }
      phase = "active";
      phaseStart = now;
      initActivePhase(hands, faceLandmarks, closest.point);
    }

    if (phase === "cooldown") {
      if (now - phaseStart < cooldownMs) {
        return {
          reps,
          target,
          handNearFace,
          holdProgress: 1,
          isComplete: false,
          progress: reps / target,
          feedbackKey: config.feedbackKey,
          feedbackState: "good",
          currentProximity,
          barLabelKey: config.barLabelKey,
        };
      }
      phase = "active";
      phaseStart = now;
      initActivePhase(hands, faceLandmarks, closest.point);
    }

    if (phase === "returning") {
      const regionCenter = getFaceRegionCenter(faceLandmarks, config.handTarget);
      const distToOrigin = regionCenter
        ? calculateDistance2D(closest.point, regionCenter)
        : Infinity;
      if (distToOrigin < config.proximityThreshold * 0.85) {
        phase = "stabilizing";
        phaseStart = now;
        resetMotionState();
      }
      return {
        reps,
        target,
        handNearFace,
        holdProgress: 0,
        isComplete: false,
        progress: reps / target,
        feedbackKey: config.feedbackKey,
        feedbackState: "guide_hand",
        currentProximity,
        barLabelKey: config.barLabelKey,
      };
    }

    let holdProgress = 0;
    let feedbackState: FaceHandFeedbackState = "guide_motion";

    if (motionType === "hold") {
      const elapsed = now - holdStartTime;
      holdProgress = Math.min(elapsed / config.holdDurationMs, 1);

      if (elapsed >= config.holdDurationMs) {
        reps++;
        phase = "cooldown";
        phaseStart = now;
        resetMotionState();
        feedbackState = reps >= target ? "complete" : "good";
      } else {
        feedbackState = "hold";
      }
    } else if (motionType === "circular") {
      const center = getFaceRegionCenter(faceLandmarks, config.handTarget);
      if (center) {
        const { point } = closest;
        const radius = calculateDistance2D(point, center);
        const currentAngle = Math.atan2(point.y - center.y, point.x - center.x);

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

        const angleTarget = config.motionAngleTarget ?? 330;
        holdProgress = Math.min(cumulativeAngleDeg / angleTarget, 1);

        if (cumulativeAngleDeg >= angleTarget) {
          reps++;
          phase = "cooldown";
          phaseStart = now;
          resetMotionState();
          feedbackState = reps >= target ? "complete" : "good";
        } else if (cumulativeAngleDeg > 20) {
          feedbackState = "hold";
        } else {
          feedbackState = "guide_motion";
        }
      }
    }

    return {
      reps,
      target,
      handNearFace,
      holdProgress,
      isComplete: reps >= target,
      progress: Math.min(reps / target, 1),
      feedbackKey: config.feedbackKey,
      feedbackState,
      currentProximity,
      barLabelKey: config.barLabelKey,
    };
  }

  function reset() {
    reps = 0;
    currentProximity = 0;
    phase = "guide_hand";
    phaseStart = 0;
    resetMotionState();
  }

  return { update, reset, getConfig: () => config };
}

export { createFaceHandRepCounter };
