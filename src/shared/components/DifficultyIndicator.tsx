import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

export interface DifficultyIndicatorProps {
  difficulty: number;
  size?: 'sm' | 'md';
}

const getDifficultyColor = (difficulty: number) => {
  switch (difficulty) {
    case 1: return colors.difficulty1;
    case 2: return colors.difficulty2;
    case 3: return colors.difficulty3;
    case 4: return colors.difficulty4;
    default: return colors.difficulty5;
  }
};

const DifficultyIndicator = ({ difficulty, size = 'md' }: DifficultyIndicatorProps) => {
  const level = Math.max(1, Math.min(5, Math.round(difficulty)));
  const pointSize = size === 'sm' ? 8 : 10;
  const pointGap = size === 'sm' ? spacing.xs : spacing.sm;
  const activeColor = getDifficultyColor(level);

  return (
    <View style={[styles.container, { gap: pointGap }]}>
      {Array.from({ length: 5 }).map((_, index) => (
        <View
          key={`difficulty-dot-${index}`}
          style={[
            styles.dot,
            {
              width: pointSize,
              height: pointSize,
              borderRadius: radius.full,
              backgroundColor: index < level ? activeColor : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  dot: { opacity: 1 },
});

export default DifficultyIndicator;
