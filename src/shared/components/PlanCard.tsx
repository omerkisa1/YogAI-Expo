import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { cardStyle } from '@/theme/shadows';
import { typography } from '@/theme/typography';
import type { Plan } from '@/shared/types/plan';
import ProgressBar from './ProgressBar';

export interface PlanCardProps {
  plan: Plan;
  onPress: (planId: string) => void;
  onToggleFavorite?: (plan: Plan) => void;
  onTogglePin?: (plan: Plan) => void;
  onLongPress?: (plan: Plan) => void;
  actionsDisabled?: boolean;
  progress?: number;
}

const difficultyMeta: Record<Plan['difficulty'], { label: string; color: string }> = {
  beginner: { label: 'Başlangıç', color: colors.difficulty1 },
  intermediate: { label: 'Orta', color: colors.difficulty2 },
  advanced: { label: 'İleri', color: colors.difficulty4 },
};

const focusAreaLabelMap: Record<string, string> = {
  full_body: 'Tam Vücut', legs: 'Bacaklar', back: 'Sırt',
  core: 'Core', balance: 'Denge', flexibility: 'Esneklik',
  arms: 'Kollar', hips: 'Kalça',
};

const PlanCard = ({
  plan, onPress, onToggleFavorite, onTogglePin, onLongPress,
  actionsDisabled = false, progress = 0,
}: PlanCardProps) => {
  const actionTriggeredRef = useRef(false);
  const difficulty = difficultyMeta[plan.difficulty] ?? { label: plan.difficulty, color: colors.textMuted };
  const focusArea = focusAreaLabelMap[plan.focus_area] ?? plan.focus_area;
  const analyzableCount = plan.analyzable_pose_count ?? 0;
  const totalPoses = plan.total_pose_count ?? plan.exercises?.length ?? 0;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

  const handleCardPress = () => {
    if (actionTriggeredRef.current) {
      actionTriggeredRef.current = false;
      return;
    }
    onPress(plan.id);
  };

  const handleFavorite = () => {
    actionTriggeredRef.current = true;
    onToggleFavorite?.(plan);
  };

  const handlePin = () => {
    actionTriggeredRef.current = true;
    onTogglePin?.(plan);
  };

  return (
    <Pressable
      onPress={handleCardPress}
      onLongPress={onLongPress ? () => onLongPress(plan) : undefined}
      delayLongPress={260}
      style={({ pressed }) => [
        styles.card,
        { borderLeftColor: difficulty.color },
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${plan.title_tr || plan.title_en} plan kartı`}
    >
      <View style={styles.headerRow}>
        <Text numberOfLines={1} style={styles.title}>
          {plan.title_tr || plan.title_en}
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={handleFavorite}
            disabled={actionsDisabled || !onToggleFavorite}
            style={styles.actionButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Favori durumu değiştir"
          >
            <MaterialCommunityIcons
              name={plan.favorite ? 'star' : 'star-outline'}
              size={21}
              color={plan.favorite ? colors.warning : colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={handlePin}
            disabled={actionsDisabled || !onTogglePin}
            style={styles.actionButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Sabitleme durumu değiştir"
          >
            <MaterialCommunityIcons
              name={plan.pin ? 'pin' : 'pin-outline'}
              size={21}
              color={plan.pin ? colors.accent : colors.textMuted}
            />
          </Pressable>
        </View>
      </View>

      <View style={styles.badges}>
        <View style={[styles.chip, { backgroundColor: `${difficulty.color}22` }]}>
          <Text style={[styles.chipText, { color: difficulty.color }]}>{difficulty.label}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{focusArea}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{plan.total_duration_min} dk</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="yoga" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{totalPoses} hareket</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="camera-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{analyzableCount}</Text>
        </View>
      </View>

      <View style={styles.progressWrap}>
        <ProgressBar progress={safeProgress} color={colors.primary} height={4} animated />
        <Text style={styles.progressLabel}>%{Math.round(safeProgress)} tamamlandı</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    ...cardStyle,
    backgroundColor: colors.surface,
    borderColor: colors.borderLight,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: spacing.base,
    gap: spacing.sm,
  },
  cardPressed: { opacity: 0.85 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { ...typography.h4, color: colors.text, flex: 1, marginRight: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  badges: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.primarySoft },
  chipText: { ...typography.captionMedium, color: colors.primaryDark },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.sm, rowGap: spacing.xs, marginTop: spacing.xs },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { ...typography.caption, color: colors.textSecondary },
  progressWrap: { gap: spacing.xs, marginTop: spacing.xs },
  progressLabel: { ...typography.caption, color: colors.textMuted },
});

export default PlanCard;
