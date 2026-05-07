import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCreateCustomPlan } from '@/features/plans/hooks/useCreateCustomPlan';
import { useProfile } from '@/features/profile/hooks/useProfile';
import api from '@/shared/api/axiosInstance';
import Button from '@/shared/components/Button';
import Touchable from '@/shared/components/Touchable';
import type { Pose } from '@/shared/types/pose';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCustomPlan'>;

interface SelectedExercise {
  pose: Pose;
  duration_min: number;
}

type ApiWrapper<T> = { status: number; message: string; data: T };

const categoryColorMap: Record<string, string> = {
  standing: colors.categoryStanding,
  seated: colors.categorySeated,
  prone: colors.categoryProne,
  supine: colors.categorySupine,
  inversion: colors.categoryInversion,
};

const INJURY_CONTRAINDICATION_MAP: Record<string, string[]> = {
  knee_injury:      ['knee_injury'],
  ankle_injury:     ['ankle_injury'],
  herniated_disc:   ['herniated_disc'],
  low_back_pain:    ['low_back_pain'],
  shoulder_injury:  ['shoulder_injury'],
  wrist_injury:     ['wrist_injury'],
  neck_injury:      ['neck_injury'],
  groin_injury:     ['groin_injury'],
  hip_injury:       ['hip_injury'],
};

function computeWarnings(exercises: SelectedExercise[], injuries: string[]): string[] {
  if (!injuries.length || !exercises.length) return [];
  const injurySet = new Set(injuries.flatMap(inj => INJURY_CONTRAINDICATION_MAP[inj] ?? [inj]));
  const warnings: string[] = [];
  for (const ex of exercises) {
    for (const ci of ex.pose.contraindications ?? []) {
      if (injurySet.has(ci)) {
        warnings.push(`"${ex.pose.name_tr || ex.pose.name_en}" hareketi mevcut sağlık durumunuzla dikkat gerektirebilir.`);
        break;
      }
    }
  }
  return warnings;
}

