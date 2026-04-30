import React, { useEffect, useLayoutEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useProfile, useUpdateProfile } from '@/features/profile/hooks/useProfile';
import Button from '@/shared/components/Button';
import Chip from '@/shared/components/Chip';
import ErrorView from '@/shared/components/ErrorView';
import Input from '@/shared/components/Input';
import LoadingView from '@/shared/components/LoadingView';
import Touchable from '@/shared/components/Touchable';
import type { Goal, Profile } from '@/shared/types/profile';
import type { AppLanguage, Injury, Level } from '@/shared/types/plan';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

interface ProfileFormValues {
  display_name: string;
  age: number;
  level: Level;
  goals: Goal[];
  injuries: Injury[];
  preferred_language: AppLanguage;
  gender: Profile['gender'];
}

const levelOptions: { key: Level; label: string; icon: string }[] = [
  { key: 'beginner', label: 'Başlangıç', icon: 'leaf' },
  { key: 'intermediate', label: 'Orta', icon: 'tree' },
  { key: 'advanced', label: 'İleri', icon: 'fire' },
];

const goalOptions: { key: Goal; label: string }[] = [
  { key: 'flexibility', label: 'Esneklik' }, { key: 'strength', label: 'Güç' }, { key: 'balance', label: 'Denge' },
  { key: 'stress_relief', label: 'Stres Azaltma' }, { key: 'mobility', label: 'Kilo' }, { key: 'posture', label: 'Meditasyon' },
];

const injuryOptions: { key: Injury; label: string }[] = [
  { key: 'knee_injury', label: 'Diz' }, { key: 'ankle_injury', label: 'Ayak Bileği' }, { key: 'herniated_disc', label: 'Bel Fıtığı' },
  { key: 'low_back_pain', label: 'Bel' }, { key: 'shoulder_injury', label: 'Omuz' }, { key: 'wrist_injury', label: 'Bilek' },
  { key: 'neck_injury', label: 'Boyun' }, { key: 'groin_injury', label: 'Kasık' }, { key: 'hip_injury', label: 'Kalça' },
];

const languageOptions: { key: AppLanguage; label: string }[] = [{ key: 'tr', label: 'TR' }, { key: 'en', label: 'EN' }];

