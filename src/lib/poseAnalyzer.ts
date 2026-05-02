/**
 * Minimum landmark visibility to include in angle calculation.
 * Below this → rule is skipped (marked `low_visibility`), NOT scored.
 */
export const RULE_TRIANGLE_VISIBILITY = 0.5;

/** At least this many landmarks (of 33) must be visible to attempt analysis. */
const MIN_VISIBLE_LANDMARKS = 17;

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

/**
 * Simple direct triangle lookup — NO proxy, NO synthetic landmarks.
 * If any of the 3 points is missing or below visibility threshold → null (rule skipped).
 */
function resolveRuleLandmarks(
  landmarks: LandmarkPoint[],
  rule: LandmarkRule,
): { a: LandmarkPoint; b: LandmarkPoint; c: LandmarkPoint } | null {
  const pa = getLandmark(landmarks, rule.point_a);
  const pb = getLandmark(landmarks, rule.point_b);
  const pc = getLandmark(landmarks, rule.point_c);

  if (!landmarksUsable(pa, pb, pc)) return null;
  return { a: pa!, b: pb!, c: pc! };
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
): RuleAnalysis {
  if (!visibilityOk) {
    return {
      ruleId: rule.rule_id,
      angleDegrees: angle,
      scorePercent: 0,
      status: 'low_visibility',
      angleMin: rule.angle_min,
      angleMax: rule.angle_max,
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

  const score = scoreTargetAngle(angle, rule.angle_min, rule.angle_max);
  return {
    ruleId: rule.rule_id,
    angleDegrees: angle,
    scorePercent: score,
    status: statusFromScore(score, false),
    angleMin: rule.angle_min,
    angleMax: rule.angle_max,
    ruleType: 'target',
    feedbackTr: rule.feedback_tr,
    feedbackEn: rule.feedback_en,
  };
}

export function analyzePoseClientSide(
  rules: LandmarkRule[],
  landmarks: LandmarkPoint[],
): AnalyzeResult {
  // Minimum landmark visibility check — too few visible → unreliable
  const visibleCount = landmarks.filter(
    l => l.visibility >= RULE_TRIANGLE_VISIBILITY,
  ).length;
  if (visibleCount < MIN_VISIBLE_LANDMARKS) {
    return {
      accuracyPercent: 0,
      faultPenaltyTotal: 0,
      rules: [],
    };
  }

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
    const analysis = scoreRule(rule, angle, ok);
    ruleResults.push(analysis);

    if (!ok) continue; // Low visibility → skip scoring entirely

    if (rule.rule_type === 'fault') {
      if (analysis.status === 'fault_detected') {
        faultPenaltyTotal += rule.fault_penalty_percent ?? 0;
      }
    } else {
      targetWeighted += analysis.scorePercent * rule.weight;
      targetWeightSum += rule.weight;
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
