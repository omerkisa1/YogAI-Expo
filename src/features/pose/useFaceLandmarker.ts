import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Frame } from 'react-native-vision-camera';
import type { CameraPosition } from 'react-native-vision-camera';
import type { Face, FrameFaceDetectionOptions } from 'react-native-vision-camera-face-detector';

type FaceDetectionCallback = (faces: Face[], frame: Frame) => void;

type Point = { x: number; y: number };

let activeFaceCallback: FaceDetectionCallback | null = null;

export const faceLandmarkerDetectionCallback: FaceDetectionCallback = (faces, frame) => {
  activeFaceCallback?.(faces, frame);
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

export interface FaceFrame {
  blendshapes: Map<string, number>;
  timestamp: number;
  faceDetected: boolean;
}

export interface UseFaceLandmarkerReturn {
  isLoading: boolean;
  error: string | null;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  currentFrame: FaceFrame | null;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const averagePoint = (points: Point[]) => {
  const total = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  const count = points.length || 1;
  return { x: total.x / count, y: total.y / count };
};

const boundsFromPoints = (points: Point[]) => {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  points.forEach(p => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });
  return { minX, minY, maxX, maxY };
};

const eyeOpenRatio = (points?: Point[]) => {
  if (!points || points.length === 0) return null;
  const { minX, maxX, minY, maxY } = boundsFromPoints(points);
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0) return null;
  return clamp01(height / (width * 0.35));
};

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

  const isLoading = useMemo(() => isRunning && currentFrame == null, [isRunning, currentFrame]);

  const handleFacesDetected = useCallback(
    (faces: Face[], frame: Frame) => {
      if (!isRunning) return;
      const timestamp = typeof frame?.timestamp === 'number' ? frame.timestamp : Date.now();
      if (!faces || faces.length === 0) {
        setCurrentFrame({ blendshapes: new Map(), timestamp, faceDetected: false });
        return;
      }
      try {
        const face = primaryFace(faces);
        if (!face) {
          setCurrentFrame({ blendshapes: new Map(), timestamp, faceDetected: false });
          return;
        }

        const boundsW = Math.max(face.bounds.width, 1);
        const boundsH = Math.max(face.bounds.height, 1);
        const contours = face.contours;
        const landmarks = face.landmarks;

        const mouthLeft = landmarks?.MOUTH_LEFT ?? null;
        const mouthRight = landmarks?.MOUTH_RIGHT ?? null;
        const mouthWidthNorm =
          mouthLeft && mouthRight ? clamp01(distance(mouthLeft, mouthRight) / boundsW) : 0;

        const upperLip = contours?.UPPER_LIP_BOTTOM?.length
          ? averagePoint(contours.UPPER_LIP_BOTTOM)
          : null;
        const lowerLip = contours?.LOWER_LIP_TOP?.length
          ? averagePoint(contours.LOWER_LIP_TOP)
          : null;
        const jawOpenRaw =
          upperLip && lowerLip ? distance(upperLip, lowerLip) / boundsH : 0;

        const leftBrow = contours?.LEFT_EYEBROW_TOP?.length
          ? averagePoint(contours.LEFT_EYEBROW_TOP)
          : null;
        const rightBrow = contours?.RIGHT_EYEBROW_TOP?.length
          ? averagePoint(contours.RIGHT_EYEBROW_TOP)
          : null;
        const leftEye = contours?.LEFT_EYE?.length ? averagePoint(contours.LEFT_EYE) : null;
        const rightEye = contours?.RIGHT_EYE?.length ? averagePoint(contours.RIGHT_EYE) : null;
        const browRaiseLeftRaw = leftBrow && leftEye ? distance(leftBrow, leftEye) / boundsH : 0;
        const browRaiseRightRaw = rightBrow && rightEye ? distance(rightBrow, rightEye) / boundsH : 0;

        const leftEyeOpenProb = typeof face.leftEyeOpenProbability === 'number'
          ? clamp01(face.leftEyeOpenProbability)
          : null;
        const rightEyeOpenProb = typeof face.rightEyeOpenProbability === 'number'
          ? clamp01(face.rightEyeOpenProbability)
          : null;
        const leftEyeOpen = leftEyeOpenProb ?? eyeOpenRatio(contours?.LEFT_EYE) ?? 0;
        const rightEyeOpen = rightEyeOpenProb ?? eyeOpenRatio(contours?.RIGHT_EYE) ?? 0;

        const smilingProb = typeof face.smilingProbability === 'number'
          ? clamp01(face.smilingProbability)
          : null;
        const mouthSmile = smilingProb ?? clamp01(mouthWidthNorm / 0.5);

        const browRaiseLeft = clamp01(browRaiseLeftRaw / 0.15);
        const browRaiseRight = clamp01(browRaiseRightRaw / 0.15);
        const eyeSquintLeft = clamp01(1 - leftEyeOpen);
        const eyeSquintRight = clamp01(1 - rightEyeOpen);
        const browInnerUp = clamp01((browRaiseLeftRaw + browRaiseRightRaw) / 0.3);

        const blendshapes = new Map<string, number>([
          ['jawOpen', clamp01(jawOpenRaw / 0.2)],
          ['mouthSmileLeft', mouthSmile],
          ['mouthSmileRight', mouthSmile],
          ['browRaiseLeft', browRaiseLeft],
          ['browRaiseRight', browRaiseRight],
          ['browInnerUp', browInnerUp],
          ['browOuterUpLeft', browRaiseLeft],
          ['browOuterUpRight', browRaiseRight],
          ['eyeSquintLeft', eyeSquintLeft],
          ['eyeSquintRight', eyeSquintRight],
          ['eyeBlinkLeft', eyeSquintLeft],
          ['eyeBlinkRight', eyeSquintRight],
        ]);

        setCurrentFrame({ blendshapes, timestamp, faceDetected: true });
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