const EditProfileScreen = ({ navigation }: Props) => {
  const profileQuery = useProfile();
  const updateMutation = useUpdateProfile();

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProfileFormValues>({
    defaultValues: { display_name: '', age: 18, level: 'beginner', goals: [], injuries: [], preferred_language: 'tr', gender: 'prefer_not_to_say' },
  });

  const selectedLevel = watch('level');
  const selectedGoals = watch('goals');
  const selectedInjuries = watch('injuries');
  const selectedLanguage = watch('preferred_language');

  useEffect(() => {
    if (!profileQuery.data) return;
    reset({
      display_name: profileQuery.data.display_name,
      age: profileQuery.data.age,
      gender: profileQuery.data.gender,
      level: profileQuery.data.level,
      goals: profileQuery.data.goals,
      injuries: profileQuery.data.injuries,
      preferred_language: profileQuery.data.preferred_language,
    });
  }, [profileQuery.data, reset]);

  const onSubmit = handleSubmit(async values => {
    try {
      await updateMutation.mutateAsync(values);
      Toast.show({ type: 'success', position: 'top', text1: 'Profil Güncellendi', text2: 'Değişiklikleriniz kaydedildi.' });
      navigation.goBack();
    } catch {
      Toast.show({ type: 'error', position: 'top', text1: 'Kaydetme Başarısız', text2: 'Lütfen tekrar deneyin.' });
    }
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Touchable onPress={onSubmit} disabled={updateMutation.isPending} borderRadius={radius.md} accessibilityRole="button" accessibilityLabel="Profili kaydet">
          <Text style={styles.headerSave}>Kaydet</Text>
        </Touchable>
      ),
    });
  }, [navigation, onSubmit, updateMutation.isPending]);

  if (profileQuery.isLoading) return (<SafeAreaView style={styles.safeArea}><StatusBar barStyle="dark-content" backgroundColor={colors.background} /><LoadingView message="Profil bilgileri yükleniyor..." fullScreen /></SafeAreaView>);

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorWrap}><ErrorView type="generic" title="Profil bilgisi alınamadı" description="Lütfen tekrar deneyin." onRetry={() => { void profileQuery.refetch(); }} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Controller name="display_name" control={control}
            rules={{ required: 'Ad Soyad zorunlu', minLength: { value: 2, message: 'Minimum 2 karakter' } }}
            render={({ field: { value, onChange } }) => (
              <Input label="Ad Soyad" placeholder="Ad Soyad" value={value} onChangeText={onChange} error={errors.display_name?.message} icon="account-outline" autoCapitalize="words" accessibilityLabel="Ad Soyad" />
            )} />

          <Controller name="age" control={control}
            rules={{ min: { value: 5, message: 'Geçerli bir yaş girin' }, max: { value: 120, message: 'Geçerli bir yaş girin' } }}
            render={({ field: { value, onChange } }) => (
              <Input label="Yaş" placeholder="Yaş" value={`${value ?? ''}`} onChangeText={text => onChange(Number(text.replace(/[^0-9]/g, '')) || 0)} error={errors.age?.message} icon="calendar-account-outline" keyboardType="number-pad" accessibilityLabel="Yaş" />
            )} />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seviye</Text>
            <View style={styles.levelGrid}>
              {levelOptions.map(level => {
                const selected = selectedLevel === level.key;
                return (
                  <Touchable key={level.key} onPress={() => setValue('level', level.key, { shouldValidate: true })} style={[styles.levelCard, selected && styles.levelCardSelected]} borderRadius={radius.lg} accessibilityRole="button" accessibilityLabel={`${level.label} seviye seç`}>
                    <MaterialCommunityIcons name={level.icon as never} size={22} color={selected ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.levelLabel, selected && styles.levelLabelSelected]}>{level.label}</Text>
                  </Touchable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hedefler</Text>
            <View style={styles.chipWrap}>
              {goalOptions.map(goal => (
                <Chip key={goal.key} label={goal.label} selected={selectedGoals.includes(goal.key)}
                  onPress={() => { const next = selectedGoals.includes(goal.key) ? selectedGoals.filter(item => item !== goal.key) : [...selectedGoals, goal.key]; setValue('goals', next, { shouldValidate: true }); }} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sakatlıklar</Text>
            <View style={styles.chipWrap}>
              {injuryOptions.map(injury => (
                <Chip key={injury.key} label={injury.label} selected={selectedInjuries.includes(injury.key)} tone="warning"
                  onPress={() => { const next = selectedInjuries.includes(injury.key) ? selectedInjuries.filter(item => item !== injury.key) : [...selectedInjuries, injury.key]; setValue('injuries', next, { shouldValidate: true }); }} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dil</Text>
            <View style={styles.languageRow}>
              {languageOptions.map(language => (
                <Button key={language.key} title={language.label} onPress={() => setValue('preferred_language', language.key, { shouldValidate: true })} variant={selectedLanguage === language.key ? 'primary' : 'outline'} size="md" fullWidth accessibilityLabel={`${language.label} dil seç`} />
              ))}
            </View>
          </View>

          <Button title="Kaydet" onPress={onSubmit} variant="primary" size="lg" loading={updateMutation.isPending} disabled={updateMutation.isPending} fullWidth accessibilityLabel="Profili kaydet" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardAvoid: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.base, paddingBottom: spacing.xxl, gap: spacing.base },
  errorWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.base },
  headerSave: { ...typography.bodySmMedium, color: colors.primary },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.bodySmMedium, color: colors.text },
  levelGrid: { flexDirection: 'row', gap: spacing.sm },
  levelCard: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', gap: spacing.xs },
  levelCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  levelLabel: { ...typography.captionMedium, color: colors.textSecondary },
  levelLabelSelected: { color: colors.primaryDark },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  languageRow: { flexDirection: 'row', gap: spacing.sm },
});

export default EditProfileScreen;
