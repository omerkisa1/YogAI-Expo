import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import Touchable from './Touchable';

/** Açık, hafif şeffaf dolgu — beyaz kart üzerinde daha doğal görünür */
const FIELD_BG = 'rgba(241, 237, 230, 0.38)';
const FIELD_BORDER = 'rgba(107, 99, 88, 0.14)';

export interface AuthInputProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  disabled?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  textContentType?: TextInputProps['textContentType'];
  accessibilityLabel?: string;
}

const AuthInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  leftIcon,
  rightIcon,
  onRightIconPress,
  disabled = false,
  keyboardType,
  autoCapitalize = 'none',
  textContentType,
  accessibilityLabel,
}: AuthInputProps) => {
  const [focused, setFocused] = useState(false);

  const containerStyle = useMemo(() => {
    if (disabled) return styles.disabled;
    if (error) return styles.errorBorder;
    if (focused) return styles.focusedBorder;
    return styles.defaultBorder;
  }, [disabled, error, focused]);

  const iconColor = error ? colors.error : focused ? colors.primaryDark : colors.textMuted;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.capsLabel}>{label.trim().toUpperCase()}</Text>
      <View style={[styles.inputContainer, containerStyle]}>
        {leftIcon ? (
          <MaterialCommunityIcons name={leftIcon as never} size={20} color={iconColor} style={styles.leftIcon} />
        ) : null}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          editable={!disabled}
          secureTextEntry={secureTextEntry}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          textContentType={textContentType}
          accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
        />
        {rightIcon ? (
          <Touchable
            onPress={onRightIconPress}
            disabled={disabled || !onRightIconPress}
            style={styles.rightIconButton}
            borderRadius={radius.sm}
            accessibilityRole="button"
            accessibilityLabel="Girdi aksiyon ikonu"
          >
            <MaterialCommunityIcons name={rightIcon as never} size={20} color={iconColor} />
          </Touchable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginBottom: spacing.lg },
  capsLabel: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    ...(Platform.OS === 'android' ? { fontFamily: 'sans-serif-medium' } : {}),
  },
  inputContainer: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: radius.lg,
    backgroundColor: FIELD_BG,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  defaultBorder: { borderColor: FIELD_BORDER },
  focusedBorder: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    backgroundColor: 'rgba(241, 237, 230, 0.52)',
  },
  errorBorder: { borderColor: colors.error },
  disabled: { opacity: 0.55 },
  input: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : spacing.xs,
  },
  rightIconButton: { marginLeft: spacing.sm, padding: spacing.xs },
  leftIcon: { marginRight: spacing.sm },
  errorText: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
});

export default AuthInput;
