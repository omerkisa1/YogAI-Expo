import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';
import { typography } from '@/theme/typography';
import Button, { type ButtonVariant } from './Button';
import Touchable from './Touchable';

interface AppModalAction {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'ghost' | 'danger';
}

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  actions: AppModalAction[];
  autoDismissMs?: number;
  dismissOnBackdrop?: boolean;
}

const AppModal = ({
  visible,
  onClose,
  title,
  description,
  icon,
  iconColor = colors.primary,
  actions,
  autoDismissMs = 10000,
  dismissOnBackdrop = true,
}: AppModalProps) => {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const timerProgress = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      opacity.value = withTiming(0, { duration: 180 });
      scale.value = withTiming(0.9, { duration: 180 });
      timerProgress.value = 1;
      return;
    }
    opacity.value = withTiming(1, { duration: 220 });
    scale.value = withSpring(1, { damping: 18, stiffness: 220, mass: 0.7 });
    timerProgress.value = withTiming(0, { duration: autoDismissMs });
    const timer = setTimeout(onClose, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onClose, opacity, scale, timerProgress, visible]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const timerStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: timerProgress.value }] }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
        <Touchable
          onPress={dismissOnBackdrop ? onClose : undefined}
          borderRadius={0}
          style={styles.backdropTouchable}
          disabled={!dismissOnBackdrop}
          accessibilityLabel="Modal arka planı"
        />
        <Animated.View style={[styles.modalCard, cardAnimatedStyle]}>
          {icon ? (
            <View style={styles.iconWrap}>
              <MaterialCommunityIcons name={icon as never} size={48} color={iconColor} />
            </View>
          ) : null}
          <Text style={styles.title}>{title}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          <View style={styles.actionRow}>
            {actions.map(action => (
              <Button
                key={action.label}
                title={action.label}
                onPress={action.onPress}
                variant={action.variant as ButtonVariant}
                size="md"
                fullWidth={false}
                style={styles.actionButton}
                accessibilityLabel={action.label}
              />
            ))}
          </View>
          <View style={styles.timerTrack}>
            <Animated.View style={[styles.timerFill, timerStyle]} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
  },
  backdropTouchable: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    width: '100%',
    borderRadius: radius.xxl,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.lg,
    gap: spacing.base,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.h4, color: colors.text, textAlign: 'center' },
  description: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  actionButton: { flex: 1 },
  timerTrack: { height: 3, borderRadius: radius.full, overflow: 'hidden', backgroundColor: colors.borderLight },
  timerFill: { height: '100%', width: '100%', backgroundColor: colors.primary },
});

export default AppModal;
