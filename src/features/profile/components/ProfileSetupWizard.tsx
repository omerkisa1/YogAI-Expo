import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import type { Profile } from '@/shared/types/profile';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useUpdateProfile } from '../hooks/useProfile';
import Button from '@/shared/components/Button';
import Input from '@/shared/components/Input';
import Touchable from '@/shared/components/Touchable';
import type { Goal } from '@/shared/types/profile';
import type { AppLanguage, Injury, Level } from '@/shared/types/plan';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { cardStyle } from '@/theme/shadows';
import { typography } from '@/theme/typography';

interface ProfileSetupWizardProps { profile: Profile; onCompleted?: () => void }

const levelCards: { key: Level; label: string; icon: string }[] = [
  { key: 'beginner', label: 'Başlangıç', icon: 'leaf' },
  { key: 'intermediate', label: 'Orta', icon: 'tree' },
  { key: 'advanced', label: 'İleri', icon: 'fire' },
];

const goals: { key: Goal; label: string }[] = [
  { key: 'flexibility', label: 'Esneklik' }, { key: 'strength', label: 'Güç' }, { key: 'balance', label: 'Denge' },
  { key: 'stress_relief', label: 'Stres Azaltma' }, { key: 'mobility', label: 'Kilo' }, { key: 'posture', label: 'Meditasyon' },
];

const injuries: { key: Injury; label: string }[] = [
  { key: 'knee_injury', label: 'Diz' }, { key: 'ankle_injury', label: 'Ayak Bileği' }, { key: 'herniated_disc', label: 'Bel Fıtığı' },
  { key: 'low_back_pain', label: 'Bel' }, { key: 'shoulder_injury', label: 'Omuz' }, { key: 'wrist_injury', label: 'Bilek' },
  { key: 'neck_injury', label: 'Boyun' }, { key: 'groin_injury', label: 'Kasık' }, { key: 'hip_injury', label: 'Kalça' },
];

const totalSteps = 5;

const getInitialStep = (p: Profile): number => {
  if (!p.level) return 0;
  if (!p.age) return 1;
  if (!p.goals || p.goals.length === 0) return 2;
  if (!p.preferred_language) return 4;
  return 0;
};

