import type { NormalizedPoint } from '@/lib/faceHandCoordinates';

export interface MotionState {
  positions: { x: number; y: number; time: number }[];
  cumulativeAngle: number;
  lastAngle: number | null;
  sweepStartX: number | null;
  sweepStartY: number | null;
  sweepMaxDist: number;
}

export function createMotionState(): MotionState {
  return {
    positions: [],
    cumulativeAngle: 0,
    lastAngle: null,
    sweepStartX: null,
    sweepStartY: null,
    sweepMaxDist: 0,
  };
}

export function resetMotionState(state: MotionState): void {
  state.positions = [];
  state.cumulativeAngle = 0;
  state.lastAngle = null;
  state.sweepStartX = null;
  state.sweepStartY = null;
  state.sweepMaxDist = 0;
}

const MAX_HISTORY = 30;
const CIRCULAR_WINDOW_MS = 2000;

export function trackPosition(state: MotionState, x: number, y: number): void {
  const now = Date.now();
  state.positions.push({ x, y, time: now });

  const cutoff = now - CIRCULAR_WINDOW_MS;
  while (state.positions.length > MAX_HISTORY && state.positions[0].time < cutoff) {
    state.positions.shift();
  }
  while (state.positions.length > MAX_HISTORY) {
    state.positions.shift();
  }
}

export function detectCircularMotion(
  state: MotionState,
  currentX: number,
  currentY: number,
  targetAngleDeg: number,
): { progress: number; isComplete: boolean } {
  if (state.positions.length < 3 || targetAngleDeg <= 0) {
    return { progress: 0, isComplete: false };
  }

  const cx = state.positions.reduce((s, p) => s + p.x, 0) / state.positions.length;
  const cy = state.positions.reduce((s, p) => s + p.y, 0) / state.positions.length;

  const angle = Math.atan2(currentY - cy, currentX - cx);

  if (state.lastAngle !== null) {
    let delta = angle - state.lastAngle;

    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;

    state.cumulativeAngle += Math.abs(delta);
  }

  state.lastAngle = angle;

  const targetRad = (targetAngleDeg * Math.PI) / 180;
  const progress = Math.min(state.cumulativeAngle / targetRad, 1);

  return {
    progress,
    isComplete: state.cumulativeAngle >= targetRad,
  };
}

export function detectSweepMotion(
  state: MotionState,
  currentX: number,
  currentY: number,
  targetDistance: number,
  direction: 'horizontal' | 'vertical' | 'any',
): { progress: number; isComplete: boolean } {
  if (targetDistance <= 0) {
    return { progress: 0, isComplete: false };
  }

  if (state.sweepStartX === null || state.sweepStartY === null) {
    state.sweepStartX = currentX;
    state.sweepStartY = currentY;
    state.sweepMaxDist = 0;
    return { progress: 0, isComplete: false };
  }

  let dist = 0;
  if (direction === 'horizontal') {
    dist = Math.abs(currentX - state.sweepStartX);
  } else if (direction === 'vertical') {
    dist = Math.abs(currentY - state.sweepStartY);
  } else {
    dist = Math.sqrt(
      (currentX - state.sweepStartX) ** 2 + (currentY - state.sweepStartY) ** 2,
    );
  }

  state.sweepMaxDist = Math.max(state.sweepMaxDist, dist);

  const progress = Math.min(dist / targetDistance, 1);

  return {
    progress,
    isComplete: dist >= targetDistance,
  };
}
