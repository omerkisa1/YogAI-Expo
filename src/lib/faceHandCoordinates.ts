export interface NormalizedPoint {
  x: number;
  y: number;
  z: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedFaceBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function normalizeHandLandmarks(
  landmarks: { x: number; y: number; z: number }[],
  frameWidth: number,
  frameHeight: number,
  isPortrait: boolean,
  isMirrored: boolean,
): NormalizedPoint[] {
  const fw = Math.max(frameWidth, 1);
  const fh = Math.max(frameHeight, 1);

  return landmarks.map(l => {
    let nx = l.x;
    let ny = l.y;

    if (nx > 1 || ny > 1 || nx < 0 || ny < 0) {
      nx = nx / fw;
      ny = ny / fh;
    }

    if (isPortrait && fw > fh) {
      const temp = nx;
      nx = ny;
      ny = 1 - temp;
    }

    if (isMirrored) {
      nx = 1 - nx;
    }

    return { x: clamp01(nx), y: clamp01(ny), z: l.z ?? 0 };
  });
}

export function getFaceBBoxNormalized(
  faceBBox: BoundingBox,
  frameWidth: number,
  frameHeight: number,
  isPortrait = true,
  isMirrored = false,
): NormalizedFaceBox {
  const corners = normalizeHandLandmarks(
    [
      { x: faceBBox.x, y: faceBBox.y, z: 0 },
      { x: faceBBox.x + faceBBox.width, y: faceBBox.y, z: 0 },
      { x: faceBBox.x + faceBBox.width, y: faceBBox.y + faceBBox.height, z: 0 },
      { x: faceBBox.x, y: faceBBox.y + faceBBox.height, z: 0 },
    ],
    frameWidth,
    frameHeight,
    isPortrait,
    isMirrored,
  );
  const xs = corners.map(p => p.x);
  const ys = corners.map(p => p.y);
  return {
    minX: clamp01(Math.min(...xs)),
    maxX: clamp01(Math.max(...xs)),
    minY: clamp01(Math.min(...ys)),
    maxY: clamp01(Math.max(...ys)),
  };
}

export function isHandOverlappingFace(
  handLandmarks: NormalizedPoint[],
  faceBox: NormalizedFaceBox,
  margin = 0.05,
): { overlapping: boolean; overlapScore: number } {
  const FINGERTIPS = [4, 8, 12, 16, 20];
  const PALM = 0;
  const checkPoints = [...FINGERTIPS, PALM];
  let insideCount = 0;

  for (const idx of checkPoints) {
    const p = handLandmarks[idx];
    if (!p) continue;
    if (
      p.x >= faceBox.minX - margin &&
      p.x <= faceBox.maxX + margin &&
      p.y >= faceBox.minY - margin &&
      p.y <= faceBox.maxY + margin
    ) {
      insideCount++;
    }
  }

  const score = insideCount / checkPoints.length;
  return { overlapping: score >= 0.2, overlapScore: score };
}

export function distance2D(a: NormalizedPoint, b: NormalizedPoint): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function isPointInsideFaceBox(
  point: NormalizedPoint,
  faceBox: NormalizedFaceBox,
  margin = 0.08,
): boolean {
  return (
    point.x >= faceBox.minX - margin &&
    point.x <= faceBox.maxX + margin &&
    point.y >= faceBox.minY - margin &&
    point.y <= faceBox.maxY + margin
  );
}

export type SweepAxis = 'horizontal' | 'vertical' | 'any';

export function getSweepDisplacement(
  current: NormalizedPoint,
  start: NormalizedPoint,
  direction: SweepAxis,
): number {
  if (direction === 'horizontal') return Math.abs(current.x - start.x);
  if (direction === 'vertical') return Math.abs(current.y - start.y);
  return distance2D(current, start);
}

const SWEEP_TRACK_INDICES = [4, 8, 12, 16, 20, 0];

export function getMaxHandSweepDisplacement(
  handLandmarks: NormalizedPoint[],
  start: NormalizedPoint,
  direction: SweepAxis,
): number {
  let max = 0;
  for (const idx of SWEEP_TRACK_INDICES) {
    const p = handLandmarks[idx];
    if (!p) continue;
    max = Math.max(max, getSweepDisplacement(p, start, direction));
  }
  return max;
}

export function getFaceWidthFromBox(faceBox: NormalizedFaceBox): number {
  return Math.max(faceBox.maxX - faceBox.minX, 0.05);
}

export function getRegionCenterOnFace(
  faceBox: NormalizedFaceBox,
  region: FaceHandRegion,
): NormalizedPoint {
  const w = faceBox.maxX - faceBox.minX;
  const h = faceBox.maxY - faceBox.minY;
  const cx = (faceBox.minX + faceBox.maxX) / 2;
  switch (region) {
    case 'forehead':
      return { x: cx, y: faceBox.minY + h * 0.15, z: 0 };
    case 'cheek':
      return { x: faceBox.minX + w * 0.32, y: faceBox.minY + h * 0.58, z: 0 };
    case 'chin':
      return { x: cx, y: faceBox.minY + h * 0.86, z: 0 };
    case 'temple':
      return { x: faceBox.maxX - w * 0.18, y: faceBox.minY + h * 0.38, z: 0 };
    case 'eye':
      return { x: cx, y: faceBox.minY + h * 0.42, z: 0 };
    case 'any':
      return { x: cx, y: faceBox.minY + h * 0.5, z: 0 };
    default:
      return { x: cx, y: faceBox.minY + h * 0.5, z: 0 };
  }
}

const TRACK_INDICES = [4, 8, 12, 16, 20, 0];

export function getClosestHandPointToRegion(
  handLandmarks: NormalizedPoint[],
  faceBox: NormalizedFaceBox,
  region: FaceHandRegion,
): { point: NormalizedPoint; distance: number; landmarkIndex: number } | null {
  const center = getRegionCenterOnFace(faceBox, region);
  let best: NormalizedPoint | null = null;
  let bestIdx = 8;
  let minDist = Infinity;
  for (const idx of TRACK_INDICES) {
    const p = handLandmarks[idx];
    if (!p) continue;
    const d = distance2D(p, center);
    if (d < minDist) {
      minDist = d;
      best = p;
      bestIdx = idx;
    }
  }
  if (!best) return null;
  return { point: best, distance: minDist, landmarkIndex: bestIdx };
}

export function handNearRegion(
  handLandmarks: NormalizedPoint[],
  faceBox: NormalizedFaceBox,
  region: FaceHandRegion,
  proximityRatio = 0.35,
): boolean {
  if (region === 'any') return true;
  const closest = getClosestHandPointToRegion(handLandmarks, faceBox, region);
  if (!closest) return false;
  return closest.distance < getFaceWidthFromBox(faceBox) * proximityRatio;
}

export type FaceHandRegion = 'forehead' | 'cheek' | 'chin' | 'temple' | 'eye' | 'any' | 'none';

export function getHandRegionOnFace(
  handCenter: NormalizedPoint,
  faceBox: NormalizedFaceBox,
): FaceHandRegion {
  if (
    handCenter.x < faceBox.minX - 0.05 ||
    handCenter.x > faceBox.maxX + 0.05 ||
    handCenter.y < faceBox.minY - 0.05 ||
    handCenter.y > faceBox.maxY + 0.05
  ) {
    return 'none';
  }

  const faceHeight = Math.max(faceBox.maxY - faceBox.minY, 0.01);
  const faceWidth = Math.max(faceBox.maxX - faceBox.minX, 0.01);
  const relY = (handCenter.y - faceBox.minY) / faceHeight;
  const relX = (handCenter.x - faceBox.minX) / faceWidth;

  if (relY < 0.3) return 'forehead';
  if (relY > 0.72) return 'chin';
  if (relX < 0.22 || relX > 0.78) return 'temple';
  if (relY >= 0.3 && relY < 0.5) return 'eye';
  return 'cheek';
}

export function getHandCenter(landmarks: NormalizedPoint[]): NormalizedPoint {
  if (landmarks.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = landmarks.reduce(
    (acc, l) => ({ x: acc.x + l.x, y: acc.y + l.y, z: acc.z + l.z }),
    { x: 0, y: 0, z: 0 },
  );
  return {
    x: sum.x / landmarks.length,
    y: sum.y / landmarks.length,
    z: sum.z / landmarks.length,
  };
}

function fingerExtended(landmarks: NormalizedPoint[], tip: number, pip: number): boolean {
  const wrist = landmarks[0];
  const tipLm = landmarks[tip];
  const pipLm = landmarks[pip];
  if (!wrist || !tipLm || !pipLm) return false;
  return distance2D(tipLm, wrist) > distance2D(pipLm, wrist) * 1.05;
}

export function isHandOpen(landmarks: NormalizedPoint[]): boolean {
  let extended = 0;
  if (fingerExtended(landmarks, 8, 6)) extended++;
  if (fingerExtended(landmarks, 12, 10)) extended++;
  if (fingerExtended(landmarks, 16, 14)) extended++;
  if (fingerExtended(landmarks, 20, 18)) extended++;
  return extended >= 2;
}

export function isHandFist(landmarks: NormalizedPoint[]): boolean {
  let extended = 0;
  if (fingerExtended(landmarks, 8, 6)) extended++;
  if (fingerExtended(landmarks, 12, 10)) extended++;
  if (fingerExtended(landmarks, 16, 14)) extended++;
  if (fingerExtended(landmarks, 20, 18)) extended++;
  return extended <= 1;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
