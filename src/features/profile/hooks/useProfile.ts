import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthReady } from '@/features/auth/hooks/useAuthReady';
import type { Profile } from '@/shared/types/profile';
import { profileService } from '../services/profileService';

export const useProfile = () => {
  const authReady = useAuthReady();
  return useQuery({
    queryKey: ['profile'],
    queryFn: profileService.getProfile,
    enabled: authReady,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Profile>) => profileService.updateProfile(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profile'] }); },
  });
};
