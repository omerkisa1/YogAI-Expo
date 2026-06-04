import { VisionCameraProxy, type Frame } from 'react-native-vision-camera';

import { mapIosResult, type PosePluginResult } from './mediapipeHandsHelpers';
import type { HandDetectionPayload } from './useHandLandmarker';

const posePlugin = VisionCameraProxy.initFrameProcessorPlugin('poseLandmarker', {});

export const HAND_LANDMARKER_SUPPORTED = posePlugin != null;

export type HandDetectionWorkletResult = HandDetectionPayload & {
  handReady: boolean;
  poseReady: boolean;
  pluginReturnedNull: boolean;
  nativeHandCount?: number;
  frameOrientation?: string;
  detectMode?: string;
};

export function detectHandsInFrame(frame: Frame): HandDetectionWorkletResult {
  'worklet';
  const timestamp = typeof frame.timestamp === 'number' ? frame.timestamp : 0;
  const emptyMeta = { handReady: false, poseReady: false, pluginReturnedNull: true };

  if (!posePlugin) {
    return { hands: [], timestamp, ...emptyMeta };
  }

  try {
    const result = posePlugin.call(frame, {
      handsOnly: true,
      orientation: frame.orientation,
    }) as PosePluginResult | undefined;
    if (!result) {
      return { hands: [], timestamp, ...emptyMeta };
    }
    const meta = result.meta;
    const handReady = meta?.handReady === true;
    const poseReady = meta?.poseReady === true;
    const nativeHandCount = meta?.nativeHandCount ?? 0;
    const frameOrientation = meta?.orientation ?? frame.orientation;
    const detectMode = meta?.detectMode ?? '';
    const rawHands = result.hands ?? [];
    if (rawHands.length === 0) {
      return {
        hands: [],
        timestamp,
        handReady,
        poseReady,
        pluginReturnedNull: false,
        nativeHandCount,
        frameOrientation,
        detectMode,
      };
    }
    const mapped = mapIosResult({ hands: rawHands }, timestamp);
    return {
      ...mapped,
      handReady,
      poseReady,
      pluginReturnedNull: false,
      nativeHandCount,
      frameOrientation,
      detectMode,
    };
  } catch {
    return { hands: [], timestamp, ...emptyMeta, pluginReturnedNull: false };
  }
}
