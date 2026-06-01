type RepState = "idle" | "open" | "closing" | "alt_first_done";

export type FaceFeedbackState = "guide" | "hold" | "good" | "complete";

type Landmark = { x: number; y: number; z: number };

interface FaceRepConfig {
  blendshapeNames: string[];
  blendshapeNamesB?: string[];
  aggregation: "max" | "average";
  enterThreshold: number;
  exitThreshold: number;
  repTarget: number;
  feedbackKey: string;
  barLabelKey: string;
  headPitchCheck?: "up";
  headPitchMinScore?: number;
  alternating?: boolean;
}

interface FaceRepResult {
  reps: number;
  target: number;
  currentValue: number;
  state: RepState;
  isComplete: boolean;
  progress: number;
  feedbackKey: string;
  feedbackState: FaceFeedbackState;
  barLabelKey: string;
}

// Scores 0–1: how much the chin is elevated toward the ceiling.
// When the user tilts their chin up, the chin landmark becomes closer to the
// camera (smaller z in MediaPipe convention) and the forehead moves farther away.
function detectChinUp(faceLandmarks: Landmark[]): number {
  const chin = faceLandmarks[152];
  const forehead = faceLandmarks[10];
  if (!chin || !forehead) return 0;
  const diff = forehead.z - chin.z;
  return Math.min(Math.max(diff / 0.10, 0), 1);
}

