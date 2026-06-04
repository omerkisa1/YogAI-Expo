import { VisionCameraProxy, type Frame } from 'react-native-vision-camera';

import { mapIosResult, type PosePluginResult } from './mediapipeHandsHelpers';
import type { HandDetectionPayload } from './useHandLandmarker';

const posePlugin = VisionCameraProxy.initFrameProcessorPlugin('poseLandmarker', {});

export const HAND_LANDMARKER_SUPPORTED = posePlugin != null;

export function detectHandsInFrame(frame: Frame): HandDetectionPayload {
  'worklet';
  const timestamp = typeof frame.timestamp === 'number' ? frame.timestamp : 0;

  if (!posePlugin) {
    return { hands: [], timestamp };
  }

  try {
    const result = posePlugin.call(frame) as PosePluginResult | undefined;
    if (!result) return { hands: [], timestamp };
    const hands = result.hands ?? [];
    if (hands.length === 0) return { hands: [], timestamp };
    return mapIosResult({ hands }, timestamp);
  } catch {
    return { hands: [], timestamp };
  }
}
