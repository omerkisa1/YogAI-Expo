import { useQuery } from '@tanstack/react-query';
import { useAuthReady } from '@/features/auth/hooks/useAuthReady';
import { planService } from '../services/planService';

export const usePlan = (id: string) => {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['plans', id],
    queryFn: () => planService.getPlan(id),
    enabled: authReady && Boolean(id),
  });
};
