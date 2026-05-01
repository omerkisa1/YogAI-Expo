import api from '@/shared/api/axiosInstance';
import type { CreatePlanRequest, Exercise, FocusArea, Level, Plan, PlanMetaUpdate } from '@/shared/types/plan';

type ApiWrapper<T> = { status: number; message: string; data: T };
type RawPlan = Record<string, unknown>;

const mapPlan = (raw: RawPlan): Plan => {
  const detail = ((raw.plan ?? raw.plan_en ?? raw.plan_tr ?? {}) as RawPlan);
  return {
    id: raw.id as string,
    title_en: (detail.title_en ?? '') as string,
    title_tr: (detail.title_tr ?? '') as string,
    focus_area: ((detail.focus_area ?? raw.focus_area ?? 'full_body') as FocusArea),
    difficulty: ((detail.difficulty ?? raw.level ?? 'beginner') as Level),
    total_duration_min: (detail.total_duration_min ?? raw.duration ?? 0) as number,
    description_en: (detail.description_en ?? '') as string,
    description_tr: (detail.description_tr ?? '') as string,
    analyzable_pose_count: (detail.analyzable_pose_count ?? 0) as number,
    total_pose_count: (detail.total_pose_count ?? 0) as number,
    favorite: (raw.is_favorite ?? false) as boolean,
    pin: (raw.is_pinned ?? false) as boolean,
    created_at: raw.created_at as string | undefined,
    exercises: ((detail.exercises ?? []) as Exercise[]),
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
    api.post<ApiWrapper<RawPlan>>('/api/v1/yoga/plan', data)
      .then(r => extractPlan(r.data)),

  updatePlan: (id: string, data: PlanMetaUpdate) =>
    api.patch<ApiWrapper<RawPlan>>(`/api/v1/yoga/plans/${id}`, {
      ...(data.favorite !== undefined && { is_favorite: data.favorite }),
      ...(data.pin !== undefined && { is_pinned: data.pin }),
    }).then(r => extractPlan(r.data)),

  deletePlan: (id: string) =>
    api.delete<{ success: boolean }>(`/api/v1/yoga/plans/${id}`)
      .then(r => r.data),
};
