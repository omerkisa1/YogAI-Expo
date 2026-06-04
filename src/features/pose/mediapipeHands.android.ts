import { VisionCameraProxy, type Frame } from 'react-native-vision-camera';
import type { HandDetectionResult } from 'expo-vision-camera-v4-mediapipe';

import { mapAndroidResult } from './mediapipeHandsHelpers';
import type { HandDetectionPayload } from './useHandLandmarker';

const handPlugin = VisionCameraProxy.initFrameProcessorPlugin('handLandmarker', {});

export const HAND_LANDMARKER_SUPPORTED = handPlugin != null;

export function detectHandsInFrame(frame: Frame): HandDetectionPayload {
  'worklet';
  const timestamp = typeof frame.timestamp === 'number' ? frame.timestamp : 0;

  if (!handPlugin) {
    return { hands: [], timestamp };
  }

  try {
    const result = handPlugin.call(frame) as HandDetectionResult | undefined;
    return mapAndroidResult(result ?? { hands: [] }, timestamp);
  } catch {
    return { hands: [], timestamp };
  }
}
