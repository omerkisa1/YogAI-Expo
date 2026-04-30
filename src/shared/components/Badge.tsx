import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: string;
  backgroundColor?: string;
  textColor?: string;
}

const variantMap: Record<BadgeVariant, { backgroundColor: string; textColor: string }> = {
  primary: { backgroundColor: colors.primarySoft, textColor: colors.primaryDark },
  secondary: { backgroundColor: '#F7EFE8', textColor: colors.secondary },
  success: { backgroundColor: '#EAF8EE', textColor: colors.success },
  warning: { backgroundColor: '#FFF5E6', textColor: colors.warning },
  error: { backgroundColor: '#FFECEA', textColor: colors.error },
  info: { backgroundColor: '#EAF3FF', textColor: colors.info },
  neutral: { backgroundColor: colors.surfaceElevated, textColor: colors.textSecondary },
};

const sizeMap: Record<BadgeSize, { container: object; text: object; icon: number }> = {
  sm: {
    container: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full },
    text: typography.captionMedium,
    icon: 12,
  },
  md: {
    container: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
    text: typography.bodySmMedium,
    icon: 14,
  },
};

const Badge = ({ text, variant = 'neutral', size = 'sm', icon, backgroundColor, textColor }: BadgeProps) => {
  const variantStyle = variantMap[variant];
  const sizeStyle = sizeMap[size];
  const resolvedBackground = backgroundColor ?? variantStyle.backgroundColor;
  const resolvedTextColor = textColor ?? variantStyle.textColor;

  return (
    <View style={[styles.base, sizeStyle.container, { backgroundColor: resolvedBackground }]}>
      {icon ? (
        <MaterialCommunityIcons
          name={icon as never}
          size={sizeStyle.icon}
          color={resolvedTextColor}
          style={styles.icon}
        />
      ) : null}
      <Text style={[sizeStyle.text, { color: resolvedTextColor }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  icon: { marginRight: spacing.xs },
});

export default Badge;
