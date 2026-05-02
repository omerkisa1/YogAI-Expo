import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { LandmarkPoint } from '@/lib/poseAnalyzer';
import { colors } from '@/theme/colors';

/** Default segments — ML Kit stream scores run lower than MediaPipe. */
const OVERLAY_MIN_VISIBILITY = 0.35;

/** Arm chains: keep shoulder→elbow→wrist connected even when mid joints flicker (fixes “kırık kol”). */
const ARM_EDGE_KEYS = new Set(['11,13', '13,15', '12,14', '14,16']);
const ARM_EDGE_STRONG = 0.24;
/** Upper arm / shoulder–elbow — ML Kit elbow likelihood often ~0.08+. */
const ARM_EDGE_WEAK_UPPER = 0.042;
/** Forearm — wrist stream scores dip to ~0.02 while elbow+shoulder stay strong. */
const ARM_EDGE_WEAK_FOREARM = 0.012;

/** Face / head mesh — full-body pose reports weak likelihood on eyes; relax only these edges. */
const FACE_MAX_INDEX = 10;
const FACE_EDGE_STRONG = 0.18;
const FACE_EDGE_WEAK = 0.06;

const DOT_FACE_MIN = 0.12;
const DOT_BODY_IMPORTANT_MIN = 0.22;

