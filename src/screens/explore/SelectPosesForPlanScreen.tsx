import React, { useMemo, useState } from 'react';
import {
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useProfile } from '@/features/profile/hooks/useProfile';
import api from '@/shared/api/axiosInstance';
import Button from '@/shared/components/Button';
import EmptyState from '@/shared/components/EmptyState';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import Touchable from '@/shared/components/Touchable';
import type { Pose } from '@/shared/types/pose';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectPosesForPlan'>;

type CategoryFilter = 'all' | 'standing' | 'seated' | 'prone' | 'supine' | 'inversion';

const categoryOptions: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'standing', label: 'Ayakta' },
  { key: 'seated', label: 'Oturarak' },
  { key: 'prone', label: 'Yüzüstü' },
  { key: 'supine', label: 'Sırtüstü' },
  { key: 'inversion', label: 'Ters' },
];

const categoryColorMap: Record<string, string> = {
  standing: colors.categoryStanding,
  seated: colors.categorySeated,
  prone: colors.categoryProne,
  supine: colors.categorySupine,
  inversion: colors.categoryInversion,
};

type ApiWrapper<T> = { status: number; message: string; data: T };

const SelectPosesForPlanScreen = ({ route, navigation }: Props) => {
  const { currentPoseIds } = route.params;
  const profileQuery = useProfile();
  const locale = profileQuery.data?.preferred_language ?? 'tr';

  const [selected, setSelected] = useState<Set<string>>(new Set(currentPoseIds));
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  const posesQuery = useQuery<Pose[]>({
    queryKey: ['all-poses'],
    queryFn: () =>
      api.get<ApiWrapper<Pose[]>>('/api/v1/yoga/poses').then(r => r.data.data ?? []),
    staleTime: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const poses = (posesQuery.data ?? []).filter(p => !p.pose_id.startsWith('test_'));
    return poses.filter(p => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.name_tr.toLowerCase().includes(q) && !p.name_en.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [posesQuery.data, activeCategory, search]);

  const newlyAdded = useMemo(
    () => [...selected].filter(id => !currentPoseIds.includes(id)).length,
    [selected, currentPoseIds],
  );

  const toggle = (poseId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(poseId)) next.delete(poseId);
      else next.add(poseId);
      return next;
    });
  };

  const handleConfirm = () => {
    const newIds = [...selected].filter(id => !currentPoseIds.includes(id));
    navigation.navigate('CreateCustomPlan', {
      selectedPoseIds: newIds.length > 0 ? newIds : undefined,
    });
  };

  if (posesQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.skeletonWrap}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLoader key={`sk-${i}`} width="100%" height={70} borderRadius={radius.lg} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <View style={styles.container}>
        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={locale === 'tr' ? 'Hareket ara...' : 'Search poses...'}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categoryOptions}
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
          {filtered.length} hareket · {selected.size} seçili
        </Text>

        <FlatList
          data={filtered}
          keyExtractor={p => p.pose_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isSelected = selected.has(item.pose_id);
            const isAlreadyInPlan = currentPoseIds.includes(item.pose_id);
            const accentColor = categoryColorMap[item.category] ?? colors.textMuted;
            const name = locale === 'tr' ? (item.name_tr || item.name_en) : (item.name_en || item.name_tr);
            return (
              <Touchable
                onPress={() => toggle(item.pose_id)}
                style={[styles.poseRow, isSelected && styles.poseRowSelected]}
                borderRadius={radius.lg}
              >
                <View style={[styles.poseAccent, { backgroundColor: accentColor }]} />
                <View style={styles.poseInfo}>
                  <Text style={styles.poseName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.poseMeta}>
                    {item.target_area}
                    {item.is_analyzable ? '  ·  Analiz' : ''}
                    {isAlreadyInPlan ? '  ·  Zaten eklendi' : ''}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                  size={22}
                  color={isSelected ? colors.primary : colors.textMuted}
                />
              </Touchable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          ListEmptyComponent={
            <EmptyState
              icon="magnify"
              title="Hareket bulunamadı"
              description="Filtreleri değiştirmeyi deneyin"
            />
          }
        />

        <View style={styles.footer}>
          <Button
            title={
              newlyAdded > 0
                ? `${newlyAdded} Hareketi Ekle`
                : (locale === 'tr' ? 'Geri Dön' : 'Go Back')
            }
            onPress={handleConfirm}
            variant={newlyAdded > 0 ? 'primary' : 'outline'}
            size="lg"
            fullWidth
            icon={newlyAdded > 0 ? 'check' : 'chevron-left'}
            accessibilityLabel="Seçilenleri ekle"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  skeletonWrap: { padding: spacing.base, gap: spacing.sm },
  container: { flex: 1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    height: 44,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    height: 44,
  },
  filterRow: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
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
  countLabel: {
    ...typography.caption,
    color: colors.textMuted,
    paddingHorizontal: spacing.base,
    marginBottom: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
  },
  poseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    minHeight: 64,
  },
  poseRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  poseAccent: { width: 4, alignSelf: 'stretch' },
  poseInfo: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.base, gap: 2 },
  poseName: { ...typography.bodySmMedium, color: colors.text },
  poseMeta: { ...typography.caption, color: colors.textMuted },
  footer: {
    padding: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.background,
  },
});

export default SelectPosesForPlanScreen;
