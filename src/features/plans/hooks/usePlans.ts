import { useQuery } from '@tanstack/react-query';
import { useAuthReady } from '@/features/auth/hooks/useAuthReady';
import { planService } from '../services/planService';

export const usePlans = () => {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['plans'],
    queryFn: planService.getPlans,
    enabled: authReady,
  });
};
