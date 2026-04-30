import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { Plan } from '@/shared/types/plan';
import Card from './Card';
import ProgressBar from './ProgressBar';
import Touchable from './Touchable';

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
  full_body: 'Tam Vücut',
  legs: 'Bacaklar',
  back: 'Sırt',
  core: 'Core',
  balance: 'Denge',
  flexibility: 'Esneklik',
  arms: 'Kollar',
  hips: 'Kalça',
};

const PlanCard = ({
  plan,
  onPress,
  onToggleFavorite,
  onTogglePin,
  onLongPress,
  actionsDisabled = false,
  progress = 0,
}: PlanCardProps) => {
  const difficulty = difficultyMeta[plan.difficulty];
  const focusArea = focusAreaLabelMap[plan.focus_area] ?? plan.focus_area;
  const analyzableCount = plan.analyzable_pose_count ?? 0;
  const totalPoses = plan.total_pose_count ?? plan.exercises?.length ?? 0;
  const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : 0;

  return (
    <Card
      variant="default"
      onPress={() => onPress(plan.id)}
      style={[styles.card, styles.cardAccent, { borderLeftColor: difficulty.color }]}
      accessibilityLabel={`${plan.title_tr || plan.title_en} plan kartı`}
    >
      <Touchable
        onLongPress={onLongPress ? () => onLongPress(plan) : undefined}
        delayLongPress={260}
        borderRadius={radius.md}
        accessibilityRole="button"
        accessibilityLabel="Plan seçeneklerini aç"
      >
        <View style={styles.headerRow}>
          <Text numberOfLines={1} style={styles.title}>
            {plan.title_tr || plan.title_en}
          </Text>
          <View style={styles.actions}>
            <Touchable
              onPress={() => onToggleFavorite?.(plan)}
              disabled={actionsDisabled || !onToggleFavorite}
              style={styles.actionButton}
              borderRadius={radius.full}
              accessibilityRole="button"
              accessibilityLabel="Favori durumu değiştir"
            >
              <MaterialCommunityIcons
                name={plan.favorite ? 'star' : 'star-outline'}
                size={21}
                color={plan.favorite ? colors.warning : colors.textMuted}
              />
            </Touchable>
            <Touchable
              onPress={() => onTogglePin?.(plan)}
              disabled={actionsDisabled || !onTogglePin}
              style={styles.actionButton}
              borderRadius={radius.full}
              accessibilityRole="button"
              accessibilityLabel="Sabitleme durumu değiştir"
            >
              <MaterialCommunityIcons
                name={plan.pin ? 'pin' : 'pin-outline'}
                size={21}
                color={plan.pin ? colors.accent : colors.textMuted}
              />
            </Touchable>
          </View>
        </View>

        <View style={styles.badges}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{difficulty.label}</Text>
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
      </Touchable>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  cardAccent: { borderLeftWidth: 4 },
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
