import { NavigatorScreenParams } from '@react-navigation/native';
import type { Level } from '@/shared/types/plan';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Plans: undefined;
  Explore: undefined;
  Training: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  PlanDetail: { planId: string };
  CreatePlan:
    | {
        presetLevel?: Level;
        presetDuration?: number;
      }
    | undefined;
  EditProfile: undefined;
  /**
   * Aktif antrenman. `accuracy` gönderimi: analiz edilebilir pozlarda Vision + kurallarla üretilen
   * smoothing’li skorlardan **son ~5 saniyenin ortalaması** (throttle ~150ms); örnek yoksa son frame.
   * Analiz edilemeyen pozlarda 0.
   */
  TrainingSession: { planId: string; sessionId: string };
  CameraTest: undefined;
  TrainingSessionDetail: { sessionId: string };
  PoseDetail: { poseId: string };
  CreateCustomPlan: { addPoseId?: string; selectedPoseIds?: string[] } | undefined;
  SelectPosesForPlan: { currentPoseIds: string[] };
};
