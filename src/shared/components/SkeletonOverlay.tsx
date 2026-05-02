import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { LandmarkPoint } from '@/lib/poseAnalyzer';
import { VISIBILITY_THRESHOLD } from '@/lib/poseAnalyzer';
import { colors } from '@/theme/colors';

export interface SkeletonOverlayProps {
  landmarks: LandmarkPoint[];
  mirror?: boolean;
  width: number;
  height: number;
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

export function SkeletonOverlay({
  landmarks,
  mirror = false,
  width,
  height,
}: SkeletonOverlayProps) {
  const getPosition = (lm: LandmarkPoint) => {
    const x = mirror ? (1 - lm.x) * width : lm.x * width;
    const y = lm.y * height;
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
