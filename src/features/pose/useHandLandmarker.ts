import { useCallback, useMemo, useState } from 'react';

export interface HandData {
  landmarks: { x: number; y: number; z: number }[];
  handedness: 'Left' | 'Right';
}

export interface HandFrame {
  hands: HandData[];
  timestamp: number;
}

export interface UseHandLandmarkerReturn {
  isLoading: boolean;
  error: string | null;
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  currentFrame: HandFrame | null;
}

export const HAND_LANDMARKER_SUPPORTED = false;

export function useHandLandmarker(): UseHandLandmarkerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [currentFrame] = useState<HandFrame | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLoading = useMemo(() => false, []);

  const start = useCallback(() => {
    if (!HAND_LANDMARKER_SUPPORTED) {
      setError('Hand detection is not available');
      setIsRunning(false);
      return;
    }
    setError(null);
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
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
