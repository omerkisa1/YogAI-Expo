import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle, type DimensionValue } from 'react-native';
import { colors } from '@/theme/colors';
import { radius } from '@/theme/spacing';

export interface SkeletonLoaderProps {
  width: number | string;
  height: number;
  borderRadius?: number;
}

const SkeletonLoader = ({ width, height, borderRadius = radius.md }: SkeletonLoaderProps) => {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 780, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 780, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const style: ViewStyle = {
    width: width as DimensionValue,
    height,
    borderRadius,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  };

  return (
    <View style={style}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.shimmer, { opacity: pulse }]} />
    </View>
  );
};

const styles = StyleSheet.create({ shimmer: { backgroundColor: '#ffffff' } });

export default SkeletonLoader;
