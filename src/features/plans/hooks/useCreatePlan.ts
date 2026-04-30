import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlanMetaUpdate } from '@/shared/types/plan';
import { planService } from '../services/planService';

export const useCreatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: planService.createPlan,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plans'] }); },
  });
};

export const useDeletePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: planService.deletePlan,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plans'] }); },
  });
};

interface UpdatePlanParams { id: string; data: PlanMetaUpdate }

export const useUpdatePlan = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: UpdatePlanParams) => planService.updatePlan(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['plans', variables.id] });
    },
  });
};
