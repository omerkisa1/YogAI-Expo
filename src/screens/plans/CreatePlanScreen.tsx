import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlatList, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import axios from 'axios';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useCreatePlan } from '@/features/plans/hooks/useCreatePlan';
import Button from '@/shared/components/Button';
import ErrorView from '@/shared/components/ErrorView';
import Touchable from '@/shared/components/Touchable';
import type { AppLanguage, CreatePlanRequest, FocusArea, Injury, Level } from '@/shared/types/plan';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { cardStyle } from '@/theme/shadows';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePlan'>;

const levelOptions = [
  { key: 'beginner' as Level, label: 'Başlangıç', icon: 'leaf', gradient: [colors.gradientBeginner[0], colors.gradientBeginner[1]] as [string, string] },
  { key: 'intermediate' as Level, label: 'Orta', icon: 'tree', gradient: [colors.gradientIntermediate[0], colors.gradientIntermediate[1]] as [string, string] },
  { key: 'advanced' as Level, label: 'İleri', icon: 'fire', gradient: [colors.gradientAdvanced[0], colors.gradientAdvanced[1]] as [string, string] },
];

const durationOptions = [10, 15, 20, 25, 30, 45, 60] as const;

const focusOptions: { key: FocusArea; label: string }[] = [
  { key: 'full_body', label: 'Tam Vücut' }, { key: 'legs', label: 'Bacaklar' }, { key: 'back', label: 'Sırt' },
  { key: 'core', label: 'Core' }, { key: 'balance', label: 'Denge' }, { key: 'flexibility', label: 'Esneklik' },
  { key: 'arms', label: 'Kollar' }, { key: 'hips', label: 'Kalça' },
];

const injuryOptions: { key: Injury; label: string }[] = [
  { key: 'knee_injury', label: 'Diz' }, { key: 'ankle_injury', label: 'Ayak Bileği' }, { key: 'herniated_disc', label: 'Bel Fıtığı' },
  { key: 'low_back_pain', label: 'Bel' }, { key: 'shoulder_injury', label: 'Omuz' }, { key: 'wrist_injury', label: 'Bilek' },
  { key: 'neck_injury', label: 'Boyun' }, { key: 'groin_injury', label: 'Kasık' }, { key: 'hip_injury', label: 'Kalça' },
];

const languageOptions: { key: AppLanguage; label: string }[] = [{ key: 'tr', label: 'Türkçe' }, { key: 'en', label: 'English' }];

