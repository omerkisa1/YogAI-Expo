import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCreateCustomPlan } from '@/features/plans/hooks/useCreateCustomPlan';
import { useAllPoses } from '@/features/pose/hooks/useAllPoses';
import { useProfile } from '@/features/profile/hooks/useProfile';
import Button from '@/shared/components/Button';
import Touchable from '@/shared/components/Touchable';
import { domainsCompatible, mixDomainErrorMessage, posePlanDomain } from '@/lib/poseDomain';
import type { Pose } from '@/shared/types/pose';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCustomPlan'>;

interface SelectedPose {
  pose: Pose;
  duration_min: number;
}

type CategoryFilter = 'all' | 'standing' | 'seated' | 'prone' | 'supine' | 'inversion';

const CATEGORY_OPTIONS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'standing', label: 'Ayakta' },
  { key: 'seated', label: 'Oturarak' },
  { key: 'prone', label: 'Yüzüstü' },
  { key: 'supine', label: 'Sırtüstü' },
  { key: 'inversion', label: 'Ters' },
];

const CATEGORY_COLOR: Record<string, string> = {
  standing: colors.categoryStanding,
  seated: colors.categorySeated,
  prone: colors.categoryProne,
  supine: colors.categorySupine,
  inversion: colors.categoryInversion,
};

const INJURY_CONTRAINDICATIONS: Record<string, string[]> = {
  knee_injury: ['knee_injury'],
  ankle_injury: ['ankle_injury'],
  herniated_disc: ['herniated_disc'],
  low_back_pain: ['low_back_pain'],
  shoulder_injury: ['shoulder_injury'],
  wrist_injury: ['wrist_injury'],
  neck_injury: ['neck_injury'],
  groin_injury: ['groin_injury'],
  hip_injury: ['hip_injury'],
};

