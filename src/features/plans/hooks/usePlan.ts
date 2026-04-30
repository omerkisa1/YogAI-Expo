import { useQuery } from '@tanstack/react-query';
import { planService } from '../services/planService';

export const usePlan = (id: string) =>
  useQuery({ queryKey: ['plans', id], queryFn: () => planService.getPlan(id), enabled: Boolean(id) });
