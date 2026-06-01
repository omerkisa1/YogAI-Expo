import type { Exercise, Plan, PlanType } from '@/shared/types/plan';
import type { Pose } from '@/shared/types/pose';
import { normalizePlanType, resolveExerciseAnalysisKind } from '@/lib/poseDomain';

export type BilingualExercise = Exercise & {
  name?: string;
  name_en?: string;
  name_tr?: string;
  instructions?: string;
  instructions_en?: string;
  instructions_tr?: string;
  benefit?: string;
  benefit_en?: string;
  benefit_tr?: string;
};

export type BilingualPlan = {
  title_en?: string;
  title_tr?: string;
  description_en?: string;
  description_tr?: string;
  focus_area?: string;
  difficulty?: string;
  total_duration_min?: number;
  analyzable_pose_count?: number;
  total_pose_count?: number;
  source?: string;
  exercises?: BilingualExercise[];
};

function unwrapBilingualPlan(raw: unknown): BilingualPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as BilingualPlan & { plan?: BilingualPlan };
  if (Array.isArray(obj.exercises)) return obj;
  if (obj.plan && Array.isArray(obj.plan.exercises)) return obj.plan;
  return null;
}

export function resolveBilingualPlanContent(plan: Plan): BilingualPlan | null {
  const en = plan.plan_en as unknown;
  const tr = plan.plan_tr as unknown;
  return unwrapBilingualPlan(en) ?? unwrapBilingualPlan(tr);
}

export function getLocalizedField(locale: string, en: string, tr: string): string {
  return locale === 'tr' ? tr || en : en || tr;
}

export function mapLocalizedExercise(ex: BilingualExercise, locale: string) {
  const kind = ex.analysis_kind ?? resolveExerciseAnalysisKind(ex.pose_id);
  const metric = ex.metric_type ?? (kind === 'face' || kind === 'face_hand' ? 'reps' : 'accuracy');
  return {
    pose_id: ex.pose_id,
    name: getLocalizedField(locale, ex.name_en ?? ex.name, ex.name_tr ?? ex.name),
    instructions: getLocalizedField(
      locale,
      ex.instructions_en ?? ex.instructions,
      ex.instructions_tr ?? ex.instructions,
    ),
    benefit: getLocalizedField(locale, ex.benefit_en ?? ex.benefit, ex.benefit_tr ?? ex.benefit),
    duration_min: ex.duration_min,
    target_area: ex.target_area,
    category: ex.category,
    is_analyzable: ex.is_analyzable,
    analysis_kind: kind,
    metric_type: metric,
    rep_target: ex.rep_target ?? 0,
  };
}

export type LocalizedExercise = ReturnType<typeof mapLocalizedExercise>;

export function getLocalizedPlan(plan: Plan, locale: string) {
  const raw = resolveBilingualPlanContent(plan);
  if (!raw) return null;

  return {
    id: plan.id,
    title: getLocalizedField(locale, raw.title_en ?? plan.title_en, raw.title_tr ?? plan.title_tr),
    description: getLocalizedField(locale, raw.description_en ?? '', raw.description_tr ?? ''),
    focus_area: raw.focus_area ?? plan.focus_area,
    difficulty: raw.difficulty ?? plan.difficulty,
    total_duration_min: raw.total_duration_min ?? plan.total_duration_min,
    is_favorite: plan.favorite ?? false,
    is_pinned: plan.pin ?? false,
    source: raw.source ?? plan.source,
    analyzable_pose_count: raw.analyzable_pose_count ?? plan.analyzable_pose_count,
    total_pose_count: raw.total_pose_count ?? plan.total_pose_count,
    exercises: (raw.exercises ?? []).map(ex => mapLocalizedExercise(ex, locale)),
    created_at: plan.created_at,
    plan_type: plan.plan_type,
  };
}

export type LocalizedPlan = NonNullable<ReturnType<typeof getLocalizedPlan>>;

export function emptyLocalizedPlan(plan: Plan, yogaPlanLabel: string, locale: string): LocalizedPlan {
  return {
    id: plan.id,
    title: yogaPlanLabel,
    description: '',
    focus_area: plan.focus_area ?? 'full_body',
    difficulty: plan.difficulty ?? 'beginner',
    total_duration_min: plan.total_duration_min ?? 0,
    is_favorite: plan.favorite ?? false,
    is_pinned: plan.pin ?? false,
    source: plan.source,
    exercises: [],
    analyzable_pose_count: 0,
    total_pose_count: 0,
    created_at: plan.created_at,
    plan_type: plan.plan_type,
  };
}

export function getLocalizedPlanSafe(plan: Plan, locale: string, yogaPlanLabel: string): LocalizedPlan {
  return getLocalizedPlan(plan, locale) ?? emptyLocalizedPlan(plan, yogaPlanLabel, locale);
}

export function inferPlanType(
  plan: Plan,
  catalogKindByPoseId?: (poseId: string) => Pose['analysis_kind'] | undefined,
): PlanType {
  if (plan.plan_type) {
    return normalizePlanType(plan.plan_type);
  }
  const raw = resolveBilingualPlanContent(plan);
  const firstPoseId = raw?.exercises?.[0]?.pose_id;
  if (firstPoseId && catalogKindByPoseId) {
    const kind = catalogKindByPoseId(firstPoseId);
    if (kind === 'face' || kind === 'face_hand') return 'face';
  }
  if (firstPoseId) {
    const kind = resolveExerciseAnalysisKind(firstPoseId, raw?.exercises?.[0]?.analysis_kind);
    if (kind === 'face' || kind === 'face_hand') return 'face';
  }
  return 'body';
}

export function exerciseAllocatedSeconds(
  ex: Pick<LocalizedExercise, 'duration_min' | 'metric_type' | 'rep_target'>,
  devShortTimer: boolean,
): number {
  if (devShortTimer) return 15;
  if (ex.metric_type === 'reps') {
    const reps = ex.rep_target > 0 ? ex.rep_target : 10;
    const seconds = reps * 3 + 10;
    return Math.max(30, seconds);
  }
  if (ex.duration_min > 0) {
    return Math.max(1, Math.round(ex.duration_min * 60));
  }
  return 60;
}