const ProfileSetupWizard = ({ profile, onCompleted }: ProfileSetupWizardProps) => {
  const updateProfileMutation = useUpdateProfile();
  const pagerRef = useRef<PagerView>(null);
  const initialStep = useMemo(() => getInitialStep(profile), [profile]);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [level, setLevel] = useState<Level>(profile.level ?? 'beginner');
  const [age, setAge] = useState(String(profile.age ?? ''));
  const [selectedGoals, setSelectedGoals] = useState<Goal[]>(profile.goals ?? []);
  const [selectedInjuries, setSelectedInjuries] = useState<Injury[]>(profile.injuries ?? []);
  const [language, setLanguage] = useState<AppLanguage>(profile.preferred_language ?? 'tr');

  const title = useMemo(() => `Profilinizi Tamamlayın ${currentStep + 1}/${totalSteps}`, [currentStep]);

  const toggleGoal = (goal: Goal) => { setSelectedGoals(prev => prev.includes(goal) ? prev.filter(i => i !== goal) : [...prev, goal]); };
  const toggleInjury = (injury: Injury) => { setSelectedInjuries(prev => prev.includes(injury) ? prev.filter(i => i !== injury) : [...prev, injury]); };

  const completeWizard = async () => {
    try {
      await updateProfileMutation.mutateAsync({ level, age: Number(age) || profile.age, goals: selectedGoals, injuries: selectedInjuries, preferred_language: language });
      Toast.show({ type: 'success', position: 'top', text1: 'Profil güncellendi', text2: 'Bilgileriniz başarıyla kaydedildi.' });
      onCompleted?.();
    } catch { Toast.show({ type: 'error', position: 'top', text1: 'Kaydetme Başarısız', text2: 'Lütfen tekrar deneyin.' }); }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.dotsRow}>
        {Array.from({ length: totalSteps }).map((_, index) => (
          <View key={`dot-${index}`} style={[styles.dot, index <= currentStep ? styles.dotActive : styles.dotInactive]} />
        ))}
      </View>

      <PagerView ref={pagerRef} style={styles.pager} initialPage={initialStep} onPageSelected={event => setCurrentStep(event.nativeEvent.position)}>
        <View key="level" style={styles.page}>
          <Text style={styles.question}>Seviyenizi seçin</Text>
          <View style={styles.levelRow}>
            {levelCards.map(option => {
              const selected = option.key === level;
              return (
                <Touchable key={option.key} onPress={() => setLevel(option.key)} borderRadius={radius.lg} style={[styles.levelCard, selected && styles.levelCardSelected]} accessibilityLabel={`${option.label} seviye`}>
                  <MaterialCommunityIcons name={option.icon as never} size={22} color={selected ? colors.textOnPrimary : colors.textSecondary} />
                  <Text style={[styles.levelText, selected && styles.levelTextSelected]}>{option.label}</Text>
                </Touchable>
              );
            })}
          </View>
        </View>

        <View key="age" style={styles.page}>
          <Text style={styles.question}>Yaşınızı girin</Text>
          <Input placeholder="Yaş" value={age} onChangeText={value => setAge(value.replace(/[^0-9]/g, ''))} icon="calendar-account-outline" keyboardType="number-pad" accessibilityLabel="Yaş" />
        </View>

        <View key="goals" style={styles.page}>
          <Text style={styles.question}>Hedefleriniz neler?</Text>
          <View style={styles.chipsWrap}>
            {goals.map(goal => {
              const selected = selectedGoals.includes(goal.key);
              return (
                <Touchable key={goal.key} onPress={() => toggleGoal(goal.key)} borderRadius={radius.full} style={[styles.chip, selected ? styles.chipPrimarySelected : styles.chipUnselected]}>
                  <Text style={[styles.chipLabel, selected ? styles.chipPrimaryLabel : styles.chipUnselectedLabel]}>{goal.label}</Text>
                </Touchable>
              );
            })}
          </View>
        </View>

        <View key="injuries" style={styles.page}>
          <Text style={styles.question}>Sakatlık durumunuz var mı?</Text>
          <View style={styles.chipsWrap}>
            {injuries.map(injury => {
              const selected = selectedInjuries.includes(injury.key);
              return (
                <Touchable key={injury.key} onPress={() => toggleInjury(injury.key)} borderRadius={radius.full} style={[styles.chip, selected ? styles.chipWarningSelected : styles.chipUnselected]}>
                  <Text style={[styles.chipLabel, selected ? styles.chipWarningLabel : styles.chipUnselectedLabel]}>{injury.label}</Text>
                </Touchable>
              );
            })}
          </View>
          <Touchable onPress={() => setSelectedInjuries([])} borderRadius={radius.md} style={styles.noInjuryButton}>
            <Text style={styles.noInjuryText}>Sakatlığım yok</Text>
          </Touchable>
        </View>

        <View key="language" style={styles.page}>
          <Text style={styles.question}>Dil tercihiniz</Text>
          <View style={styles.languageRow}>
            <Button title="TR" onPress={() => setLanguage('tr')} variant={language === 'tr' ? 'primary' : 'outline'} size="md" fullWidth />
            <Button title="EN" onPress={() => setLanguage('en')} variant={language === 'en' ? 'primary' : 'outline'} size="md" fullWidth />
          </View>
        </View>
      </PagerView>

      {currentStep === totalSteps - 1 && (
        <Button title="Tamamla" onPress={() => { void completeWizard(); }} variant="primary" size="lg" fullWidth loading={updateProfileMutation.isPending} disabled={updateProfileMutation.isPending} accessibilityLabel="Profili tamamla" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { ...cardStyle, borderRadius: radius.xl, padding: spacing.base, overflow: 'hidden', gap: spacing.sm },
  headerTitle: { ...typography.h4, color: colors.text },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  dotActive: { backgroundColor: colors.primary },
  dotInactive: { backgroundColor: colors.borderLight },
  pager: { height: 300 },
  page: { paddingTop: spacing.sm, gap: spacing.sm },
  question: { ...typography.bodySmMedium, color: colors.text },
  levelRow: { flexDirection: 'row', gap: spacing.sm },
  levelCard: { flex: 1, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.base, gap: spacing.xs },
  levelCardSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelText: { ...typography.captionMedium, color: colors.textSecondary },
  levelTextSelected: { color: colors.textOnPrimary },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { height: 36, paddingHorizontal: spacing.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipPrimarySelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipWarningSelected: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  chipUnselected: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight },
  chipLabel: { ...typography.caption },
  chipPrimaryLabel: { color: colors.primaryDark },
  chipWarningLabel: { color: colors.warningDark },
  chipUnselectedLabel: { color: colors.textSecondary },
  noInjuryButton: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  noInjuryText: { ...typography.caption, color: colors.warningDark },
  languageRow: { flexDirection: 'row', gap: spacing.sm },
});

export default ProfileSetupWizard;
