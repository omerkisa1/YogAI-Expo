import type { Frame } from 'react-native-vision-camera';

import type { HandDetectionPayload } from './useHandLandmarker';

export declare const HAND_LANDMARKER_SUPPORTED: boolean;

export declare function detectHandsInFrame(frame: Frame): HandDetectionPayload;
