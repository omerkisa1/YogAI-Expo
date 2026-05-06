export interface Pose {
  pose_id: string;
  name_en: string;
  name_tr: string;
  category: string;
  difficulty: number;
  target_area: string;
  instructions_en: string;
  instructions_tr: string;
  contraindications: string[];
  is_analyzable: boolean;
}
