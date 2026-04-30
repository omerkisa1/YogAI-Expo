import React, { type ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { cardStyle } from '@/theme/shadows';
import Touchable from './Touchable';

export type CardVariant = 'default' | 'elevated' | 'outlined';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const variantStyles: Record<CardVariant, ViewStyle> = {
  default: { ...cardStyle, backgroundColor: colors.surface, borderColor: colors.borderLight },
  elevated: { ...cardStyle, backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight },
  outlined: { ...cardStyle, backgroundColor: colors.surface, borderColor: colors.border },
};

const Card = ({ children, variant = 'default', style, onPress, accessibilityLabel }: CardProps) => {
  const variantStyle = variantStyles[variant];

  if (onPress) {
    return (
      <Touchable
        style={[styles.base, variantStyle, style]}
        borderRadius={radius.lg}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Touchable>
    );
  }

  return <View style={[styles.base, variantStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.base },
});

export default Card;
