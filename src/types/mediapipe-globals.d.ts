import type { Frame } from 'react-native-vision-camera';
import type { HandDetectionResult } from 'expo-vision-camera-v4-mediapipe';

declare global {
  function detectHandLandmarks(frame: Frame): HandDetectionResult;
}

export {};
