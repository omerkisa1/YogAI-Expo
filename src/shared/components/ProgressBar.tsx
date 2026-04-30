import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/spacing';

export interface ProgressBarProps {
  progress: number;
  color?: string;
  height?: number;
  animated?: boolean;
}

const ProgressBar = ({ progress, color = colors.primary, height = 8, animated = true }: ProgressBarProps) => {
  const normalized = Math.min(100, Math.max(0, progress));
  const animatedValue = useRef(new Animated.Value(normalized)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedValue, {
        toValue: normalized,
        duration: 280,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
      return;
    }
    animatedValue.setValue(normalized);
  }, [animated, animatedValue, normalized]);

  const widthInterpolation = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[styles.fill, { width: widthInterpolation, backgroundColor: color, borderRadius: height / 2 }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: colors.borderLight, overflow: 'hidden', borderRadius: radius.full },
  fill: { height: '100%' },
});

export default ProgressBar;
