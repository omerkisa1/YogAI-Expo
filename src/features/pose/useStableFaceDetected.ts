import { useEffect, useRef, useState } from 'react';

const FACE_PRESENT_FRAMES = 2;
const FACE_LOST_FRAMES = 6;

export function useStableFaceDetected(
  rawFaceDetected: boolean,
  active: boolean,
  frameTick: number | undefined,
) {
  const [stableFaceDetected, setStableFaceDetected] = useState(false);
  const [showFaceLostBanner, setShowFaceLostBanner] = useState(false);
  const presentStreakRef = useRef(0);
  const lostStreakRef = useRef(0);
  const hadStableFaceRef = useRef(false);

  useEffect(() => {
    if (!active) {
      presentStreakRef.current = 0;
      lostStreakRef.current = 0;
      hadStableFaceRef.current = false;
      setStableFaceDetected(false);
      setShowFaceLostBanner(false);
      return;
    }

    if (frameTick == null) return;

    if (rawFaceDetected) {
      presentStreakRef.current += 1;
      lostStreakRef.current = 0;
      if (presentStreakRef.current >= FACE_PRESENT_FRAMES) {
        hadStableFaceRef.current = true;
        setStableFaceDetected(true);
        setShowFaceLostBanner(false);
      }
    } else {
      lostStreakRef.current += 1;
      presentStreakRef.current = 0;
      if (lostStreakRef.current >= FACE_LOST_FRAMES) {
        setStableFaceDetected(false);
        setShowFaceLostBanner(hadStableFaceRef.current);
      }
    }
  }, [rawFaceDetected, active, frameTick]);

  return { stableFaceDetected, showFaceLostBanner };
}
