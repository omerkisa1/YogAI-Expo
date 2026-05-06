import { useMutation, useQueryClient } from '@tanstack/react-query';
import { planService } from '../services/planService';

export function useCreateCustomPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: planService.createCustomPlan,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}
