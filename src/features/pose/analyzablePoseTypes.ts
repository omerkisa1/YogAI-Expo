export type AnalyzablePose = {
  pose_id: string;
  name_en: string;
  name_tr: string;
  difficulty: number;
  is_analyzable: boolean;
  analysis_kind?: 'body' | 'face' | 'face_hand';
  metric_type?: 'accuracy' | 'reps';
  rep_target?: number;
  instructions_en: string;
  instructions_tr: string;
  category: string;
  landmark_rules?: unknown;
  landmarkRules?: unknown;
};

export type AnalyzablePoseMeta = {
  pose_id: string;
  name_en: string;
  name_tr: string;
  difficulty: number;
  is_analyzable: boolean;
  analysis_kind?: 'body' | 'face' | 'face_hand';
  metric_type?: 'accuracy' | 'reps';
  rep_target?: number;
};

export type YogaApiResponse<T> = {
  status: number;
  message: string;
  data: T;
};
