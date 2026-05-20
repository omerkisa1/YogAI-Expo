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
  analysis_kind: 'body' | 'face' | 'face_hand';
  metric_type: 'accuracy' | 'reps';
  rep_target: number;
}