const CreateCustomPlanScreen = ({ route, navigation }: Props) => {
  const profileQuery = useProfile();
  const locale = profileQuery.data?.preferred_language ?? 'tr';
  const injuries = (profileQuery.data?.injuries ?? []) as string[];
  const createMutation = useCreateCustomPlan();

  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [selected, setSelected] = useState<Map<string, SelectedPose>>(new Map());
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  const posesQuery = useAllPoses({ requireFocus: false });

  // addPoseId param — PoseDetailScreen'den gelen tek poz ön seçimi
  const handledAddPoseRef = useRef<string | null>(null);
  useEffect(() => {
    const addPoseId = route.params?.addPoseId;
    if (!addPoseId || addPoseId === handledAddPoseRef.current) return;
    handledAddPoseRef.current = addPoseId;
    const pose = (posesQuery.data ?? []).find(p => p.pose_id === addPoseId);
    if (!pose) return;
    setSelected(prev => {
      if (prev.has(addPoseId)) return prev;
      const next = new Map(prev);
      next.set(addPoseId, { pose, duration_min: 3 });
      return next;
    });
  }, [route.params?.addPoseId, posesQuery.data]);

  const filteredPoses = useMemo(() => {
    const all = (posesQuery.data ?? []).filter(p => !p.pose_id.startsWith('test_'));
    return all.filter(p => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.name_tr.toLowerCase().includes(q) && !p.name_en.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [posesQuery.data, activeCategory, search]);

  const togglePose = useCallback((pose: Pose) => {
    setSelected(prev => {
      const next = new Map(prev);
      if (next.has(pose.pose_id)) {
        next.delete(pose.pose_id);
        return next;
      }
      const incoming = posePlanDomain(pose);
      if (prev.size > 0) {
        const first = prev.values().next().value?.pose;
        if (first && !domainsCompatible(posePlanDomain(first), incoming)) {
          Toast.show({ type: 'error', text1: mixDomainErrorMessage() });
          return prev;
        }
      }
      next.set(pose.pose_id, { pose, duration_min: 3 });
      return next;
    });
  }, []);

  const updateDuration = useCallback((poseId: string, delta: number) => {
    setSelected(prev => {
      const entry = prev.get(poseId);
      if (!entry) return prev;
      const next = new Map(prev);
      next.set(poseId, { ...entry, duration_min: Math.max(1, Math.min(10, entry.duration_min + delta)) });
      return next;
    });
  }, []);

  const selectedList = useMemo(() => [...selected.values()], [selected]);
  const totalDuration = useMemo(() => selectedList.reduce((s, e) => s + e.duration_min, 0), [selectedList]);

  const injurySet = useMemo(
    () => new Set(injuries.flatMap(inj => INJURY_CONTRAINDICATIONS[inj] ?? [inj])),
    [injuries],
  );

  const warnings = useMemo(() => {
    if (!injurySet.size) return [];
    return selectedList
      .filter(e => e.pose.contraindications?.some(ci => injurySet.has(ci)))
      .map(e => `"${locale === 'tr' ? e.pose.name_tr : e.pose.name_en}" dikkat gerektirebilir`);
  }, [selectedList, injurySet, locale]);

  const handleSave = async () => {
    if (title.trim().length === 0) {
      setTitleTouched(true);
      Toast.show({ type: 'info', text1: 'Antrenman adı gerekli', text2: 'Lütfen bir isim girin.' });
      return;
    }
    if (selectedList.length === 0) {
      Toast.show({ type: 'info', text1: 'Hareket seçilmedi', text2: 'En az 1 hareket seçin.' });
      return;
    }
    if (createMutation.isPending) return;

    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        exercises: selectedList.map(e => ({ pose_id: e.pose.pose_id, duration_min: e.duration_min })),
      });
      Toast.show({ type: 'success', text1: 'Antrenman kaydedildi!', text2: 'Planlarım bölümünde görünecek.' });
      navigation.navigate('MainTabs', { screen: 'Explore' });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 400) {
        Toast.show({ type: 'error', text1: 'Geçersiz hareket', text2: 'Seçilen pozlardan biri katalogda bulunamadı.' });
      } else {
        Toast.show({ type: 'error', text1: 'Kayıt başarısız', text2: 'Lütfen tekrar deneyin.' });
      }
    }
  };

  const renderItem = useCallback(({ item }: { item: Pose }) => {
    const isSelected = selected.has(item.pose_id);
    const entry = selected.get(item.pose_id);
    const accentColor = CATEGORY_COLOR[item.category] ?? colors.textMuted;
    const name = locale === 'tr' ? (item.name_tr || item.name_en) : (item.name_en || item.name_tr);
    return (
      <Touchable
        onPress={() => togglePose(item)}
        style={[styles.poseRow, isSelected && styles.poseRowSelected]}
        borderRadius={radius.lg}
      >
        <View style={[styles.poseAccent, { backgroundColor: accentColor }]} />
        <View style={styles.poseInfo}>
          <Text style={styles.poseName} numberOfLines={1}>{name}</Text>
          <Text style={styles.poseMeta}>
            {item.target_area}
            {item.is_analyzable ? '  ·  Analiz' : ''}
          </Text>
        </View>
        {isSelected && entry ? (
          <View style={styles.stepper}>
            <Touchable
              onPress={() => updateDuration(item.pose_id, -1)}
              style={styles.stepperBtn}
              borderRadius={radius.sm}
            >
              <MaterialCommunityIcons name="minus" size={14} color={colors.primary} />
            </Touchable>
            <Text style={styles.stepperVal}>{entry.duration_min}dk</Text>
            <Touchable
              onPress={() => updateDuration(item.pose_id, 1)}
              style={styles.stepperBtn}
              borderRadius={radius.sm}
            >
              <MaterialCommunityIcons name="plus" size={14} color={colors.primary} />
            </Touchable>
          </View>
        ) : null}
        <MaterialCommunityIcons
          name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
          size={22}
          color={isSelected ? colors.primary : colors.textMuted}
          style={styles.checkbox}
        />
      </Touchable>
    );
  }, [selected, locale, togglePose, updateDuration]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <Touchable onPress={() => navigation.goBack()} style={styles.backBtn} borderRadius={radius.full}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={colors.primary} />
          </Touchable>
          <Text style={styles.headerTitle}>Özel Antrenman</Text>
          <View style={{ width: 40 }} />
        </View>

        <FlatList
          data={filteredPoses}
          keyExtractor={p => p.pose_id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          ListHeaderComponent={

            <View style={styles.listHeader}>
              {/* Plan adı */}
              <Text style={styles.fieldLabel}>Antrenman Adı</Text>
              <TextInput
                style={[styles.titleInput, titleTouched && title.trim().length === 0 && styles.titleInputError]}
                placeholder="Örn. Sabah Rutinim"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
                onBlur={() => setTitleTouched(true)}
                returnKeyType="done"
                maxLength={60}
              />
              {titleTouched && title.trim().length === 0 ? (
                <Text style={styles.fieldError}>Antrenman adı boş bırakılamaz</Text>
              ) : null}

              {/* Özet (seçim varsa) */}
              {selectedList.length > 0 ? (
                <View style={styles.summaryBanner}>
                  <MaterialCommunityIcons name="check-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.summaryText}>
                    {selectedList.length} hareket · {totalDuration} dk
                  </Text>
                  {warnings.length > 0 ? (
                    <View style={styles.warnBadge}>
                      <MaterialCommunityIcons name="alert-outline" size={14} color={colors.warning} />
                      <Text style={styles.warnBadgeText}>{warnings.length} uyarı</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {/* Arama */}
              <View style={styles.searchRow}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={locale === 'tr' ? 'Hareket ara...' : 'Search poses...'}
                  placeholderTextColor={colors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  clearButtonMode="while-editing"
                />
              </View>

              {/* Kategori filtresi */}
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={CATEGORY_OPTIONS}
                keyExtractor={o => o.key}
                contentContainerStyle={styles.filterRow}
                renderItem={({ item }) => (
                  <Touchable
                    onPress={() => setActiveCategory(item.key)}
                    borderRadius={radius.full}
                    style={[styles.chip, activeCategory === item.key && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, activeCategory === item.key && styles.chipTextActive]}>
                      {item.label}
                    </Text>
                  </Touchable>
                )}
              />

              <Text style={styles.countLabel}>
                {filteredPoses.length} hareket
                {selectedList.length > 0 ? ` · ${selectedList.length} seçili` : ''}
              </Text>
            </View>
          }
        />

        {/* Floating save button — her zaman ekranın altında sabit */}
        <View style={styles.floatingBar}>
          {warnings.length > 0 ? (
            <View style={styles.warningCard}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.warning} />
              <View style={{ flex: 1 }}>
                {warnings.map((w, i) => (
                  <Text key={i} style={styles.warningText}>{w}</Text>
                ))}
              </View>
            </View>
          ) : null}
          <Button
            title={locale === 'tr' ? 'Antrenmanı Kaydet' : 'Save Plan'}
            onPress={() => void handleSave()}
            variant="primary"
            size="lg"
            fullWidth
            icon="check"
            loading={createMutation.isPending}
            disabled={createMutation.isPending}
            accessibilityLabel="Antrenmanı kaydet"
          />
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    backgroundColor: colors.background,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...typography.h4, color: colors.text },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: 120 },
  listHeader: { paddingTop: spacing.base, gap: spacing.sm, marginBottom: spacing.sm },
  fieldLabel: { ...typography.bodySmMedium, color: colors.textSecondary },
  titleInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.base,
    height: 50,
  },
  titleInputError: { borderColor: colors.error },
  fieldError: { ...typography.caption, color: colors.error },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  summaryText: { ...typography.bodySmMedium, color: colors.primaryDark, flex: 1 },
  warnBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  warnBadgeText: { ...typography.caption, color: colors.warning },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    height: 42,
  },
  searchInput: { flex: 1, ...typography.bodySm, color: colors.text, height: 42 },
  filterRow: { gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.bodySmMedium, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  countLabel: { ...typography.caption, color: colors.textMuted },
  poseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    minHeight: 60,
  },
  poseRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  poseAccent: { width: 4, alignSelf: 'stretch' },
  poseInfo: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: 2 },
  poseName: { ...typography.bodySmMedium, color: colors.text },
  poseMeta: { ...typography.caption, color: colors.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: spacing.xs },
  stepperBtn: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: { ...typography.captionMedium, color: colors.text, minWidth: 28, textAlign: 'center' },
  checkbox: { marginRight: spacing.sm },
  floatingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning + '40',
    padding: spacing.base,
  },
  warningText: { ...typography.caption, color: colors.warningDark },
});

export default CreateCustomPlanScreen;
