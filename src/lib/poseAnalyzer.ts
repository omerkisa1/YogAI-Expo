/**
 * ML Kit stream mode often reports low `inFrameLikelihood` on elbows/wrists (e.g. ~0.05).
 * Web/MediaPipe-style 0.5–0.65 would skip almost every limb triangle on device.
 */
export const RULE_TRIANGLE_VISIBILITY = 0.015;

/** Outside target range, score linearly decays to 0 over this many degrees (web parity). */
const TARGET_TOLERANCE_DEG = 15;

export type RuleType = 'target' | 'fault';

export interface LandmarkRule {
  rule_id: string;
  point_a: number;
  point_b: number;
  point_c: number;
  angle_min: number;
  angle_max: number;
  weight: number;
  rule_type: RuleType;
  fault_penalty_percent?: number;
  feedback_tr?: string;
  feedback_en?: string;
}

export interface LandmarkPoint {
  index: number;
  x: number;
  y: number;
  z?: number;
  visibility: number;
}

export type RuleScoreStatus =
  | 'good'
  | 'needs_improvement'
  | 'poor'
  | 'fault_detected'
  | 'low_visibility';

export interface RuleAnalysis {
  ruleId: string;
  angleDegrees: number;
  scorePercent: number;
  status: RuleScoreStatus;
  angleMin: number;
  angleMax: number;
  ruleType: RuleType;
  feedbackTr?: string;
  feedbackEn?: string;
  penaltyPercent?: number;
}

export interface AnalyzeResult {
  accuracyPercent: number;
  /** Sum of fault penalties applied (percentage points). */
  faultPenaltyTotal: number;
  rules: RuleAnalysis[];
}

function getLandmark(
  landmarks: LandmarkPoint[],
  index: number,
): LandmarkPoint | undefined {
  return landmarks.find(l => l.index === index);
}

function landmarksUsable(
  a?: LandmarkPoint,
  b?: LandmarkPoint,
  c?: LandmarkPoint,
): boolean {
  if (!a || !b || !c) return false;
  return (
    a.visibility >= RULE_TRIANGLE_VISIBILITY &&
    b.visibility >= RULE_TRIANGLE_VISIBILITY &&
    c.visibility >= RULE_TRIANGLE_VISIBILITY
  );
}

function isHipIndex(i: number): boolean {
  return i === 23 || i === 24;
}

function isShoulderIndex(i: number): boolean {
  return i === 11 || i === 12;
}

/** Hip-tabanlı “kol düz yukarı” kurallarında frontal proxy için skor bandı (kalça sentetiği yanlış pozitifti). */
/** Loglarda ~127–128° “kol tam dik değil” iken tam puan veriyordu; ≥135 tam hedef, altı toleransla azalır. */
const CORONAL_VERTICAL_ARM_ANGLE_MIN = 135;
const CORONAL_VERTICAL_ARM_ANGLE_MAX = 180;

type ResolvedRuleTriple = {
  a: LandmarkPoint;
  b: LandmarkPoint;
  c: LandmarkPoint;
  effectiveAngleMin?: number;
  effectiveAngleMax?: number;
};

/** API’de hip→shoulder→elbow + ~150–180° hedefi: omuz vertex’inde karşı omuz proxy kullanılır. */
function isVerticalArmHipRule(rule: LandmarkRule): boolean {
  return (
    isHipIndex(rule.point_a) &&
    isShoulderIndex(rule.point_b) &&
    rule.angle_min >= 145 &&
    rule.angle_max >= 175
  );
}

function effectiveAnglesForCoronalProxy(rule: LandmarkRule): {
  min: number;
  max: number;
} {
  if (isVerticalArmHipRule(rule)) {
    return {
      min: CORONAL_VERTICAL_ARM_ANGLE_MIN,
      max: CORONAL_VERTICAL_ARM_ANGLE_MAX,
    };
  }
  return { min: rule.angle_min, max: rule.angle_max };
}

/** Hip occluded: place vertex on shoulder→ankle segment (torso_lean–style rules). */
function syntheticHipBetweenShoulderAndAnkle(
  shoulder: LandmarkPoint,
  ankle: LandmarkPoint,
): LandmarkPoint {
  const t = 0.52;
  return {
    index: -2,
    x: shoulder.x + t * (ankle.x - shoulder.x),
    y: shoulder.y + t * (ankle.y - shoulder.y),
    visibility: Math.min(shoulder.visibility, ankle.visibility),
  };
}

/**
 * Resolve A,B,C for angle-at-B; hip kayıpken omuz kurallarında karşı omuz (frontal) proxy kullanılır.
 */
