import React, { useMemo } from 'react';
import { Platform, Pressable, type PressableProps, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors } from '@/theme/colors';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TouchableProps extends PressableProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleDown?: number;
  opacityDown?: number;
  borderRadius: number;
}

const springConfig = { mass: 0.5, stiffness: 220, damping: 18 };

const Touchable = ({
  children,
  style,
  scaleDown = 0.97,
  opacityDown = 0.85,
  borderRadius,
  onPressIn,
  onPressOut,
  android_ripple,
  ...rest
}: TouchableProps) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const borderRadiusStyle = useMemo(() => ({ borderRadius }), [borderRadius]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn: NonNullable<PressableProps['onPressIn']> = event => {
    scale.value = withSpring(scaleDown, springConfig);
    opacity.value = withSpring(opacityDown, springConfig);
    onPressIn?.(event);
  };

  const handlePressOut: NonNullable<PressableProps['onPressOut']> = event => {
    scale.value = withSpring(1, springConfig);
    opacity.value = withSpring(1, springConfig);
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      android_ripple={
        Platform.OS === 'android'
          ? { color: colors.primarySoft, borderless: false, ...android_ripple }
          : undefined
      }
      style={[styles.base, borderRadiusStyle, animatedStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({ base: { overflow: 'hidden' } });

export default Touchable;