function readBlendshapeValue(blendshapes: Map<string, number>, config: FaceRepConfig): number {
  if (config.blendshapeNames.length === 1) {
    return blendshapes.get(config.blendshapeNames[0]) ?? 0;
  }

  const values = config.blendshapeNames.map((name) => blendshapes.get(name) ?? 0);

  if (config.aggregation === "max") {
    return Math.max(...values);
  }

  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const FACE_EXERCISE_CONFIGS: Record<string, FaceRepConfig> = {
  face_jaw_open: {
    blendshapeNames: ["jawOpen"],
    aggregation: "max",
    enterThreshold: 0.45,
    exitThreshold: 0.08,
    repTarget: 10,
    feedbackKey: "feedbackJawOpen",
    barLabelKey: "jawOpenLevel",
  },
  face_brow_raise: {
    blendshapeNames: ["browInnerUp"],
    aggregation: "max",
    enterThreshold: 0.45,
    exitThreshold: 0.1,
    repTarget: 10,
    feedbackKey: "feedbackBrowRaise",
    barLabelKey: "browRaiseLevel",
  },
  face_wide_smile: {
    blendshapeNames: ["mouthSmileLeft", "mouthSmileRight"],
    aggregation: "average",
    enterThreshold: 0.62,
    exitThreshold: 0.14,
    repTarget: 12,
    feedbackKey: "feedbackWideSmile",
    barLabelKey: "smileLevel",
  },
  face_lip_pucker: {
    blendshapeNames: ["mouthPucker"],
    aggregation: "max",
    enterThreshold: 0.4,
    exitThreshold: 0.1,
    repTarget: 12,
    feedbackKey: "feedbackLipPucker",
    barLabelKey: "puckerLevel",
  },
  face_fish_lips: {
    blendshapeNames: ["mouthPucker", "mouthShrugLower"],
    aggregation: "average",
    enterThreshold: 0.35,
    exitThreshold: 0.08,
    repTarget: 10,
    feedbackKey: "feedbackFishLips",
    barLabelKey: "fishLipsLevel",
  },
  face_eye_squeeze: {
    blendshapeNames: ["eyeSquintLeft", "eyeSquintRight"],
    aggregation: "average",
    enterThreshold: 0.58,
    exitThreshold: 0.32,
    repTarget: 10,
    feedbackKey: "feedbackEyeSqueeze",
    barLabelKey: "eyeSqueezeLevel",
  },
  face_mouth_o: {
    blendshapeNames: ["mouthFunnel", "mouthPucker"],
    aggregation: "max",
    enterThreshold: 0.3,
    exitThreshold: 0.06,
    repTarget: 10,
    feedbackKey: "feedbackMouthO",
    barLabelKey: "mouthOLevel",
  },
  face_jaw_slide_right: {
    blendshapeNames: ["jawRight"],
    aggregation: "max",
    enterThreshold: 0.2,
    exitThreshold: 0.08,
    repTarget: 8,
    feedbackKey: "feedbackJawSlideRight",
    barLabelKey: "jawSlideLevel",
  },
  face_jaw_slide_left: {
    blendshapeNames: ["jawLeft"],
    aggregation: "max",
    enterThreshold: 0.2,
    exitThreshold: 0.08,
    repTarget: 8,
    feedbackKey: "feedbackJawSlideLeft",
    barLabelKey: "jawSlideLevel",
  },
  face_brow_furrow: {
    blendshapeNames: ["browDownLeft", "browDownRight"],
    aggregation: "average",
    enterThreshold: 0.24,
    exitThreshold: 0.08,
    repTarget: 10,
    feedbackKey: "feedbackBrowFurrow",
    barLabelKey: "browFurrowLevel",
  },
  face_cheek_puff: {
    blendshapeNames: ["cheekPuff", "mouthPressLeft", "mouthPressRight"],
    aggregation: "max",
    enterThreshold: 0.06,
    exitThreshold: 0.02,
    repTarget: 10,
    feedbackKey: "feedbackCheekPuff",
    barLabelKey: "cheekPuffLevel",
  },
  face_frown: {
    blendshapeNames: ["mouthFrownLeft", "mouthFrownRight"],
    aggregation: "average",
    enterThreshold: 0.32,
    exitThreshold: 0.1,
    repTarget: 10,
    feedbackKey: "feedbackFrown",
    barLabelKey: "frownLevel",
  },
  face_lip_roll: {
    blendshapeNames: ["mouthRollLower", "mouthRollUpper"],
    aggregation: "average",
    enterThreshold: 0.3,
    exitThreshold: 0.06,
    repTarget: 10,
    feedbackKey: "feedbackLipRoll",
    barLabelKey: "lipRollLevel",
  },
  face_upper_lip_raise: {
    blendshapeNames: ["mouthUpperUpLeft", "mouthUpperUpRight"],
    aggregation: "average",
    enterThreshold: 0.35,
    exitThreshold: 0.08,
    repTarget: 10,
    feedbackKey: "feedbackUpperLipRaise",
    barLabelKey: "upperLipRaiseLevel",
  },
  face_chin_up_kiss: {
    blendshapeNames: ["mouthPucker"],
    aggregation: "max",
    enterThreshold: 0.35,
    exitThreshold: 0.08,
    repTarget: 10,
    feedbackKey: "feedbackChinUpKiss",
    barLabelKey: "chinUpKissLevel",
    headPitchCheck: "up",
    headPitchMinScore: 0.35,
  },
  face_nose_scrunch: {
    blendshapeNames: ["noseSneerLeft", "noseSneerRight"],
    aggregation: "average",
    enterThreshold: 0.25,
    exitThreshold: 0.06,
    repTarget: 10,
    feedbackKey: "feedbackNoseScrunch",
    barLabelKey: "noseScrunchLevel",
  },
  face_mouth_stretch: {
    blendshapeNames: ["mouthStretchLeft", "mouthStretchRight"],
    aggregation: "average",
    enterThreshold: 0.3,
    exitThreshold: 0.07,
    repTarget: 10,
    feedbackKey: "feedbackMouthStretch",
    barLabelKey: "mouthStretchLevel",
  },
  face_dimple_maker: {
    blendshapeNames: ["mouthDimpleLeft", "mouthDimpleRight"],
    aggregation: "average",
    enterThreshold: 0.2,
    exitThreshold: 0.05,
    repTarget: 10,
    feedbackKey: "feedbackDimpleMaker",
    barLabelKey: "dimpleMakerLevel",
  },
  face_brow_outer_lift: {
    blendshapeNames: ["browOuterUpLeft", "browOuterUpRight"],
    aggregation: "average",
    enterThreshold: 0.3,
    exitThreshold: 0.07,
    repTarget: 10,
    feedbackKey: "feedbackBrowOuterLift",
    barLabelKey: "browOuterLiftLevel",
  },
  face_mouth_shift: {
    blendshapeNames: ["mouthLeft"],
    blendshapeNamesB: ["mouthRight"],
    aggregation: "max",
    enterThreshold: 0.3,
    exitThreshold: 0.07,
    repTarget: 8,
    feedbackKey: "feedbackMouthShift",
    barLabelKey: "mouthShiftLevel",
    alternating: true,
  },
};

const MIN_REP_INTERVAL_MS = 400;

function readBlendshapeValueB(blendshapes: Map<string, number>, config: FaceRepConfig): number {
  const names = config.blendshapeNamesB;
  if (!names || names.length === 0) return 0;
  if (names.length === 1) return blendshapes.get(names[0]) ?? 0;
  const values = names.map((n) => blendshapes.get(n) ?? 0);
  if (config.aggregation === "max") return Math.max(...values);
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function createFaceRepCounter(poseId: string, customTarget?: number) {
  const config = FACE_EXERCISE_CONFIGS[poseId];
  if (!config) return null;

  const target = customTarget || config.repTarget;
  let state: RepState = "idle";
  let reps = 0;
  let smoothedValue = 0;
  let lastRepTime = 0;
  const smoothAlpha = 0.85;

  let altPhase: "A" | "B" = "A";
  let altSmoothedA = 0;
  let altSmoothedB = 0;

  function update(blendshapes: Map<string, number>, faceLandmarks?: Landmark[]): FaceRepResult {
    if (reps >= target) {
      return {
        reps: target,
        target,
        currentValue: 0,
        state: "idle",
        isComplete: true,
        progress: 1,
        feedbackKey: config.feedbackKey,
        feedbackState: "complete",
        barLabelKey: config.barLabelKey,
      };
    }

    if (config.alternating) {
      const rawA = readBlendshapeValue(blendshapes, config);
      const rawB = readBlendshapeValueB(blendshapes, config);
      altSmoothedA = altSmoothedA * (1 - smoothAlpha) + rawA * smoothAlpha;
      altSmoothedB = altSmoothedB * (1 - smoothAlpha) + rawB * smoothAlpha;

      const activeSmoothed = altPhase === "A" ? altSmoothedA : altSmoothedB;
      const displayValue = altPhase === "A" ? rawA : rawB;
      let feedbackState: FaceFeedbackState = "guide";

      if (state === "idle") {
        if (activeSmoothed >= config.enterThreshold) {
          state = "open";
          feedbackState = "hold";
        } else {
          feedbackState = "guide";
        }
      } else if (state === "open") {
        if (activeSmoothed < config.exitThreshold) {
          if (altPhase === "A") {
            altPhase = "B";
            state = "alt_first_done";
            feedbackState = "good";
          } else {
            const now = Date.now();
            if (now - lastRepTime > MIN_REP_INTERVAL_MS) {
              reps++;
              lastRepTime = now;
            }
            altPhase = "A";
            state = reps >= target ? "idle" : "closing";
            feedbackState = reps >= target ? "complete" : "good";
          }
        } else {
          feedbackState = "hold";
        }
      } else if (state === "alt_first_done") {
        if (altSmoothedB >= config.enterThreshold) {
          state = "open";
          feedbackState = "hold";
        } else {
          feedbackState = "guide";
        }
      } else if (state === "closing") {
        state = "idle";
        feedbackState = "guide";
      }

      return {
        reps,
        target,
        currentValue: displayValue,
        state,
        isComplete: reps >= target,
        progress: Math.min(reps / target, 1),
        feedbackKey: config.feedbackKey,
        feedbackState,
        barLabelKey: config.barLabelKey,
      };
    }

    let raw = readBlendshapeValue(blendshapes, config);

    if (config.headPitchCheck === "up" && faceLandmarks && faceLandmarks.length > 0) {
      const score = detectChinUp(faceLandmarks);
      const minScore = config.headPitchMinScore ?? 0.35;
      if (score < minScore) {
        raw = 0;
        state = "idle";
        smoothedValue = 0;
      }
    }

    smoothedValue = smoothedValue * (1 - smoothAlpha) + raw * smoothAlpha;
    const displayValue = raw;

    let feedbackState: FaceFeedbackState = "guide";

    switch (state) {
      case "idle":
        if (smoothedValue >= config.enterThreshold) {
          state = "open";
          feedbackState = "hold";
        } else {
          feedbackState = "guide";
        }
        break;

      case "open":
        if (smoothedValue < config.exitThreshold) {
          const now = Date.now();
          if (now - lastRepTime > MIN_REP_INTERVAL_MS) {
            reps++;
            lastRepTime = now;
          }
          state = reps >= target ? "idle" : "closing";
          feedbackState = reps >= target ? "complete" : "good";
        } else {
          feedbackState = "hold";
        }
        break;

      case "closing":
        state = "idle";
        feedbackState = "guide";
        break;

      case "alt_first_done":
        state = "idle";
        feedbackState = "guide";
        break;
    }

    return {
      reps,
      target,
      currentValue: displayValue,
      state,
      isComplete: reps >= target,
      progress: Math.min(reps / target, 1),
      feedbackKey: config.feedbackKey,
      feedbackState,
      barLabelKey: config.barLabelKey,
    };
  }

  function reset() {
    state = "idle";
    reps = 0;
    smoothedValue = 0;
    lastRepTime = 0;
    altPhase = "A";
    altSmoothedA = 0;
    altSmoothedB = 0;
  }

  return { update, reset, getConfig: () => config };
}

export { createFaceRepCounter, FACE_EXERCISE_CONFIGS };
export type { FaceRepResult, FaceRepConfig };