function resolveRuleLandmarks(
  landmarks: LandmarkPoint[],
  rule: LandmarkRule,
): ResolvedRuleTriple | null {
  const pa = getLandmark(landmarks, rule.point_a);
  const pb = getLandmark(landmarks, rule.point_b);
  const pc = getLandmark(landmarks, rule.point_c);

  if (landmarksUsable(pa, pb, pc)) {
    return { a: pa!, b: pb!, c: pc! };
  }

  // Arm elevation: hip → shoulder → elbow (vertex shoulder), hip sık kayıp — sentetik kalça yerine karşı omuz.
  if (
    pb &&
    pc &&
    isHipIndex(rule.point_a) &&
    isShoulderIndex(rule.point_b) &&
    pb.visibility >= RULE_TRIANGLE_VISIBILITY &&
    pc.visibility >= RULE_TRIANGLE_VISIBILITY &&
    (!pa || pa.visibility < RULE_TRIANGLE_VISIBILITY)
  ) {
    if (isVerticalArmHipRule(rule) && pc.y > pb.y + 0.1) {
      return null;
    }
    const eff = effectiveAnglesForCoronalProxy(rule);
    if (rule.point_b === 12 && rule.point_c === 14) {
      const ls = getLandmark(landmarks, 11);
      if (landmarksUsable(ls, pb, pc)) {
        return {
          a: ls!,
          b: pb,
          c: pc,
          effectiveAngleMin: eff.min,
          effectiveAngleMax: eff.max,
        };
      }
    }
    if (rule.point_b === 11 && rule.point_c === 13) {
      const rs = getLandmark(landmarks, 12);
      if (landmarksUsable(rs, pb, pc)) {
        return {
          a: rs!,
          b: pb,
          c: pc,
          effectiveAngleMin: eff.min,
          effectiveAngleMax: eff.max,
        };
      }
    }
  }

  // Fault torso lean: shoulder → hip → ankle (vertex hip).
  if (
    pa &&
    pc &&
    isHipIndex(rule.point_b) &&
    pa.visibility >= RULE_TRIANGLE_VISIBILITY &&
    pc.visibility >= RULE_TRIANGLE_VISIBILITY &&
    (!pb || pb.visibility < RULE_TRIANGLE_VISIBILITY)
  ) {
    const syn = syntheticHipBetweenShoulderAndAnkle(pa, pc);
    if (landmarksUsable(pa, syn, pc)) {
      return { a: pa, b: syn, c: pc };
    }
  }

  return null;
}

function analysisAngleBounds(
  rule: LandmarkRule,
  angleMinOverride?: number,
  angleMaxOverride?: number,
): { min: number; max: number } {
  if (rule.rule_type !== 'target') {
    return { min: rule.angle_min, max: rule.angle_max };
  }
  return {
    min: angleMinOverride ?? rule.angle_min,
    max: angleMaxOverride ?? rule.angle_max,
  };
}

/** Angle at vertex B between BA and BC, degrees 0–180. */
export function calculateAngle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  const bax = ax - bx;
  const bay = ay - by;
  const bcx = cx - bx;
  const bcy = cy - by;
  const dot = bax * bcx + bay * bcy;
  const magBa = Math.hypot(bax, bay);
  const magBc = Math.hypot(bcx, bcy);
  if (magBa < 1e-6 || magBc < 1e-6) return 0;
  let cos = dot / (magBa * magBc);
  cos = Math.max(-1, Math.min(1, cos));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Score 0–100 for a target angle vs inclusive [min, max] (yogai-frontend parity). */
export function scoreTargetAngle(angle: number, min: number, max: number): number {
  if (angle >= min && angle <= max) return 100;
  const deviation = Math.min(
    Math.abs(angle - min),
    Math.abs(angle - max),
  );
  if (deviation >= TARGET_TOLERANCE_DEG) return 0;
  return (1 - deviation / TARGET_TOLERANCE_DEG) * 100;
}

function statusFromScore(score: number, isFaultTriggered: boolean): RuleScoreStatus {
  if (isFaultTriggered) return 'fault_detected';
  if (score >= 90) return 'good';
  if (score >= 60) return 'needs_improvement';
  return 'poor';
}

