import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile } from '@/shared/types/profile';
import { profileService } from '../services/profileService';

export const useProfile = () =>
  useQuery({ queryKey: ['profile'], queryFn: profileService.getProfile });

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Profile>) => profileService.updateProfile(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['profile'] }); },
  });
};
