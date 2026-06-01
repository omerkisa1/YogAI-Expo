import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthReady } from '@/features/auth/hooks/useAuthReady';
import { computeTrainingStatsFromSessions } from '@/lib/computeTrainingStats';
import type { SubmitPoseRequest, TrainingStats } from '@/shared/types/training';
import { trainingService } from '../services/trainingService';

export const useTrainingSessions = () => {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['training', 'sessions'],
    queryFn: trainingService.getSessions,
    enabled: authReady,
  });
};

export const useTrainingSession = (id: string) => {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['training', 'sessions', id],
    queryFn: () => trainingService.getSession(id),
    enabled: authReady && Boolean(id),
  });
};

export const useTrainingStats = () => {
  const sessionsQuery = useTrainingSessions();
  const data = useMemo<TrainingStats | undefined>(
    () => (sessionsQuery.data ? computeTrainingStatsFromSessions(sessionsQuery.data) : undefined),
    [sessionsQuery.data],
  );
  return {
    data,
    isLoading: sessionsQuery.isLoading,
    isFetching: sessionsQuery.isFetching,
    isError: sessionsQuery.isError,
    isSuccess: sessionsQuery.isSuccess,
    error: sessionsQuery.error,
    refetch: sessionsQuery.refetch,
  };
};

export const useCompletedSessionsByPlan = () => {
  const q = useTrainingSessions();
  return useMemo(() => {
    const m = new Map<string, number>();
    const sessions = q.data;
    if (!Array.isArray(sessions)) return m;
    for (const s of sessions) {
      if (s.status === 'completed') m.set(s.plan_id, (m.get(s.plan_id) ?? 0) + 1);
    }
    return m;
  }, [q.data]);
};

export const useStartTrainingSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: trainingService.startSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training', 'sessions'] });
    },
  });
};

interface SubmitPoseVariables { sessionId: string; data: SubmitPoseRequest }

export const useSubmitPose = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, data }: SubmitPoseVariables) => trainingService.submitPose(sessionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['training', 'sessions', variables.sessionId] });
    },
  });
};

export const useCompleteTrainingSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: trainingService.completeSession,
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['training', 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['training', 'sessions', sessionId] });
    },
  });
};
