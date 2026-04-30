import { useQuery } from '@tanstack/react-query';
import { planService } from '../services/planService';

export const usePlans = () => useQuery({ queryKey: ['plans'], queryFn: planService.getPlans });
