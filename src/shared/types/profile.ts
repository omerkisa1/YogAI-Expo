import type { AppLanguage, Injury, Level } from './plan';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type Goal = 'flexibility' | 'stress_relief' | 'strength' | 'balance' | 'mobility' | 'posture';

export interface Profile {
  display_name: string;
  age: number;
  gender: Gender;
  level: Level;
  goals: Goal[];
  injuries: Injury[];
  preferred_language: AppLanguage;
  platform?: string;
  last_login_at?: string;
  auth_provider?: string;
}
