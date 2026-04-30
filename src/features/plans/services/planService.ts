import api from '@/shared/api/axiosInstance';
import type { CreatePlanRequest, Plan, PlanMetaUpdate } from '@/shared/types/plan';

const normalizePlansResponse = (data: unknown): Plan[] => {
  if (Array.isArray(data)) return data as Plan[];
  if (data && typeof data === 'object') {
    const wrapped = data as { plans?: unknown; items?: unknown; data?: unknown };
    if (Array.isArray(wrapped.plans)) return wrapped.plans as Plan[];
    if (Array.isArray(wrapped.items)) return wrapped.items as Plan[];
    if (Array.isArray(wrapped.data)) return wrapped.data as Plan[];
  }
  return [];
};

export const planService = {
  getPlans: () => api.get<unknown>('/api/v1/yoga/plans').then(r => normalizePlansResponse(r.data)),
  getPlan: (id: string) => api.get<Plan>(`/api/v1/yoga/plans/${id}`).then(r => r.data),
  createPlan: (data: CreatePlanRequest) => api.post<Plan>('/api/v1/yoga/plan', data).then(r => r.data),
  updatePlan: (id: string, data: PlanMetaUpdate) => api.patch<Plan>(`/api/v1/yoga/plans/${id}`, data).then(r => r.data),
  deletePlan: (id: string) => api.delete<{ success: boolean }>(`/api/v1/yoga/plans/${id}`).then(r => r.data),
};
