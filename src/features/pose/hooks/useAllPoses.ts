import { useIsFocused } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import api from '@/shared/api/axiosInstance';
import { useAuthReady } from '@/features/auth/hooks/useAuthReady';
import type { Pose } from '@/shared/types/pose';

type ApiWrapper<T> = { status: number; message: string; data: T };

export const ALL_POSES_QUERY_KEY = ['all-poses'] as const;

export const useAllPoses = (options?: { requireFocus?: boolean }) => {
  const authReady = useAuthReady();
  const isFocused = useIsFocused();
  const requireFocus = options?.requireFocus ?? true;
  const enabled = authReady && (!requireFocus || isFocused);

  return useQuery<Pose[]>({
    queryKey: ALL_POSES_QUERY_KEY,
    queryFn: () =>
      api.get<ApiWrapper<Pose[]>>('/api/v1/yoga/poses').then(r => r.data.data ?? []),
    staleTime: 10 * 60 * 1000,
    enabled,
  });
};
