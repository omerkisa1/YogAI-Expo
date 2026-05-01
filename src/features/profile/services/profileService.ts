import api from '@/shared/api/axiosInstance';
import type { Profile } from '@/shared/types/profile';
import type { Goal, Injury, Level, AppLanguage } from '@/shared/types/plan';

type ApiWrapper<T> = { status: number; message: string; data: T };

interface RawProfile {
  display_name?: string;
  birth_year?: number;
  gender?: string;
  fitness_level?: string;
  goals?: string[];
  injuries?: string[];
  preferred_language?: string;
  platform?: string;
  last_login_at?: string;
  auth_provider?: string;
}

const mapProfile = (raw: RawProfile): Profile => ({
  display_name: raw.display_name ?? '',
  age: raw.birth_year ?? 0,
  gender: (raw.gender as Profile['gender']) ?? 'prefer_not_to_say',
  level: (raw.fitness_level as Level) ?? 'beginner',
  goals: (raw.goals ?? []) as Goal[],
  injuries: (raw.injuries ?? []) as Injury[],
  preferred_language: (raw.preferred_language as AppLanguage) ?? 'tr',
  platform: raw.platform,
  last_login_at: raw.last_login_at,
  auth_provider: raw.auth_provider,
});

const toBackendProfile = (data: Partial<Profile>): Record<string, unknown> => ({
  ...(data.display_name !== undefined && { display_name: data.display_name }),
  ...(data.age !== undefined && { birth_year: data.age }),
  ...(data.gender !== undefined && { gender: data.gender }),
  ...(data.level !== undefined && { fitness_level: data.level }),
  ...(data.goals !== undefined && { goals: data.goals }),
  ...(data.injuries !== undefined && { injuries: data.injuries }),
  ...(data.preferred_language !== undefined && { preferred_language: data.preferred_language }),
  ...(data.platform !== undefined && { platform: data.platform }),
  ...(data.last_login_at !== undefined && { last_login_at: data.last_login_at }),
  ...(data.auth_provider !== undefined && { auth_provider: data.auth_provider }),
});

const extractProfile = (raw: unknown): Profile => {
  if (raw && typeof raw === 'object') {
    const d = raw as Record<string, unknown>;
    if (d.data && typeof d.data === 'object' && !Array.isArray(d.data)) {
      return mapProfile(d.data as RawProfile);
    }
    return mapProfile(d as RawProfile);
  }
  return mapProfile({});
};

export const profileService = {
  getProfile: () =>
    api.get<ApiWrapper<RawProfile>>('/api/v1/profile')
      .then(r => extractProfile(r.data)),

  updateProfile: (data: Partial<Profile>) =>
    api.put<ApiWrapper<RawProfile>>('/api/v1/profile', toBackendProfile(data))
      .then(r => extractProfile(r.data)),
};