export function scoreRule(
  rule: LandmarkRule,
  angle: number,
  visibilityOk: boolean,
  angleMinOverride?: number,
  angleMaxOverride?: number,
): RuleAnalysis {
  const bounds = analysisAngleBounds(rule, angleMinOverride, angleMaxOverride);

  if (!visibilityOk) {
    return {
      ruleId: rule.rule_id,
      angleDegrees: angle,
      scorePercent: 0,
      status: 'low_visibility',
      angleMin: bounds.min,
      angleMax: bounds.max,
      ruleType: rule.rule_type,
      feedbackTr: rule.feedback_tr,
      feedbackEn: rule.feedback_en,
    };
  }

  if (rule.rule_type === 'fault') {
    const inFault =
      angle >= rule.angle_min && angle <= rule.angle_max;
    const penalty = rule.fault_penalty_percent ?? 0;
    return {
      ruleId: rule.rule_id,
      angleDegrees: angle,
      scorePercent: inFault ? 0 : 100,
      status: inFault ? 'fault_detected' : 'good',
      angleMin: rule.angle_min,
      angleMax: rule.angle_max,
      ruleType: 'fault',
      feedbackTr: rule.feedback_tr,
      feedbackEn: rule.feedback_en,
      penaltyPercent: inFault ? penalty : undefined,
    };
  }

  const score = scoreTargetAngle(angle, bounds.min, bounds.max);
  return {
    ruleId: rule.rule_id,
    angleDegrees: angle,
    scorePercent: score,
    status: statusFromScore(score, false),
    angleMin: bounds.min,
    angleMax: bounds.max,
    ruleType: 'target',
    feedbackTr: rule.feedback_tr,
    feedbackEn: rule.feedback_en,
  };
}

export function analyzePoseClientSide(
  rules: LandmarkRule[],
  landmarks: LandmarkPoint[],
): AnalyzeResult {
  const ruleResults: RuleAnalysis[] = [];
  let targetWeighted = 0;
  let targetWeightSum = 0;
  let faultPenaltyTotal = 0;

  for (const rule of rules) {
    const triple = resolveRuleLandmarks(landmarks, rule);
    const ok = triple !== null;
    const angle = ok
      ? calculateAngle(
          triple.a.x,
          triple.a.y,
          triple.b.x,
          triple.b.y,
          triple.c.x,
          triple.c.y,
        )
      : 0;
    const analysis = scoreRule(
      rule,
      angle,
      ok,
      triple?.effectiveAngleMin,
      triple?.effectiveAngleMax,
    );
    ruleResults.push(analysis);

    if (rule.rule_type === 'fault') {
      if (!ok) continue;
      if (analysis.status === 'fault_detected') {
        faultPenaltyTotal += rule.fault_penalty_percent ?? 0;
      }
    } else {
      /** Çözülemeyen hedef kurallar da ağırlığa girer (pay = 0); yoksa tek kural %100 üretir. */
      targetWeightSum += rule.weight;
      if (ok) {
        targetWeighted += analysis.scorePercent * rule.weight;
      }
    }
  }

  const base =
    targetWeightSum > 0 ? targetWeighted / targetWeightSum : 0;
  const accuracyPercent = Math.max(0, Math.min(100, base - faultPenaltyTotal));

  return {
    accuracyPercent,
    faultPenaltyTotal,
    rules: ruleResults,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function optionalText(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
}

/** Accepts API snake_case or camelCase rule objects. */
export function parseLandmarkRules(raw: unknown): LandmarkRule[] {
  if (!Array.isArray(raw)) return [];
  const out: LandmarkRule[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const ruleId = str(item.rule_id ?? item.ruleId ?? item.joint, '');
    if (!ruleId) continue;
    const ruleTypeRaw = str(item.rule_type ?? item.ruleType, 'target');
    const rule_type: RuleType = ruleTypeRaw === 'fault' ? 'fault' : 'target';
    const weight = num(item.weight, 1);
    let faultPenalty = num(
      item.fault_penalty_percent ?? item.faultPenaltyPercent,
      NaN,
    );
    if (rule_type === 'fault' && !Number.isFinite(faultPenalty)) {
      faultPenalty = weight <= 1 ? weight * 100 : weight;
    } else if (!Number.isFinite(faultPenalty)) {
      faultPenalty = 0;
    }
    out.push({
      rule_id: ruleId,
      point_a: num(item.point_a ?? item.pointA, -1),
      point_b: num(item.point_b ?? item.pointB, -1),
      point_c: num(item.point_c ?? item.pointC, -1),
      angle_min: num(item.angle_min ?? item.angleMin, 0),
      angle_max: num(item.angle_max ?? item.angleMax, 180),
      weight,
      rule_type,
      fault_penalty_percent: faultPenalty,
      feedback_tr: optionalText(item.feedback_tr ?? item.feedbackTr),
      feedback_en: optionalText(item.feedback_en ?? item.feedbackEn),
    });
  }
  return out.filter(
    r => r.point_a >= 0 && r.point_b >= 0 && r.point_c >= 0,
  );
}
