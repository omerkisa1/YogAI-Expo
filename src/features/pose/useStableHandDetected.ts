import { useEffect, useRef, useState } from 'react';

interface HandStabilityState {
  stableDetected: boolean;
  lastValidLandmarks: { x: number; y: number; z: number }[] | null;
  lastValidTime: number;
  consecutiveLost: number;
  consecutiveFound: number;
}

interface UseStableHandProps {
  rawHands: { landmarks: { x: number; y: number; z: number }[] }[] | undefined;
  isActive: boolean;
  frameTick?: number;
  appearFrames?: number;
  disappearFrames?: number;
  maxGhostMs?: number;
}

export function useStableHandDetected({
  rawHands,
  isActive,
  frameTick,
  appearFrames = 1,
  disappearFrames = 8,
  maxGhostMs = 600,
}: UseStableHandProps) {
  const stateRef = useRef<HandStabilityState>({
    stableDetected: false,
    lastValidLandmarks: null,
    lastValidTime: 0,
    consecutiveLost: 0,
    consecutiveFound: 0,
  });

  const [stableHand, setStableHand] = useState<{
    detected: boolean;
    landmarks: { x: number; y: number; z: number }[] | null;
    isGhost: boolean;
  }>({ detected: false, landmarks: null, isGhost: false });

  useEffect(() => {
    if (!isActive) {
      stateRef.current = {
        stableDetected: false,
        lastValidLandmarks: null,
        lastValidTime: 0,
        consecutiveLost: 0,
        consecutiveFound: 0,
      };
      setStableHand({ detected: false, landmarks: null, isGhost: false });
      return;
    }

    if (frameTick == null && rawHands === undefined) return;

    const s = stateRef.current;
    const hasHand =
      rawHands && rawHands.length > 0 && (rawHands[0].landmarks?.length ?? 0) >= 21;

    if (hasHand) {
      s.consecutiveFound++;
      s.consecutiveLost = 0;
      s.lastValidLandmarks = rawHands![0].landmarks;
      s.lastValidTime = Date.now();

      if (!s.stableDetected && s.consecutiveFound >= appearFrames) {
        s.stableDetected = true;
      }

      setStableHand({
        detected: true,
        landmarks: rawHands![0].landmarks,
        isGhost: false,
      });
    } else {
      s.consecutiveFound = 0;
      s.consecutiveLost++;

      const timeSinceLast = Date.now() - s.lastValidTime;
      const withinGhostWindow = timeSinceLast < maxGhostMs;

      if (s.stableDetected && s.consecutiveLost < disappearFrames && withinGhostWindow) {
        setStableHand({
          detected: true,
          landmarks: s.lastValidLandmarks,
          isGhost: true,
        });
      } else {
        if (s.stableDetected && s.consecutiveLost >= disappearFrames) {
          s.stableDetected = false;
        }
        setStableHand({ detected: false, landmarks: null, isGhost: false });
      }
    }
  }, [rawHands, isActive, frameTick, appearFrames, disappearFrames, maxGhostMs]);

  return stableHand;
}
