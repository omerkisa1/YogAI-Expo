import { Platform } from 'react-native';
import { VisionCameraProxy, type Frame } from 'react-native-vision-camera';
import type { HandDetectionResult } from 'expo-vision-camera-v4-mediapipe';

import type { HandData, HandFrame } from './useHandLandmarker';

export const HAND_LANDMARKER_SUPPORTED = Platform.OS === 'android' || Platform.OS === 'ios';

type PosePluginHand = {
  landmarks: { x: number; y: number; z: number }[];
  handedness: 'Left' | 'Right' | '';
};

type PosePluginResult = {
  pose?: unknown[];
  hands?: PosePluginHand[];
};

const posePlugin = VisionCameraProxy.initFrameProcessorPlugin('poseLandmarker', {});

function mirrorHandedness(cat: string): 'Left' | 'Right' {
  return cat === 'Left' ? 'Right' : 'Left';
}

function mapAndroidResult(result: HandDetectionResult, timestamp: number): HandFrame {
  const hands: HandData[] = [];
  if (result.hands?.length) {
    for (let i = 0; i < result.hands.length; i++) {
      const lm = result.hands[i];
      const cat = result.handedness?.[i]?.[0]?.categoryName ?? 'Left';
      hands.push({
        landmarks: lm.map(p => ({ x: p.x, y: p.y, z: p.z ?? 0 })),
        handedness: mirrorHandedness(cat),
      });
    }
  }
  return { hands, timestamp };
}

function mapIosResult(result: PosePluginResult, timestamp: number): HandFrame {
  const hands: HandData[] = [];
  const raw = result.hands ?? [];
  for (const h of raw) {
    if (!h.landmarks?.length) continue;
    const cat = h.handedness || 'Left';
    hands.push({
      landmarks: h.landmarks.map(lm => ({
        x: lm.x,
        y: lm.y,
        z: lm.z ?? 0,
      })),
      handedness: mirrorHandedness(cat),
    });
  }
  return { hands, timestamp };
}

export function detectHandsInFrame(frame: Frame): HandFrame {
  const timestamp = typeof frame.timestamp === 'number' ? frame.timestamp : Date.now();

  if (Platform.OS === 'android') {
    try {
      const result = detectHandLandmarks(frame);
      return mapAndroidResult(result ?? { hands: [] }, timestamp);
    } catch {
      return { hands: [], timestamp };
    }
  }

  if (Platform.OS === 'ios' && posePlugin) {
    try {
      const result = posePlugin.call(frame) as PosePluginResult | undefined;
      if (!result) return { hands: [], timestamp };
      return mapIosResult(result, timestamp);
    } catch {
      return { hands: [], timestamp };
    }
  }

  return { hands: [], timestamp };
}
