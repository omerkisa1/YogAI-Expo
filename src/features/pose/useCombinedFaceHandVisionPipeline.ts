import { useEffect, useMemo, useRef } from 'react';
import {
  runAsync,
  runAtTargetFps,
  useFrameProcessor,
  type CameraPosition,
  type Frame,
} from 'react-native-vision-camera';
import { useFaceDetector, type Face } from 'react-native-vision-camera-face-detector';
import { useRunOnJS } from 'react-native-worklets-core';

import { detectHandsInFrame } from './mediapipeHands';
import { faceLandmarkerDetectionCallback, getFaceDetectionOptions } from './useFaceLandmarker';
import { handLandmarkerDetectionCallback } from './useHandLandmarker';

const VISION_FPS = 15;

export type UseCombinedFaceHandVisionPipelineOptions = {
  active: boolean;
  enableHands: boolean;
  cameraFacing: CameraPosition;
};

export function useCombinedFaceHandVisionPipeline({
  active,
  enableHands,
  cameraFacing,
}: UseCombinedFaceHandVisionPipelineOptions) {
  const activeRef = useRef(active);
  const enableHandsRef = useRef(enableHands);
  activeRef.current = active;
  enableHandsRef.current = enableHands;

  const faceDetectionOptions = useMemo(
    () => getFaceDetectionOptions(cameraFacing),
    [cameraFacing],
  );
  const { detectFaces, stopListeners } = useFaceDetector(faceDetectionOptions);

  useEffect(() => () => stopListeners(), [stopListeners]);

  const onFacesDetected = useRunOnJS((faces: Face[], timestamp: number) => {
    if (!activeRef.current) return;
    faceLandmarkerDetectionCallback(faces, { timestamp } as Frame);
  }, []);

  const onHandsDetected = useRunOnJS((handsFrame: ReturnType<typeof detectHandsInFrame>) => {
    if (!activeRef.current || !enableHandsRef.current) return;
    handLandmarkerDetectionCallback(handsFrame);
  }, []);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      runAtTargetFps(VISION_FPS, () => {
        'worklet';
        runAsync(frame, () => {
          'worklet';
          const faces = detectFaces(frame);
          onFacesDetected(faces, frame.timestamp);
          if (enableHandsRef.current) {
            const handsFrame = detectHandsInFrame(frame);
            onHandsDetected(handsFrame);
          }
        });
      });
    },
    [detectFaces, onFacesDetected, onHandsDetected],
  );

  return { frameProcessor };
}
