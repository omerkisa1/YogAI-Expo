import api from '@/shared/api/axiosInstance';
import type { StartSessionResponse, SubmitPoseRequest, TrainingSession, TrainingStats } from '@/shared/types/training';

export const trainingService = {
  startSession: (planId: string) =>
    api.post<StartSessionResponse>('/api/v1/training/start', { plan_id: planId }).then(r => r.data),
  submitPose: (sessionId: string, data: SubmitPoseRequest) =>
    api.post(`/api/v1/training/sessions/${sessionId}/pose`, data).then(r => r.data),
  completeSession: (sessionId: string) =>
    api.post(`/api/v1/training/sessions/${sessionId}/complete`).then(r => r.data),
  getSessions: () => api.get<TrainingSession[]>('/api/v1/training/sessions').then(r => r.data),
  getSession: (id: string) => api.get<TrainingSession>(`/api/v1/training/sessions/${id}`).then(r => r.data),
  getStats: () => api.get<TrainingStats>('/api/v1/training/stats').then(r => r.data),
};
