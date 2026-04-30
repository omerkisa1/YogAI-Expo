import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubmitPoseRequest } from '@/shared/types/training';
import { trainingService } from '../services/trainingService';

export const useTrainingSessions = () =>
  useQuery({ queryKey: ['training', 'sessions'], queryFn: trainingService.getSessions });

export const useTrainingSession = (id: string) =>
  useQuery({ queryKey: ['training', 'sessions', id], queryFn: () => trainingService.getSession(id), enabled: Boolean(id) });

export const useTrainingStats = () =>
  useQuery({ queryKey: ['training', 'stats'], queryFn: trainingService.getStats });

export const useStartTrainingSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: trainingService.startSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training', 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['training', 'stats'] });
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
      queryClient.invalidateQueries({ queryKey: ['training', 'stats'] });
    },
  });
};
