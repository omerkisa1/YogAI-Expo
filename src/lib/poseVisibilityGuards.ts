import type { LandmarkPoint } from '@/lib/poseAnalyzer';

/** Kalça/diz ile "tam vücut kadraj" uyarısı için eşik (plan ile uyumlu). */
export const FULL_BODY_VISIBILITY_THRESHOLD = 0.5;

const FULL_BODY_INDICES = [23, 24, 25, 26] as const;

/**
 * Kalça (23–24) veya diz (25–26) görünürlüğü düşükse true.
 * Eksik landmark → uyar (henüz tespit edilmedi veya güven düşük).
 */
export function shouldWarnFullBodyLandmarks(landmarks: LandmarkPoint[]): boolean {
  if (landmarks.length === 0) return false;
  for (const idx of FULL_BODY_INDICES) {
    const p = landmarks.find(l => l.index === idx);
    if (!p || p.visibility < FULL_BODY_VISIBILITY_THRESHOLD) return true;
  }
  return false;
}
