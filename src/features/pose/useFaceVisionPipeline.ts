import { useEffect, useMemo, useRef } from 'react';
import {
  runAsync,
  runAtTargetFps,
  useFrameProcessor,
  type CameraPosition,
} from 'react-native-vision-camera';
import { useFaceDetector, type Face } from 'react-native-vision-camera-face-detector';
import { useRunOnJS } from 'react-native-worklets-core';

import { faceLandmarkerDetectionCallback, getFaceDetectionOptions } from './useFaceLandmarker';

const FACE_ML_FPS = 15;

export type UseFaceVisionPipelineOptions = {
  active: boolean;
  cameraFacing: CameraPosition;
};

export function useFaceVisionPipeline({ active, cameraFacing }: UseFaceVisionPipelineOptions) {
  const activeRef = useRef(active);
  activeRef.current = active;

  const faceDetectionOptions = useMemo(
    () => getFaceDetectionOptions(cameraFacing),
    [cameraFacing],
  );
  const { detectFaces, stopListeners } = useFaceDetector(faceDetectionOptions);

  useEffect(() => () => stopListeners(), []);

  const onFacesDetected = useRunOnJS(
    (faces: Face[], timestamp: number, width: number, height: number) => {
      if (!activeRef.current) return;
      faceLandmarkerDetectionCallback(faces, { timestamp, width, height });
    },
    [],
  );

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      runAtTargetFps(FACE_ML_FPS, () => {
        'worklet';
        runAsync(frame, () => {
          'worklet';
          const faces = detectFaces(frame);
          onFacesDetected(faces, frame.timestamp, frame.width, frame.height);
        });
      });
    },
    [detectFaces, onFacesDetected],
  );

  return { frameProcessor };
}
