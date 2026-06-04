import type { Frame } from 'react-native-vision-camera';

import type { HandDetectionPayload } from './useHandLandmarker';

export const HAND_LANDMARKER_SUPPORTED = false;

export function detectHandsInFrame(_frame: Frame): HandDetectionPayload {
  'worklet';
  return { hands: [], timestamp: 0 };
}
