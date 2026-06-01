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
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAllPoses } from '@/features/pose/hooks/useAllPoses';
import { useProfile } from '@/features/profile/hooks/useProfile';
import EmptyState from '@/shared/components/EmptyState';
import ErrorView from '@/shared/components/ErrorView';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import Touchable from '@/shared/components/Touchable';
import { posePlanDomain } from '@/lib/poseDomain';
import type { Pose } from '@/shared/types/pose';
import type { RootStackParamList } from '@/navigation/types';
import { TAB_SCENE_BOTTOM_PADDING } from '@/navigation/tabBarMetrics';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

type CategoryFilter = 'all' | 'standing' | 'seated' | 'prone' | 'supine' | 'inversion';
type DomainFilter = 'all' | 'body' | 'face' | 'face_hand';
type DifficultyFilter = 0 | 1 | 2 | 3 | 4 | 5;

interface CategoryOption { key: CategoryFilter; label: string }
interface DifficultyOption { key: DifficultyFilter; label: string }

const categoryOptions: CategoryOption[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'standing', label: 'Ayakta' },
  { key: 'seated', label: 'Oturarak' },
  { key: 'prone', label: 'Yüzüstü' },
  { key: 'supine', label: 'Sırtüstü' },
  { key: 'inversion', label: 'Ters' },
];

const domainOptions: { key: DomainFilter; labelTr: string; labelEn: string }[] = [
  { key: 'all', labelTr: 'Tümü', labelEn: 'All' },
  { key: 'body', labelTr: 'Vücut', labelEn: 'Body' },
  { key: 'face', labelTr: 'Yüz', labelEn: 'Face' },
  { key: 'face_hand', labelTr: 'Elle Yüz', labelEn: 'Face + Hand' },
];

const difficultyOptions: DifficultyOption[] = [
  { key: 0, label: 'Tümü' },
  { key: 1, label: '1' },
  { key: 2, label: '2' },
  { key: 3, label: '3' },
  { key: 4, label: '4' },
  { key: 5, label: '5' },
];

const categoryColorMap: Record<string, string> = {
  standing: colors.categoryStanding,
  seated: colors.categorySeated,
  prone: colors.categoryProne,
  supine: colors.categorySupine,
  inversion: colors.categoryInversion,
};

const categoryLabelMap: Record<string, string> = {
  standing: 'Ayakta',
  seated: 'Oturarak',
  prone: 'Yüzüstü',
  supine: 'Sırtüstü',
  inversion: 'Ters',
};

const difficultyColor = [
  colors.textMuted,
  colors.difficulty1,
  colors.difficulty2,
  colors.difficulty3,
  colors.difficulty4,
  colors.difficulty5,
];

function DifficultyDots({ level }: { level: number }) {
  return (
    <View style={styles.dots}>
      {[1, 2, 3, 4, 5].map(i => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i <= level ? difficultyColor[level] : colors.borderLight },
          ]}
        />
      ))}
    </View>
  );
}

function PoseLibraryCard({ pose, locale, onPress }: { pose: Pose; locale: string; onPress: () => void }) {
  const categoryColor = categoryColorMap[pose.category] ?? colors.textMuted;
  const categoryLabel = categoryLabelMap[pose.category] ?? pose.category;
  const poseName = locale === 'tr' ? (pose.name_tr || pose.name_en) : (pose.name_en || pose.name_tr);
  const instructions = locale === 'tr'
    ? (pose.instructions_tr || pose.instructions_en)
    : (pose.instructions_en || pose.instructions_tr);

  return (
    <Touchable onPress={onPress} style={styles.card} borderRadius={radius.lg}>
      <View style={[styles.cardAccent, { backgroundColor: categoryColor }]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName} numberOfLines={1}>{poseName}</Text>
          <DifficultyDots level={pose.difficulty} />
        </View>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: categoryColor + '20' }]}>
            <Text style={[styles.badgeText, { color: categoryColor }]}>{categoryLabel}</Text>
          </View>
          {pose.target_area ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pose.target_area}</Text>
            </View>
          ) : null}
          {pose.is_analyzable ? (
            <View style={[styles.badge, styles.badgeAnalyzable]}>
              <MaterialCommunityIcons name="camera" size={11} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>Analiz</Text>
            </View>
          ) : null}
        </View>
        {instructions ? (
          <Text style={styles.cardInstructions} numberOfLines={2}>{instructions}</Text>
        ) : null}
      </View>
    </Touchable>
  );
}

const ExploreScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const profileQuery = useProfile();
  const locale = profileQuery.data?.preferred_language ?? 'tr';

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [activeDomain, setActiveDomain] = useState<DomainFilter>('all');
  const [activeDifficulty, setActiveDifficulty] = useState<DifficultyFilter>(0);

  const posesQuery = useAllPoses();

  const filteredPoses = useMemo(() => {
    const poses = posesQuery.data ?? [];
    return poses.filter(p => {
      if (activeDomain !== 'all') {
        const kind = p.analysis_kind ?? (posePlanDomain(p) === 'face' ? 'face' : 'body');
        if (activeDomain === 'body' && kind !== 'body') return false;
        if (activeDomain === 'face' && kind !== 'face') return false;
        if (activeDomain === 'face_hand' && kind !== 'face_hand') return false;
      }
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (activeDifficulty !== 0 && p.difficulty !== activeDifficulty) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!p.name_tr.toLowerCase().includes(q) && !p.name_en.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [posesQuery.data, activeCategory, activeDomain, activeDifficulty, search]);

  const visiblePoses = useMemo(
    () => filteredPoses.filter(p => !p.pose_id.startsWith('test_')),
    [filteredPoses],
  );

  if (posesQuery.isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.skeletonWrap}>
          <Text style={styles.headerTitle}>Keşfet</Text>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonLoader key={`sk-${i}`} width="100%" height={100} borderRadius={radius.lg} />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  if (posesQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <ErrorView
          type="generic"
          title="Hareketler yüklenemedi"
          description="Lütfen tekrar deneyin."
          onRetry={() => void posesQuery.refetch()}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

      <FlatList
        data={visiblePoses}
        keyExtractor={item => item.pose_id}
        contentContainerStyle={[styles.listContent, { paddingBottom: TAB_SCENE_BOTTOM_PADDING + spacing.xxl }]}
        ListHeaderComponent={
          <View>
            <View style={styles.topRow}>
              <Text style={styles.headerTitle}>Keşfet</Text>
              <Touchable
                style={styles.fab}
                onPress={() => navigation.navigate('CreateCustomPlan', undefined)}
                borderRadius={radius.full}
              >
                <LinearGradient colors={colors.gradientPrimary} style={styles.fabGradient}>
                  <MaterialCommunityIcons name="plus" size={22} color="white" />
                </LinearGradient>
              </Touchable>
            </View>

            <View style={styles.searchWrap}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} style={styles.searchIcon} />
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
              data={domainOptions}
              keyExtractor={o => o.key}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item }) => (
                <Touchable
                  onPress={() => setActiveDomain(item.key)}
                  borderRadius={radius.full}
                  style={[styles.chip, activeDomain === item.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, activeDomain === item.key && styles.chipTextActive]}>
                    {locale === 'tr' ? item.labelTr : item.labelEn}
                  </Text>
                </Touchable>
              )}
            />

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

            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={difficultyOptions}
              keyExtractor={o => String(o.key)}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item }) => (
                <Touchable
                  onPress={() => setActiveDifficulty(item.key)}
                  borderRadius={radius.full}
                  style={[
                    styles.chip,
                    activeDifficulty === item.key && styles.chipActive,
                    item.key !== 0 && { borderColor: difficultyColor[item.key] + '60' },
                  ]}
                >
                  {item.key === 0 ? (
                    <Text style={[styles.chipText, activeDifficulty === 0 && styles.chipTextActive]}>
                      Tümü
                    </Text>
                  ) : (
                    <View style={styles.dotRow}>
                      {[1, 2, 3, 4, 5].map(d => (
                        <View
                          key={d}
                          style={[
                            styles.dot,
                            {
                              backgroundColor:
                                d <= item.key
                                  ? activeDifficulty === item.key
                                    ? '#fff'
                                    : difficultyColor[item.key]
                                  : colors.borderLight,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </Touchable>
              )}
            />

            <Text style={styles.countLabel}>{visiblePoses.length} hareket</Text>
          </View>
        }
        renderItem={({ item }) => (
          <PoseLibraryCard
            pose={item}
            locale={locale}
            onPress={() => navigation.navigate('PoseDetail', { poseId: item.pose_id })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="magnify"
            title="Hareket bulunamadı"
            description="Filtreleri değiştirmeyi deneyin"
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  skeletonWrap: { flex: 1, padding: spacing.base, gap: spacing.sm },
  listContent: { padding: spacing.base, gap: spacing.xs },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.base,
  },
  headerTitle: { ...typography.h2, color: colors.text },
  fab: { overflow: 'hidden', borderRadius: radius.full },
  fabGradient: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    height: 44,
  },
  searchIcon: { marginRight: spacing.xs },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    height: 44,
  },
  filterRow: {
    paddingBottom: spacing.sm,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { ...typography.bodySmMedium, color: colors.textSecondary },
  chipTextActive: { color: '#fff' },
  dotRow: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  countLabel: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  cardAccent: { width: 4, borderRadius: 0 },
  cardContent: { flex: 1, padding: spacing.base, gap: spacing.xs },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardName: { ...typography.bodyMedium, color: colors.text, flex: 1 },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.backgroundElevated,
  },
  badgeText: { ...typography.caption, color: colors.textSecondary },
  badgeAnalyzable: { backgroundColor: colors.primarySoft },
  cardInstructions: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
});

export default ExploreScreen;