const CreatePlanScreen = ({ navigation, route }: Props) => {
  const createPlanMutation = useCreatePlan();
  const pulseAnim = useSharedValue(1);
  const [inlineValidationError, setInlineValidationError] = useState<string | null>(null);
  const [showServerError, setShowServerError] = useState(false);

  const { control, handleSubmit, watch, setValue } = useForm<CreatePlanRequest>({
    defaultValues: { level: route.params?.presetLevel ?? 'beginner', duration: route.params?.presetDuration ?? 20, focus_area: 'full_body', injuries: [], language: 'tr' },
  });

  const selectedLevel = watch('level');
  const selectedDuration = watch('duration');
  const selectedFocus = watch('focus_area');
  const selectedInjuries = watch('injuries');
  const selectedLanguage = watch('language');

  useEffect(() => {
    if (route.params?.presetLevel) setValue('level', route.params.presetLevel);
    if (route.params?.presetDuration) setValue('duration', route.params.presetDuration);
  }, [route.params?.presetDuration, route.params?.presetLevel, setValue]);

  useEffect(() => {
    if (!createPlanMutation.isPending) { pulseAnim.value = withTiming(1, { duration: 150 }); return; }
    pulseAnim.value = withRepeat(withSequence(withTiming(1.15, { duration: 750 }), withTiming(1, { duration: 750 })), -1, false);
  }, [createPlanMutation.isPending, pulseAnim]);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulseAnim.value }] }));
  const inlineSuggestion = useMemo(() => 'Öneri: Süreyi kısaltmayı veya odak alanını genişletmeyi deneyin.', []);

  const onSubmit = handleSubmit(async values => {
    setInlineValidationError(null); setShowServerError(false);
    try {
      const result = await createPlanMutation.mutateAsync(values);
      Toast.show({ type: 'success', position: 'top', text1: 'Plan oluşturuldu', text2: 'Plan detay ekranına yönlendiriliyorsunuz.' });
      if (result.id) { navigation.replace('PlanDetail', { planId: result.id }); return; }
      navigation.goBack();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const backendMessage = (error.response?.data as { error?: string; message?: string } | undefined)?.error || (error.response?.data as { error?: string; message?: string } | undefined)?.message;
        if (status === 400) { setInlineValidationError(backendMessage ?? 'Seçilen filtrelerle plan oluşturulamadı.'); return; }
        if (status && status >= 500) { setShowServerError(true); return; }
      }
      Toast.show({ type: 'error', position: 'top', text1: 'Plan oluşturulamadı', text2: 'Lütfen tekrar deneyin.' });
    }
  });

  const toggleInjury = (injury: Injury) => {
    const exists = selectedInjuries.includes(injury);
    setValue('injuries', exists ? selectedInjuries.filter(i => i !== injury) : [...selectedInjuries, injury], { shouldValidate: true });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seviye Seçimi</Text>
          <View style={styles.levelGrid}>
            {levelOptions.map(level => {
              const selected = selectedLevel === level.key;
              const cardContent = (<>
                <MaterialCommunityIcons name={level.icon as never} size={32} color={selected ? colors.textOnPrimary : colors.textSecondary} />
                <Text style={[styles.levelTitle, selected ? styles.levelTitleSelected : styles.levelTitleUnselected]}>{level.label}</Text>
              </>);
              return (
                <Touchable key={level.key} onPress={() => setValue('level', level.key, { shouldValidate: true })} style={[styles.levelCardPressable, selected && styles.levelCardPressableSelected]} borderRadius={radius.lg} accessibilityRole="button" accessibilityLabel={`${level.label} seviye seç`}>
                  {selected ? (
                    <LinearGradient colors={level.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.levelCard, styles.levelCardSelected]}>{cardContent}</LinearGradient>
                  ) : (
                    <View style={[styles.levelCard, styles.levelCardUnselected]}>{cardContent}</View>
                  )}
                </Touchable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Süre</Text>
          <FlatList horizontal data={durationOptions} keyExtractor={item => `duration-${item}`} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationList}
            renderItem={({ item }) => (
              <Touchable onPress={() => setValue('duration', item, { shouldValidate: true })} style={[styles.durationChip, item === selectedDuration ? styles.durationChipSelected : styles.durationChipUnselected]} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel={`${item} dakika seç`}>
                <Text style={[styles.durationChipText, item === selectedDuration ? styles.durationChipTextSelected : styles.durationChipTextUnselected]}>{item}dk</Text>
              </Touchable>
            )}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Odak Alanı</Text>
          <View style={styles.chipWrap}>
            {focusOptions.map(focus => (
              <Touchable key={focus.key} onPress={() => setValue('focus_area', focus.key, { shouldValidate: true })} style={[styles.focusChip, selectedFocus === focus.key ? styles.focusChipSelected : styles.focusChipUnselected]} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel={`${focus.label} odak alanı seç`}>
                <Text style={[styles.focusChipText, selectedFocus === focus.key ? styles.focusChipTextSelected : styles.focusChipTextUnselected]}>{focus.label}</Text>
              </Touchable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sakatlıklarınız (varsa)</Text>
          <View style={styles.chipWrap}>
            {injuryOptions.map(injury => (
              <Touchable key={injury.key} onPress={() => toggleInjury(injury.key)} style={[styles.injuryChip, selectedInjuries.includes(injury.key) ? styles.injuryChipSelected : styles.injuryChipUnselected]} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel={`${injury.label} sakatlık seç`}>
                <Text style={[styles.injuryChipText, selectedInjuries.includes(injury.key) ? styles.injuryChipTextSelected : styles.injuryChipTextUnselected]}>{injury.label}</Text>
              </Touchable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dil</Text>
          <View style={styles.languageRow}>
            {languageOptions.map(language => (
              <Button key={language.key} title={language.label} onPress={() => setValue('language', language.key, { shouldValidate: true })} variant={selectedLanguage === language.key ? 'primary' : 'outline'} size="md" fullWidth accessibilityLabel={`${language.label} seç`} />
            ))}
          </View>
        </View>

        {inlineValidationError ? (
          <View style={styles.inlineErrorCard}>
            <View style={styles.inlineErrorHeader}>
              <MaterialCommunityIcons name="alert-circle" size={20} color={colors.error} />
              <Text style={styles.inlineErrorTitle}>Plan oluşturma hatası</Text>
            </View>
            <Text style={styles.inlineErrorText}>{inlineValidationError}</Text>
            <Text style={styles.inlineSuggestion}>{inlineSuggestion}</Text>
          </View>
        ) : null}

        {showServerError ? (
          <View style={styles.serverErrorWrap}>
            <ErrorView type="server" title="Plan oluşturulamadı" description="AI servisinde geçici bir sorun oluştu." onRetry={() => { void onSubmit(); }} />
          </View>
        ) : null}

        <Controller control={control} name="level" render={() => (
          <Button title="AI ile plan oluştur" onPress={onSubmit} variant="primary" size="lg" loading={createPlanMutation.isPending} disabled={createPlanMutation.isPending} fullWidth accessibilityLabel="AI ile plan oluştur" />
        )} />
      </ScrollView>

      {createPlanMutation.isPending ? (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Animated.View style={[styles.overlayIconWrap, pulseAnimatedStyle]}>
              <MaterialCommunityIcons name="yoga" size={80} color={colors.primary} />
            </Animated.View>
            <Text style={styles.overlayTitle}>AI planınızı oluşturuyor...</Text>
            <Text style={styles.overlaySubtitle}>Bu 10-30 saniye sürebilir</Text>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.base, paddingBottom: spacing.xxxl, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.h4, color: colors.text },
  levelGrid: { flexDirection: 'row', gap: spacing.md },
  levelCardPressable: { flex: 1, borderRadius: radius.lg },
  levelCardPressableSelected: { transform: [{ scale: 1.02 }] },
  levelCard: { ...cardStyle, flex: 1, minHeight: 132, padding: spacing.base, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  levelCardSelected: { borderWidth: 1, borderColor: colors.borderLight },
  levelCardUnselected: { borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.surfaceElevated },
  levelTitle: { ...typography.bodySmMedium },
  levelTitleSelected: { color: colors.textOnPrimary },
  levelTitleUnselected: { color: colors.textSecondary },
  durationList: { paddingHorizontal: spacing.base, gap: spacing.sm },
  durationChip: { height: 38, paddingHorizontal: spacing.lg, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  durationChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  durationChipUnselected: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight },
  durationChipText: { ...typography.bodySmMedium },
  durationChipTextSelected: { color: colors.textOnPrimary },
  durationChipTextUnselected: { color: colors.textSecondary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  focusChip: { height: 38, paddingHorizontal: spacing.base, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  focusChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  focusChipUnselected: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight },
  focusChipText: { ...typography.bodySmMedium },
  focusChipTextSelected: { color: colors.textOnPrimary },
  focusChipTextUnselected: { color: colors.textSecondary },
  injuryChip: { height: 38, paddingHorizontal: spacing.base, borderRadius: radius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  injuryChipSelected: { backgroundColor: '#FFF3E0', borderColor: colors.warning },
  injuryChipUnselected: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight },
  injuryChipText: { ...typography.bodySmMedium },
  injuryChipTextSelected: { color: '#E65100' },
  injuryChipTextUnselected: { color: colors.textSecondary },
  languageRow: { flexDirection: 'row', gap: spacing.sm },
  inlineErrorCard: { backgroundColor: '#FF3B300D', borderColor: '#FF3B3033', borderWidth: 1, borderRadius: radius.md, padding: spacing.base },
  inlineErrorHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  inlineErrorTitle: { ...typography.bodySmMedium, color: colors.error },
  inlineErrorText: { ...typography.bodySm, color: colors.text },
  inlineSuggestion: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  serverErrorWrap: { marginBottom: spacing.sm },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(16,16,16,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  overlayCard: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, alignItems: 'center', justifyContent: 'center', minWidth: 280 },
  overlayIconWrap: { width: 96, height: 96, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.base },
  overlayTitle: { ...typography.h4, color: colors.text, marginBottom: spacing.xs },
  overlaySubtitle: { ...typography.bodySm, color: colors.textSecondary, textAlign: 'center' },
});

export default CreatePlanScreen;
