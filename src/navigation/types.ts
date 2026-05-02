import { NavigatorScreenParams } from '@react-navigation/native';
import type { Level } from '@/shared/types/plan';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Plans: undefined;
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
  TrainingSession: { planId: string; sessionId: string };
  CameraTest: undefined;
  TrainingSessionDetail: { sessionId: string };
};
