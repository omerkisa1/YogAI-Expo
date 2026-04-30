import React from 'react';
import {
  ActivityIndicator,
  type GestureResponderEvent,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import Touchable from './Touchable';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

interface VariantStyle {
  container: ViewStyle;
  text: TextStyle;
  iconColor: string;
  spinnerColor: string;
}

interface SizeStyle {
  container: ViewStyle;
  text: TextStyle;
  iconSize: number;
}

export interface ButtonProps {
  title?: string;
  label?: string;
  onPress: (event: GestureResponderEvent) => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const variantStyles: Record<ButtonVariant, VariantStyle> = {
  primary: {
    container: { backgroundColor: colors.primary, borderColor: colors.primary },
    text: { color: colors.textOnPrimary },
    iconColor: colors.textOnPrimary,
    spinnerColor: colors.textOnPrimary,
  },
  secondary: {
    container: { backgroundColor: colors.secondary, borderColor: colors.secondary },
    text: { color: colors.textOnPrimary },
    iconColor: colors.textOnPrimary,
    spinnerColor: colors.textOnPrimary,
  },
  outline: {
    container: { backgroundColor: 'transparent', borderColor: colors.primary },
    text: { color: colors.primary },
    iconColor: colors.primary,
    spinnerColor: colors.primary,
  },
  ghost: {
    container: { backgroundColor: 'transparent', borderColor: 'transparent' },
    text: { color: colors.primary },
    iconColor: colors.primary,
    spinnerColor: colors.primary,
  },
  danger: {
    container: { backgroundColor: colors.error, borderColor: colors.error },
    text: { color: colors.textOnPrimary },
    iconColor: colors.textOnPrimary,
    spinnerColor: colors.textOnPrimary,
  },
};

const sizeStyles: Record<ButtonSize, SizeStyle> = {
  lg: {
    container: { minHeight: 52, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.lg },
    text: typography.buttonLg,
    iconSize: 20,
  },
  md: {
    container: { minHeight: 46, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
    text: typography.buttonMd,
    iconSize: 18,
  },
  sm: {
    container: { minHeight: 38, paddingHorizontal: spacing.base, paddingVertical: spacing.xs, borderRadius: radius.sm },
    text: typography.buttonSm,
    iconSize: 16,
  },
};

const Button = ({
  title,
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
  iconPosition = 'left',
  accessibilityLabel,
  style,
}: ButtonProps) => {
  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];
  const isDisabled = disabled || loading;
  const buttonTitle = title ?? label ?? '';

  return (
    <Touchable
      style={[
        styles.base,
        currentSize.container,
        fullWidth && styles.fullWidth,
        currentVariant.container,
        isDisabled && styles.disabled,
        style,
      ]}
      borderRadius={(currentSize.container.borderRadius as number) ?? radius.md}
      disabled={isDisabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? buttonTitle}
    >
      {loading ? (
        <ActivityIndicator size="small" color={currentVariant.spinnerColor} />
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' ? (
            <MaterialCommunityIcons
              name={icon as never}
              size={currentSize.iconSize}
              color={currentVariant.iconColor}
              style={styles.iconLeft}
            />
          ) : null}
          <Text style={[styles.label, currentSize.text, currentVariant.text]}>{buttonTitle}</Text>
          {icon && iconPosition === 'right' ? (
            <MaterialCommunityIcons
              name={icon as never}
              size={currentSize.iconSize}
              color={currentVariant.iconColor}
              style={styles.iconRight}
            />
          ) : null}
        </View>
      )}
    </Touchable>
  );
};

const styles = StyleSheet.create({
  base: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  fullWidth: { width: '100%' },
  contentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
  disabled: { opacity: 0.5 },
  iconLeft: { marginRight: spacing.sm },
  iconRight: { marginLeft: spacing.sm },
});

export default Button;
