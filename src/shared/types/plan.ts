export type Level = 'beginner' | 'intermediate' | 'advanced';

export type FocusArea =
  | 'full_body'
  | 'legs'
  | 'back'
  | 'core'
  | 'balance'
  | 'flexibility'
  | 'arms'
  | 'hips';

export type Injury =
  | 'knee_injury'
  | 'ankle_injury'
  | 'herniated_disc'
  | 'low_back_pain'
  | 'shoulder_injury'
  | 'wrist_injury'
  | 'neck_injury'
  | 'groin_injury'
  | 'hip_injury';

export type AppLanguage = 'tr' | 'en';

export interface Exercise {
  pose_id: string;
  name_en: string;
  name_tr: string;
  duration_min: number;
  instructions_en: string;
  instructions_tr: string;
  benefit_en: string;
  benefit_tr: string;
  target_area: FocusArea;
  category: string;
  is_analyzable: boolean;
}

export interface Plan {
  id: string;
  title_en: string;
  title_tr: string;
  focus_area: FocusArea;
  difficulty: Level;
  total_duration_min: number;
  description_en: string;
  description_tr: string;
  analyzable_pose_count: number;
  total_pose_count: number;
  favorite?: boolean;
  pin?: boolean;
  created_at?: string;
  updated_at?: string;
  exercises: Exercise[];
}

export interface CreatePlanRequest {
  level: Level;
  duration: number;
  focus_area: FocusArea;
  injuries: Injury[];
  language: AppLanguage;
}

export interface PlanMetaUpdate {
  favorite?: boolean;
  pin?: boolean;
}