const CreateCustomPlanScreen = ({ route, navigation }: Props) => {
  const profileQuery = useProfile();
  const locale = profileQuery.data?.preferred_language ?? 'tr';
  const injuries = (profileQuery.data?.injuries ?? []) as string[];
  const createMutation = useCreateCustomPlan();

  const [title, setTitle] = useState('');
  const [exercises, setExercises] = useState<SelectedExercise[]>([]);

  const posesQuery = useQuery<Pose[]>({
    queryKey: ['all-poses'],
    queryFn: () =>
      api.get<ApiWrapper<Pose[]>>('/api/v1/yoga/poses').then(r => r.data.data ?? []),
    staleTime: 10 * 60 * 1000,
  });

  const poseMap = useMemo(() => {
    const m = new Map<string, Pose>();
    for (const p of posesQuery.data ?? []) m.set(p.pose_id, p);
    return m;
  }, [posesQuery.data]);

  // addPoseId param — gelen tek poz ekle
  const handledAddPoseRef = useRef<string | null>(null);
  useEffect(() => {
    const addPoseId = route.params?.addPoseId;
    if (!addPoseId || addPoseId === handledAddPoseRef.current) return;
    handledAddPoseRef.current = addPoseId;
    const pose = poseMap.get(addPoseId);
    if (!pose) return;
    setExercises(prev => {
      if (prev.some(e => e.pose.pose_id === addPoseId)) return prev;
      return [...prev, { pose, duration_min: 3 }];
    });
  }, [route.params?.addPoseId, poseMap]);

  // selectedPoseIds param — SelectPosesForPlan'dan dönen seçim
  const handledSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const ids = route.params?.selectedPoseIds;
    if (!ids || !ids.length) return;
    const key = ids.join(',');
    if (key === handledSelectedRef.current) return;
    handledSelectedRef.current = key;
    setExercises(prev => {
      const existing = new Set(prev.map(e => e.pose.pose_id));
      const toAdd: SelectedExercise[] = [];
      for (const id of ids) {
        if (existing.has(id)) continue;
        const pose = poseMap.get(id);
        if (pose) toAdd.push({ pose, duration_min: 3 });
      }
      return [...prev, ...toAdd];
    });
  }, [route.params?.selectedPoseIds, poseMap]);

  const updateDuration = useCallback((poseId: string, delta: number) => {
    setExercises(prev =>
      prev.map(e =>
        e.pose.pose_id === poseId
          ? { ...e, duration_min: Math.max(1, Math.min(10, e.duration_min + delta)) }
          : e,
      ),
    );
  }, []);

  const removeExercise = useCallback((poseId: string) => {
    setExercises(prev => prev.filter(e => e.pose.pose_id !== poseId));
  }, []);

  const totalDuration = useMemo(() => exercises.reduce((s, e) => s + e.duration_min, 0), [exercises]);
  const analyzableCount = useMemo(() => exercises.filter(e => e.pose.is_analyzable).length, [exercises]);
  const warnings = useMemo(() => computeWarnings(exercises, injuries), [exercises, injuries]);

  const canSave = title.trim().length > 0 && exercises.length > 0 && !createMutation.isPending;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        exercises: exercises.map(e => ({ pose_id: e.pose.pose_id, duration_min: e.duration_min })),
      });
      Toast.show({ type: 'success', text1: 'Antrenman kaydedildi!' });
      navigation.navigate('MainTabs', { screen: 'Plans' });
    } catch {
      Toast.show({ type: 'error', text1: 'Kayıt başarısız', text2: 'Lütfen tekrar deneyin.' });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>Antrenman Adı</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="Örn. Sabah Rutinim"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            returnKeyType="done"
            maxLength={60}
          />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>
              {locale === 'tr' ? 'Seçilen Hareketler' : 'Selected Poses'} ({exercises.length})
            </Text>
          </View>

          {exercises.length === 0 ? (
            <View style={styles.emptyExercises}>
              <MaterialCommunityIcons name="yoga" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {locale === 'tr' ? 'Henüz hareket eklenmedi.' : 'No poses added yet.'}
              </Text>
            </View>
          ) : (
            exercises.map((ex, idx) => {
              const accentColor = categoryColorMap[ex.pose.category] ?? colors.textMuted;
              const name = locale === 'tr'
                ? (ex.pose.name_tr || ex.pose.name_en)
                : (ex.pose.name_en || ex.pose.name_tr);
              return (
                <View key={ex.pose.pose_id} style={styles.exerciseRow}>
                  <View style={[styles.exerciseAccent, { backgroundColor: accentColor }]} />
                  <View style={styles.exerciseBody}>
                    <View style={styles.exerciseTop}>
                      <Text style={styles.exerciseIndex}>{idx + 1}.</Text>
                      <Text style={styles.exerciseName} numberOfLines={1}>{name}</Text>
                      <Touchable
                        onPress={() => removeExercise(ex.pose.pose_id)}
                        style={styles.removeBtn}
                        borderRadius={radius.full}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.error} />
                      </Touchable>
                    </View>
                    <View style={styles.exerciseBottom}>
                      <Text style={styles.exerciseMeta}>
                        {ex.pose.target_area}
                        {ex.pose.is_analyzable ? '  ·  Analiz edilebilir' : ''}
                      </Text>
                      <View style={styles.stepper}>
                        <Touchable
                          onPress={() => updateDuration(ex.pose.pose_id, -1)}
                          style={styles.stepperBtn}
                          borderRadius={radius.sm}
                        >
                          <MaterialCommunityIcons name="minus" size={16} color={colors.primary} />
                        </Touchable>
                        <Text style={styles.stepperValue}>{ex.duration_min} dk</Text>
                        <Touchable
                          onPress={() => updateDuration(ex.pose.pose_id, 1)}
                          style={styles.stepperBtn}
                          borderRadius={radius.sm}
                        >
                          <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
                        </Touchable>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          <Button
            title={locale === 'tr' ? '+ Hareket Ekle' : '+ Add Pose'}
            onPress={() =>
              navigation.navigate('SelectPosesForPlan', {
                currentPoseIds: exercises.map(e => e.pose.pose_id),
              })
            }
            variant="outline"
            size="md"
            fullWidth
            icon="plus"
            accessibilityLabel="Hareket ekle"
          />

          {exercises.length > 0 ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>{locale === 'tr' ? 'Özet' : 'Summary'}</Text>
              <View style={styles.summaryRow}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.summaryText}>
                  {locale === 'tr' ? 'Toplam süre:' : 'Total duration:'} {totalDuration} {locale === 'tr' ? 'dakika' : 'minutes'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <MaterialCommunityIcons name="format-list-numbered" size={16} color={colors.textSecondary} />
                <Text style={styles.summaryText}>
                  {locale === 'tr' ? 'Hareket sayısı:' : 'Poses:'} {exercises.length}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <MaterialCommunityIcons name="camera-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.summaryText}>
                  {locale === 'tr' ? 'Analiz edilebilir:' : 'Analyzable:'} {analyzableCount}/{exercises.length}
                </Text>
              </View>
            </View>
          ) : null}

          {warnings.length > 0 ? (
            <View style={styles.warningCard}>
              <View style={styles.warningHeader}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.warning} />
                <Text style={styles.warningTitle}>
                  {locale === 'tr' ? 'Dikkat' : 'Caution'}
                </Text>
              </View>
              {warnings.map((w, i) => (
                <Text key={i} style={styles.warningText}>{w}</Text>
              ))}
            </View>
          ) : null}

          <Button
            title={
              createMutation.isPending
                ? (locale === 'tr' ? 'Kaydediliyor...' : 'Saving...')
                : (locale === 'tr' ? 'Antrenmanı Kaydet' : 'Save Plan')
            }
            onPress={() => void handleSave()}
            variant="primary"
            size="lg"
            fullWidth
            icon="check"
            accessibilityLabel="Antrenmanı kaydet"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.base,
    gap: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  sectionLabel: { ...typography.bodySmMedium, color: colors.textSecondary },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    height: 50,
  },
  emptyExercises: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
  },
  emptyText: { ...typography.bodySm, color: colors.textMuted },
  exerciseRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  exerciseAccent: { width: 4 },
  exerciseBody: { flex: 1, padding: spacing.base, gap: spacing.sm },
  exerciseTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exerciseIndex: { ...typography.bodySmMedium, color: colors.textMuted, width: 20 },
  exerciseName: { ...typography.bodySmMedium, color: colors.text, flex: 1 },
  removeBtn: { padding: spacing.xs },
  exerciseBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exerciseMeta: { ...typography.caption, color: colors.textMuted, flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { ...typography.bodySmMedium, color: colors.text, minWidth: 40, textAlign: 'center' },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    gap: spacing.sm,
  },
  summaryTitle: { ...typography.h4, color: colors.text },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryText: { ...typography.bodySm, color: colors.textSecondary },
  warningCard: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    padding: spacing.base,
    gap: spacing.sm,
  },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  warningTitle: { ...typography.bodySmMedium, color: colors.warningDark },
  warningText: { ...typography.caption, color: colors.warningDark },
});

export default CreateCustomPlanScreen;
