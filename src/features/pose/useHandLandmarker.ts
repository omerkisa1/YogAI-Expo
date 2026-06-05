import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { HAND_LANDMARKER_SUPPORTED } from './mediapipeHands';

export interface HandData {
  landmarks: { x: number; y: number; z: number }[];
  handedness: 'Left' | 'Right';
}

export interface HandDetectionPayload {
  hands: HandData[];
  timestamp: number;
}

export interface HandFrame extends HandDetectionPayload {
  frameWidth: number;
  frameHeight: number;
  handReady?: boolean;
  poseReady?: boolean;
  pluginReturnedNull?: boolean;
  nativeHandCount?: number;
  frameOrientation?: string;
  detectMode?: string;
}

export interface UseHandLandmarkerReturn {
  isLoading: boolean;
  error: string | null;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  currentFrame: HandFrame | null;
}

export { HAND_LANDMARKER_SUPPORTED };

const HAND_FRAME_MIN_MS = 80;

let activeHandCallback: ((frame: HandFrame) => void) | null = null;

function handFrameSignature(frame: HandFrame): string {
  const hand = frame.hands[0];
  if (!hand?.landmarks?.length) {
    return `empty:${frame.nativeHandCount ?? 0}:${frame.detectMode ?? ''}`;
  }
  const tip = hand.landmarks[8];
  return `${hand.landmarks.length}:${tip?.x?.toFixed(3) ?? ''}:${tip?.y?.toFixed(3) ?? ''}:${frame.detectMode ?? ''}`;
}

export const handLandmarkerDetectionCallback = (frame: HandFrame) => {
  activeHandCallback?.(frame);
};

export function useHandLandmarker(): UseHandLandmarkerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<HandFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastEmitRef = useRef({ ms: 0, signature: '' });

  const isLoading = useMemo(() => isRunning && currentFrame == null, [isRunning, currentFrame]);

  const handleHandFrame = useCallback(
    (frame: HandFrame) => {
      if (!isRunning) return;
      const now = Date.now();
      const signature = handFrameSignature(frame);
      const last = lastEmitRef.current;
      if (signature === last.signature && now - last.ms < HAND_FRAME_MIN_MS) return;
      lastEmitRef.current = { ms: now, signature };
      setCurrentFrame(frame);
    },
    [isRunning],
  );

  useEffect(() => {
    if (!isRunning) {
      activeHandCallback = null;
      return;
    }
    activeHandCallback = handleHandFrame;
    return () => {
      if (activeHandCallback === handleHandFrame) {
        activeHandCallback = null;
      }
    };
  }, [handleHandFrame, isRunning]);

  const start = useCallback(() => {
    if (!HAND_LANDMARKER_SUPPORTED) {
      setError('Hand detection is not available on this device');
      setIsRunning(false);
      return;
    }
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
