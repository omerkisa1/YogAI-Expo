import { useEffect, useMemo, useRef } from 'react';
import {
  runAsync,
  runAtTargetFps,
  useFrameProcessor,
  type CameraPosition,
} from 'react-native-vision-camera';
import { useFaceDetector, type Face } from 'react-native-vision-camera-face-detector';
import { useRunOnJS } from 'react-native-worklets-core';

import { detectHandsInFrame } from './mediapipeHands';
import {
  faceLandmarkerDetectionCallback,
  getFaceDetectionOptions,
  type FaceFrameMeta,
} from './useFaceLandmarker';
import { handLandmarkerDetectionCallback } from './useHandLandmarker';

const FACE_VISION_FPS = 12;
const HAND_VISION_FPS = 10;

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

  const onFacesDetected = useRunOnJS((faces: Face[], meta: FaceFrameMeta) => {
    if (!activeRef.current) return;
    faceLandmarkerDetectionCallback(faces, meta);
  }, []);

  const onHandsDetected = useRunOnJS(
    (
      hands: ReturnType<typeof detectHandsInFrame>['hands'],
      timestamp: number,
      frameWidth: number,
      frameHeight: number,
      handReady: boolean,
      poseReady: boolean,
      pluginReturnedNull: boolean,
      nativeHandCount: number,
      frameOrientation: string,
      detectMode: string,
    ) => {
      if (!activeRef.current || !enableHandsRef.current) return;
      handLandmarkerDetectionCallback({
        hands,
        timestamp,
        frameWidth,
        frameHeight,
        handReady,
        poseReady,
        pluginReturnedNull,
        nativeHandCount,
        frameOrientation,
        detectMode,
      });
    },
    [],
  );

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      runAtTargetFps(FACE_VISION_FPS, () => {
        'worklet';
        runAsync(frame, () => {
          'worklet';
          const faces = detectFaces(frame);
          onFacesDetected(faces, {
            timestamp: frame.timestamp,
            width: frame.width,
            height: frame.height,
          });
        });
      });

      runAtTargetFps(HAND_VISION_FPS, () => {
        'worklet';
        if (!enableHandsRef.current) return;
        const handsFrame = detectHandsInFrame(frame);
        onHandsDetected(
          handsFrame.hands,
          handsFrame.timestamp,
          frame.width,
          frame.height,
          handsFrame.handReady,
          handsFrame.poseReady,
          handsFrame.pluginReturnedNull,
          handsFrame.nativeHandCount ?? 0,
          handsFrame.frameOrientation ?? frame.orientation,
          handsFrame.detectMode ?? '',
        );
      });
    },
    [detectFaces, onFacesDetected, onHandsDetected],
  );

  return { frameProcessor };
}
