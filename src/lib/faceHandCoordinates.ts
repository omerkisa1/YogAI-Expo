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
): NormalizedFaceBox {
  const fw = Math.max(frameWidth, 1);
  const fh = Math.max(frameHeight, 1);
  const minX = faceBBox.x / fw;
  const maxX = (faceBBox.x + faceBBox.width) / fw;
  const minY = faceBBox.y / fh;
  const maxY = (faceBBox.y + faceBBox.height) / fh;
  return {
    minX: clamp01(minX),
    maxX: clamp01(maxX),
    minY: clamp01(minY),
    maxY: clamp01(maxY),
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
  return { overlapping: score > 0.3, overlapScore: score };
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

export function isHandOpen(landmarks: NormalizedPoint[]): boolean {
  const tipMcp: [number, number][] = [
    [8, 5],
    [12, 9],
    [16, 13],
    [20, 17],
  ];
  let extended = 0;
  for (const [tip, mcp] of tipMcp) {
    if (landmarks[tip] && landmarks[mcp] && landmarks[tip].y < landmarks[mcp].y) {
      extended++;
    }
  }
  return extended >= 3;
}

export function isHandFist(landmarks: NormalizedPoint[]): boolean {
  const tipMcp: [number, number][] = [
    [8, 5],
    [12, 9],
    [16, 13],
    [20, 17],
  ];
  let extended = 0;
  for (const [tip, mcp] of tipMcp) {
    if (landmarks[tip] && landmarks[mcp] && landmarks[tip].y < landmarks[mcp].y) {
      extended++;
    }
  }
  return extended <= 1;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
