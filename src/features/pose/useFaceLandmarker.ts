import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CameraPosition } from 'react-native-vision-camera';
import type { Face, FrameFaceDetectionOptions } from 'react-native-vision-camera-face-detector';

import {
  mapMLKitToBlendshapes,
  buildFaceLandmarksFromMlKit,
  type FaceLandmark,
} from '@/lib/faceMeshMapper';

export type FaceFrameMeta = {
  timestamp: number;
  width: number;
  height: number;
};

type FaceDetectionCallback = (faces: Face[], meta: FaceFrameMeta) => void;

let activeFaceCallback: FaceDetectionCallback | null = null;

export const faceLandmarkerDetectionCallback = (faces: Face[], meta: FaceFrameMeta) => {
  activeFaceCallback?.(faces, meta);
};

export const getFaceDetectionOptions = (cameraFacing: CameraPosition): FrameFaceDetectionOptions => ({
  performanceMode: 'fast',
  landmarkMode: 'all',
  contourMode: 'all',
  classificationMode: 'all',
  trackingEnabled: false,
  minFaceSize: 0.15,
  cameraFacing,
});

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceFrame {
  blendshapes: Map<string, number>;
  faceLandmarks?: FaceLandmark[];
  faceBoundingBox: FaceBoundingBox | null;
  frameWidth: number;
  frameHeight: number;
  timestamp: number;
  faceDetected: boolean;
  fps?: number;
}

export interface UseFaceLandmarkerReturn {
  isLoading: boolean;
  error: string | null;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  currentFrame: FaceFrame | null;
}

const primaryFace = (faces: Face[]) => {
  if (faces.length === 0) return null;
  return faces.reduce((best, face) => {
    const bestArea = best.bounds.width * best.bounds.height;
    const area = face.bounds.width * face.bounds.height;
    return area > bestArea ? face : best;
  }, faces[0]);
};

export function useFaceLandmarker(): UseFaceLandmarkerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<FaceFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastTsRef = useRef(0);
  const fpsRef = useRef(0);

  const isLoading = useMemo(() => isRunning && currentFrame == null, [isRunning, currentFrame]);

  const handleFacesDetected = useCallback(
    (faces: Face[], meta: FaceFrameMeta) => {
      if (!isRunning) return;
      const timestamp = meta.timestamp;
      if (lastTsRef.current > 0) {
        const dt = (timestamp - lastTsRef.current) / 1_000_000_000;
        if (dt > 0) fpsRef.current = 1 / dt;
      }
      lastTsRef.current = timestamp;

      const frameWidth = Math.max(meta.width, 1);
      const frameHeight = Math.max(meta.height, 1);

      if (!faces || faces.length === 0) {
        setCurrentFrame({
          blendshapes: new Map(),
          faceBoundingBox: null,
          frameWidth,
          frameHeight,
          timestamp,
          faceDetected: false,
          fps: fpsRef.current,
        });
        return;
      }
      try {
        const face = primaryFace(faces);
        if (!face) {
          setCurrentFrame({
            blendshapes: new Map(),
            faceBoundingBox: null,
            frameWidth,
            frameHeight,
            timestamp,
            faceDetected: false,
            fps: fpsRef.current,
          });
          return;
        }

        const bounds = face.bounds;
        setCurrentFrame({
          blendshapes: mapMLKitToBlendshapes(face),
          faceLandmarks: buildFaceLandmarksFromMlKit(face),
          faceBoundingBox: bounds
            ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
            : null,
          frameWidth,
          frameHeight,
          timestamp,
          faceDetected: true,
          fps: fpsRef.current,
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Face detection failed');
      }
    },
    [isRunning],
  );

  useEffect(() => {
    if (isRunning) {
      activeFaceCallback = handleFacesDetected;
      return () => {
        if (activeFaceCallback === handleFacesDetected) {
          activeFaceCallback = null;
        }
      };
    }
    if (activeFaceCallback === handleFacesDetected) {
      activeFaceCallback = null;
    }
    return undefined;
  }, [handleFacesDetected, isRunning]);

  const start = useCallback(() => {
    setError(null);
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    setCurrentFrame(null);
  }, []);

  return useMemo(
    () => ({
      isLoading,
      error,
      isRunning,
      start,
      stop,
      currentFrame,
    }),
    [isLoading, error, isRunning, start, stop, currentFrame],
  );
}
