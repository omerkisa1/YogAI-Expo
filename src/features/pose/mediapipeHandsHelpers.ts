import type { HandDetectionResult } from 'expo-vision-camera-v4-mediapipe';

import type { HandData, HandDetectionPayload } from './useHandLandmarker';

export type PosePluginHand = {
  landmarks: { x: number; y: number; z: number }[];
  handedness: 'Left' | 'Right' | '';
};

export type PosePluginResult = {
  pose?: unknown[];
  hands?: PosePluginHand[];
};

export function mirrorHandedness(cat: string): 'Left' | 'Right' {
  'worklet';
  return cat === 'Left' ? 'Right' : 'Left';
}

export function mapAndroidResult(result: HandDetectionResult, timestamp: number): HandDetectionPayload {
  'worklet';
  const hands: HandData[] = [];
  if (result.hands?.length) {
    for (let i = 0; i < result.hands.length; i++) {
      const lm = result.hands[i];
      const cat = result.handedness?.[i]?.[0]?.categoryName ?? 'Left';
      const mapped: { x: number; y: number; z: number }[] = [];
      for (let j = 0; j < lm.length; j++) {
        const p = lm[j];
        mapped.push({ x: p.x, y: p.y, z: p.z ?? 0 });
      }
      hands.push({
        landmarks: mapped,
        handedness: mirrorHandedness(cat),
      });
    }
  }
  return { hands, timestamp };
}

export function mapIosResult(result: PosePluginResult, timestamp: number): HandDetectionPayload {
  'worklet';
  const hands: HandData[] = [];
  const raw = result.hands ?? [];
  for (let i = 0; i < raw.length; i++) {
    const h = raw[i];
    if (!h.landmarks?.length) continue;
    const cat = h.handedness || 'Left';
    const mapped: { x: number; y: number; z: number }[] = [];
    for (let j = 0; j < h.landmarks.length; j++) {
      const lm = h.landmarks[j];
      mapped.push({ x: lm.x, y: lm.y, z: lm.z ?? 0 });
    }
    hands.push({
      landmarks: mapped,
      handedness: mirrorHandedness(cat),
    });
  }
  return { hands, timestamp };
}
