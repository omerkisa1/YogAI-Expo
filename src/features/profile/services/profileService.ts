import api from '@/shared/api/axiosInstance';
import type { Profile } from '@/shared/types/profile';

export const profileService = {
  getProfile: () => api.get<Profile>('/api/v1/profile').then(r => r.data),
  updateProfile: (data: Partial<Profile>) => api.put<Profile>('/api/v1/profile', data).then(r => r.data),
};
