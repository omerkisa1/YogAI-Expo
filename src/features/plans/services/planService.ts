import api from '@/shared/api/axiosInstance';
import { normalizePlanType } from '@/lib/poseDomain';
import type { CreatePlanRequest, CustomPlanRequest, CustomPlanResponse, Exercise, FocusArea, Level, Plan, PlanMetaUpdate, PlanType } from '@/shared/types/plan';

type ApiWrapper<T> = { status: number; message: string; data: T };
type RawPlan = Record<string, unknown>;

const parseOptionalCompletionPercent = (raw: RawPlan, detail: RawPlan): number | undefined => {
  const candidates = [
    detail.completion_percent,
    detail.completionPercentage,
    raw.completion_percent,
    raw.completionPercentage,
    raw.progress_percent,
  ];
  for (const v of candidates) {
    if (v == null || v === '') continue;
    const n = typeof v === 'string' ? Number.parseFloat(v) : Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
  }
  return undefined;
};

const mapPlan = (raw: RawPlan): Plan => {
  const detail = ((raw.plan ?? raw.plan_en ?? raw.plan_tr ?? {}) as RawPlan);
  return {
    id: raw.id as string,
    title_en: (detail.title_en ?? '') as string,
    title_tr: (detail.title_tr ?? '') as string,
    focus_area: ((detail.focus_area ?? raw.focus_area ?? 'full_body') as FocusArea),
    difficulty: (((detail.difficulty as string | undefined)?.toLowerCase() ?? (raw.level as string | undefined)?.toLowerCase() ?? 'beginner') as Level),
    total_duration_min: (detail.total_duration_min ?? raw.duration ?? 0) as number,
    description_en: (detail.description_en ?? '') as string,
    description_tr: (detail.description_tr ?? '') as string,
    analyzable_pose_count: (detail.analyzable_pose_count ?? 0) as number,
    total_pose_count: (detail.total_pose_count ?? 0) as number,
    completion_percent: parseOptionalCompletionPercent(raw, detail),
    favorite: (raw.is_favorite ?? false) as boolean,
    pin: (raw.is_pinned ?? false) as boolean,
    created_at: raw.created_at as string | undefined,
    exercises: ((detail.exercises ?? []) as Exercise[]),
    source: (raw.source as 'ai' | 'custom' | undefined),
    plan_type: (() => {
      const exercisesList = (detail.exercises ?? []) as Exercise[];
      const inferred =
        exercisesList.some(
          ex => ex.analysis_kind === 'face' || ex.analysis_kind === 'face_hand',
        )
          ? 'face'
          : 'body';
      return normalizePlanType(
        (raw.plan_type as string | undefined) ??
          (detail.plan_type as string | undefined) ??
          inferred,
      ) as PlanType;
    })(),
    plan_en: raw.plan_en,
    plan_tr: raw.plan_tr,
  };
};

const extractPlans = (data: unknown): Plan[] => {
  if (Array.isArray(data)) return data.map(p => mapPlan(p as RawPlan));
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.plans)) return (d.plans as RawPlan[]).map(mapPlan);
    if (Array.isArray(d.items)) return (d.items as RawPlan[]).map(mapPlan);
    if (Array.isArray(d.data))  return (d.data as RawPlan[]).map(mapPlan);
    if (d.data && typeof d.data === 'object') {
      const inner = d.data as Record<string, unknown>;
      if (Array.isArray(inner.plans)) return (inner.plans as RawPlan[]).map(mapPlan);
      if (Array.isArray(inner.items)) return (inner.items as RawPlan[]).map(mapPlan);
    }
  }
  return [];
};

const extractPlan = (raw: unknown): Plan => {
  if (raw && typeof raw === 'object') {
    const d = raw as Record<string, unknown>;
    if (d.data && typeof d.data === 'object' && !Array.isArray(d.data)) {
      return mapPlan(d.data as RawPlan);
    }
    return mapPlan(d as RawPlan);
  }
  throw new Error('Invalid plan response');
};

export const planService = {
  getPlans: () =>
    api.get<ApiWrapper<{ plans: RawPlan[]; count: number }>>('/api/v1/yoga/plans')
      .then(r => extractPlans(r.data)),

  getPlan: (id: string) =>
    api.get<ApiWrapper<RawPlan>>(`/api/v1/yoga/plans/${id}`)
      .then(r => extractPlan(r.data)),

  createPlan: (data: CreatePlanRequest) =>
    api
      .post<ApiWrapper<RawPlan>>('/api/v1/yoga/plan', data, {
        skipGlobalErrorHandler: true,
      })
      .then(r => extractPlan(r.data)),

  updatePlan: (id: string, data: PlanMetaUpdate) =>
    api.patch<ApiWrapper<RawPlan>>(`/api/v1/yoga/plans/${id}`, {
      ...(data.favorite !== undefined && { is_favorite: data.favorite }),
      ...(data.pin !== undefined && { is_pinned: data.pin }),
    }).then(r => extractPlan(r.data)),

  deletePlan: (id: string) =>
    api.delete<{ success: boolean }>(`/api/v1/yoga/plans/${id}`)
      .then(r => r.data),

  createCustomPlan: async (data: CustomPlanRequest): Promise<CustomPlanResponse> => {
    type Wrapper = { status: number; message: string; data: { plan: RawPlan; warnings?: string[] } };
    const r = await api.post<Wrapper>('/api/v1/yoga/plans/custom', data);
    const raw = r.data.data;
    const planRaw = (raw.plan as RawPlan) ?? (raw as RawPlan);
    return {
      plan: extractPlan(planRaw),
      warnings: raw.warnings,
    };
  },
};
