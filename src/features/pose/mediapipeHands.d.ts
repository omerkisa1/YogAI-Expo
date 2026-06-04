import type { Frame } from 'react-native-vision-camera';

import type { HandDetectionPayload } from './useHandLandmarker';

export declare const HAND_LANDMARKER_SUPPORTED: boolean;

export type HandDetectionWorkletResult = HandDetectionPayload & {
  handReady: boolean;
  poseReady: boolean;
  pluginReturnedNull: boolean;
  nativeHandCount?: number;
  frameOrientation?: string;
  detectMode?: string;
};

export declare function detectHandsInFrame(frame: Frame): HandDetectionWorkletResult;
