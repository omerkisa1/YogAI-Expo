import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { LandmarkPoint } from '@/lib/poseAnalyzer';
import { VISIBILITY_THRESHOLD } from '@/lib/poseAnalyzer';
import { colors } from '@/theme/colors';

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

export interface SkeletonOverlayProps {
  landmarks: LandmarkPoint[];
  mirror?: boolean;
  width: number;
  height: number;
  /** Optional crop transform for cover mode alignment. */
  cropTransform?: CoverCropTransform;
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

export function SkeletonOverlay({
  landmarks,
  mirror = false,
  width,
  height,
  cropTransform,
}: SkeletonOverlayProps) {
  const getPosition = (lm: LandmarkPoint) => {
    let x = mirror ? (1 - lm.x) * width : lm.x * width;
    let y = lm.y * height;

    if (cropTransform) {
      // Scale the normalised coord into full-frame pixel space, then remove crop offset
      const ct = cropTransform;
      // `lm.x * width` already maps [0,1] → view px, but cover zooms/offsets
      // Correct approach: map [0,1] → full scaled frame, then subtract offset
      const fullW = width + 2 * ct.offsetX;
      const fullH = height + 2 * ct.offsetY;
      const rawX = mirror ? (1 - lm.x) * fullW : lm.x * fullW;
      const rawY = lm.y * fullH;
      x = rawX - ct.offsetX;
      y = rawY - ct.offsetY;
    }

    return { x, y };
  };

  const isVisible = (index: number) => {
    const lm = landmarks.find(l => l.index === index);
    return lm !== undefined && lm.visibility >= VISIBILITY_THRESHOLD;
  };

  if (width <= 0 || height <= 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      {POSE_CONNECTIONS.map(([a, b], i) => {
        if (!isVisible(a) || !isVisible(b)) return null;

        const lmA = landmarks.find(l => l.index === a);
        const lmB = landmarks.find(l => l.index === b);
        if (!lmA || !lmB) return null;

        const posA = getPosition(lmA);
        const posB = getPosition(lmB);

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
        if (lm.visibility < VISIBILITY_THRESHOLD) return null;
        const pos = getPosition(lm);
        const size = IMPORTANT.has(lm.index) ? 8 : 5;
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
