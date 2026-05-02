export interface PoseResult {
  pose_id: string;
  accuracy: number;
  duration_seconds: number;
  completed_at?: string;
}

export interface TrainingSession {
  id: string;
  plan_id: string;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  average_accuracy?: number;
  total_duration_sec?: number;
  results?: PoseResult[];
}

export interface StartSessionResponse {
  session_id?: string;
  id?: string;
  status: 'active';
}

export interface SubmitPoseRequest {
  pose_id: string;
  accuracy: number;
  duration_seconds: number;
}

export interface TrainingStats {
  total_sessions: number;
  total_duration_sec: number;
  average_accuracy: number;
  current_streak: number;
}
