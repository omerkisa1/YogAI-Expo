import api from '@/shared/api/axiosInstance';
import type { StartSessionResponse, SubmitPoseRequest, TrainingSession, TrainingStats } from '@/shared/types/training';

type ApiWrapper<T> = { status: number; message: string; data: T };

export const trainingService = {
  startSession: (planId: string) =>
    api.post<ApiWrapper<StartSessionResponse>>('/api/v1/training/start', { plan_id: planId })
      .then(r => {
        const d = r.data.data;
        return { ...d, session_id: d.session_id ?? d.id ?? '' };
      }),

  submitPose: (sessionId: string, data: SubmitPoseRequest) =>
    api.post<ApiWrapper<unknown>>(`/api/v1/training/sessions/${sessionId}/pose`, data)
      .then(r => r.data.data),

  completeSession: (sessionId: string) =>
    api.post<ApiWrapper<unknown>>(`/api/v1/training/sessions/${sessionId}/complete`)
      .then(r => r.data.data),

  getSessions: () =>
    api.get<ApiWrapper<TrainingSession[]>>('/api/v1/training/sessions')
      .then(r => r.data.data ?? []),

  getSession: (id: string) =>
    api.get<ApiWrapper<TrainingSession>>(`/api/v1/training/sessions/${id}`)
      .then(r => r.data.data),

  getStats: () =>
    api.get<ApiWrapper<TrainingStats>>('/api/v1/training/stats')
      .then(r => r.data.data),
};
