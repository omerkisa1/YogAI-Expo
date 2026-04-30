import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import Touchable from './Touchable';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
  tone?: 'primary' | 'warning';
}

const Chip = ({ label, selected, onPress, icon, tone = 'primary' }: ChipProps) => {
  const selectedStyle = tone === 'warning' ? styles.warningSelected : styles.primarySelected;
  const selectedLabelStyle = tone === 'warning' ? styles.warningSelectedLabel : styles.primarySelectedLabel;
  const iconColor = selected
    ? tone === 'warning' ? colors.warning : colors.primaryDark
    : colors.textSecondary;

  return (
    <Touchable
      onPress={onPress}
      borderRadius={radius.full}
      style={[styles.base, selected ? selectedStyle : styles.unselected]}
      accessibilityRole="button"
      accessibilityLabel={`${label} seçim chip`}
    >
      {icon ? (
        <MaterialCommunityIcons name={icon as never} size={16} color={iconColor} style={styles.icon} />
      ) : null}
      <Text style={[styles.label, selected ? selectedLabelStyle : styles.unselectedLabel]}>{label}</Text>
    </Touchable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  primarySelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  warningSelected: { backgroundColor: '#FFF3E9', borderColor: colors.warning },
  unselected: { backgroundColor: colors.surface, borderColor: colors.border },
  icon: { marginRight: spacing.xs },
  label: { ...typography.bodySmMedium },
  primarySelectedLabel: { color: colors.primaryDark },
  warningSelectedLabel: { color: colors.warning },
  unselectedLabel: { color: colors.textSecondary },
});

export default Chip;