function edgeKey(a: number, b: number): string {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function isFaceEdge(a: number, b: number): boolean {
  return a <= FACE_MAX_INDEX && b <= FACE_MAX_INDEX;
}

/**
 * Önizleme uzayı ~[0,1]; dışarı taşan ham değerler çizgiyi kamera dışına fırlatıyordu.
 * Çok hafif tolerans (kenar crop) dışında çizmiyoruz.
 */
function inReasonablePreviewNorm(lm: LandmarkPoint): boolean {
  const pad = 0.06;
  return (
    lm.x >= -pad &&
    lm.x <= 1 + pad &&
    lm.y >= -pad &&
    lm.y <= 1 + pad
  );
}

/** Ham norm’u hafifçe sıkıştırıp [0,1] içine alır (sert clamp yerine kenara yapışmayı azaltır). */
function squashToPreviewUnit(v: number): number {
  const lo = -0.12;
  const hi = 1.12;
  const t = (v - lo) / (hi - lo);
  return Math.max(0, Math.min(1, t));
}

/** Omuz–dirsek ~0.15–0.45 norm birim; daha uzun segment genelde hatalı eşleşme. */
const MAX_EDGE_NORM_LEN = 0.52;

/** Whether an (undirected) edge should draw — arm/face relaxed, rest strict. */
function pairVisibleForEdge(
  lmA: LandmarkPoint,
  lmB: LandmarkPoint,
  ia: number,
  ib: number,
): boolean {
  if (
    lmA.visibility >= OVERLAY_MIN_VISIBILITY &&
    lmB.visibility >= OVERLAY_MIN_VISIBILITY &&
    inReasonablePreviewNorm(lmA) &&
    inReasonablePreviewNorm(lmB)
  ) {
    return true;
  }
  const key = edgeKey(ia, ib);
  if (ARM_EDGE_KEYS.has(key)) {
    const hi = Math.max(lmA.visibility, lmB.visibility);
    const lo = Math.min(lmA.visibility, lmB.visibility);
    const forearm = key === '13,15' || key === '14,16';
    const weakTh = forearm ? ARM_EDGE_WEAK_FOREARM : ARM_EDGE_WEAK_UPPER;
    const relaxedOk =
      hi >= ARM_EDGE_STRONG &&
      lo >= weakTh &&
      inReasonablePreviewNorm(lmA) &&
      inReasonablePreviewNorm(lmB);
    if (relaxedOk) return true;
    return false;
  }
  if (isFaceEdge(ia, ib)) {
    const hi = Math.max(lmA.visibility, lmB.visibility);
    const lo = Math.min(lmA.visibility, lmB.visibility);
    return hi >= FACE_EDGE_STRONG && lo >= FACE_EDGE_WEAK;
  }
  return false;
}

function dotVisible(lm: LandmarkPoint): boolean {
  if (lm.index <= FACE_MAX_INDEX) {
    return lm.visibility >= DOT_FACE_MIN;
  }
  if (IMPORTANT.has(lm.index)) {
    return lm.visibility >= DOT_BODY_IMPORTANT_MIN;
  }
  return lm.visibility >= OVERLAY_MIN_VISIBILITY;
}

/**
 * Transform applied when the Camera preview uses `resizeMode="cover"`.
 *
 * Because `cover` crops and scales the preview to fill the view, the normalised
 * [0,1] landmark coordinates need the same crop+scale to line up.
 *
 * - `scale`  : how much the visible crop is scaled up (always ≥ 1 for cover)
 * - `offsetX`: horizontal px offset of the visible area origin
 * - `offsetY`: vertical px offset of the visible area origin
 */
export interface CoverCropTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Letterbox / pillarbox rect when the Camera uses `resizeMode="contain"`.
 * Normalised landmarks map into `displayW` × `displayH`, then shift by offsets.
 */
export interface ContainFitTransform {
  offsetX: number;
  offsetY: number;
  displayW: number;
  displayH: number;
}

export interface SkeletonOverlayProps {
  landmarks: LandmarkPoint[];
  mirror?: boolean;
  width: number;
  height: number;
  /** Optional crop transform for cover mode alignment. */
  cropTransform?: CoverCropTransform;
  /** Optional fit rect for contain mode (mutually exclusive with `cropTransform`). */
  containFit?: ContainFitTransform;
}

const POSE_CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [27, 29],
  [27, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [28, 32],
];

const IMPORTANT = new Set([
  11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28,
]);

/**
 * Compute the cover-crop transform so overlay landmarks align with the Camera preview.
 *
 * @param viewWidth   Width of the overlay / Camera view (px)
 * @param viewHeight  Height of the overlay / Camera view (px)
 * @param frameWidth  Raw frame width from frame processor (px)
 * @param frameHeight Raw frame height from frame processor (px)
 * @returns CoverCropTransform to pass to SkeletonOverlay
 */
export function computeCoverCropTransform(
  viewWidth: number,
  viewHeight: number,
  frameWidth: number,
  frameHeight: number,
): CoverCropTransform {
  if (
    viewWidth <= 0 ||
    viewHeight <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    return { scale: 1, offsetX: 0, offsetY: 0 };
  }

  const viewAspect = viewWidth / viewHeight;
  const frameAspect = frameWidth / frameHeight;

  // Cover: the larger axis overflows; the visible area is the smaller fitting.
  let scale: number;
  let offsetX = 0;
  let offsetY = 0;

  if (frameAspect > viewAspect) {
    // Frame is wider → height fits, width is cropped
    scale = viewHeight / frameHeight;
    const scaledWidth = frameWidth * scale;
    offsetX = (scaledWidth - viewWidth) / 2;
  } else {
    // Frame is taller → width fits, height is cropped
    scale = viewWidth / frameWidth;
    const scaledHeight = frameHeight * scale;
    offsetY = (scaledHeight - viewHeight) / 2;
  }

  return { scale, offsetX, offsetY };
}

/**
 * Compute the centred video rectangle for `resizeMode="contain"` so overlays match the preview.
 *
 * @param contentW/H — logical upright preview size (same as `getPreviewContentExtent`).
 */
export function computeContainFitTransform(
  viewWidth: number,
  viewHeight: number,
  contentWidth: number,
  contentHeight: number,
): ContainFitTransform {
  if (
    viewWidth <= 0 ||
    viewHeight <= 0 ||
    contentWidth <= 0 ||
    contentHeight <= 0
  ) {
    return { offsetX: 0, offsetY: 0, displayW: viewWidth, displayH: viewHeight };
  }

  const viewAspect = viewWidth / viewHeight;
  const contentAspect = contentWidth / contentHeight;

  let displayW: number;
  let displayH: number;
  let offsetX = 0;
  let offsetY = 0;

  if (contentAspect > viewAspect) {
    displayW = viewWidth;
    displayH = viewWidth / contentAspect;
    offsetY = (viewHeight - displayH) / 2;
  } else {
    displayH = viewHeight;
    displayW = viewHeight * contentAspect;
    offsetX = (viewWidth - displayW) / 2;
  }

  return { offsetX, offsetY, displayW, displayH };
}

export function SkeletonOverlay({
  landmarks,
  mirror = false,
  width,
  height,
  cropTransform,
  containFit,
}: SkeletonOverlayProps) {
  const getPosition = (lm: LandmarkPoint) => {
    const nx = squashToPreviewUnit(lm.x);
    const ny = squashToPreviewUnit(lm.y);

    if (containFit && !cropTransform) {
      const cf = containFit;
      let x = mirror ? (1 - nx) * cf.displayW : nx * cf.displayW;
      let y = ny * cf.displayH;
      x += cf.offsetX;
      y += cf.offsetY;
      return { x, y };
    }

    let x = mirror ? (1 - nx) * width : nx * width;
    let y = ny * height;

    if (cropTransform) {
      // Scale the normalised coord into full-frame pixel space, then remove crop offset
      const ct = cropTransform;
      // `lm.x * width` already maps [0,1] → view px, but cover zooms/offsets
      // Correct approach: map [0,1] → full scaled frame, then subtract offset
      const fullW = width + 2 * ct.offsetX;
      const fullH = height + 2 * ct.offsetY;
      const rawX = mirror ? (1 - nx) * fullW : nx * fullW;
      const rawY = ny * fullH;
      x = rawX - ct.offsetX;
      y = rawY - ct.offsetY;
    }

    return { x, y };
  };

  if (width <= 0 || height <= 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      {POSE_CONNECTIONS.map(([a, b], i) => {
        const lmA = landmarks.find(l => l.index === a);
        const lmB = landmarks.find(l => l.index === b);
        if (!lmA || !lmB || !pairVisibleForEdge(lmA, lmB, a, b)) return null;

        const posA = getPosition(lmA);
        const posB = getPosition(lmB);

        const ek = edgeKey(a, b);
        if (ARM_EDGE_KEYS.has(ek)) {
          const ndx = squashToPreviewUnit(lmB.x) - squashToPreviewUnit(lmA.x);
          const ndy = squashToPreviewUnit(lmB.y) - squashToPreviewUnit(lmA.y);
          if (ndx * ndx + ndy * ndy > MAX_EDGE_NORM_LEN * MAX_EDGE_NORM_LEN) {
            return null;
          }
        }

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

        return (
          <View
            key={`line-${i}`}
            style={{
              position: 'absolute',
              left: posA.x,
              top: posA.y,
              width: length,
              height: 3,
              backgroundColor: colors.primaryLight,
              transform: [{ rotate: `${angleDeg}deg` }],
              transformOrigin: 'left center',
              borderRadius: 1.5,
            }}
          />
        );
      })}

      {landmarks.map(lm => {
        if (!dotVisible(lm)) return null;
        const pos = getPosition(lm);
        const size =
          lm.index <= FACE_MAX_INDEX ? 4 : IMPORTANT.has(lm.index) ? 8 : 5;
        return (
          <View
            key={`lm-${lm.index}`}
            style={{
              position: 'absolute',
              left: pos.x - size / 2,
              top: pos.y - size / 2,
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: colors.secondary,
              borderWidth: 1,
              borderColor: colors.textOnPrimary,
            }}
          />
        );
      })}
    </View>
  );
}
