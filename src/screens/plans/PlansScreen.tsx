import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import { useDeletePlan, useUpdatePlan } from '@/features/plans/hooks/useCreatePlan';
import { usePlans } from '@/features/plans/hooks/usePlans';
import AppModal from '@/shared/components/AppModal';
import BottomSheet from '@/shared/components/BottomSheet';
import Button from '@/shared/components/Button';
import EmptyState from '@/shared/components/EmptyState';
import ErrorView from '@/shared/components/ErrorView';
import PlanCard from '@/shared/components/PlanCard';
import SkeletonLoader from '@/shared/components/SkeletonLoader';
import Touchable from '@/shared/components/Touchable';
import type { Plan } from '@/shared/types/plan';
import type { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';
import { typography } from '@/theme/typography';

type PlanFilter = 'all' | 'favorites' | 'beginner' | 'intermediate' | 'advanced';
interface FilterOption { key: PlanFilter; label: string; icon?: string }

const filterOptions: FilterOption[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'favorites', label: 'Favoriler', icon: 'star-outline' },
  { key: 'beginner', label: 'Başlangıç' },
  { key: 'intermediate', label: 'Orta' },
  { key: 'advanced', label: 'İleri' },
];

const PlansScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const plansQuery = usePlans();
  const updatePlanMutation = useUpdatePlan();
  const deletePlanMutation = useDeletePlan();

  const [activeFilter, setActiveFilter] = useState<PlanFilter>('all');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<Plan | null>(null);
  const [isRefreshing, setRefreshing] = useState(false);

  const plans = useMemo(() => (Array.isArray(plansQuery.data) ? plansQuery.data : []), [plansQuery.data]);
  const filteredPlans = useMemo(() => {
    switch (activeFilter) {
      case 'favorites': return plans.filter(p => Boolean(p.favorite));
      case 'beginner': case 'intermediate': case 'advanced': return plans.filter(p => p.difficulty === activeFilter);
      default: return plans;
    }
  }, [activeFilter, plans]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await plansQuery.refetch(); setRefreshing(false); }, [plansQuery]);
  const openPlanDetail = useCallback((planId: string) => { navigation.navigate('PlanDetail', { planId }); }, [navigation]);

  const toggleFavorite = useCallback(async (plan: Plan) => {
    try { await updatePlanMutation.mutateAsync({ id: plan.id, data: { favorite: !plan.favorite } }); }
    catch { Toast.show({ type: 'error', position: 'top', text1: 'İşlem Başarısız', text2: 'Favori bilgisi Güncellenemedi.' }); }
  }, [updatePlanMutation]);

  const togglePin = useCallback(async (plan: Plan) => {
    try { await updatePlanMutation.mutateAsync({ id: plan.id, data: { pin: !plan.pin } }); }
    catch { Toast.show({ type: 'error', position: 'top', text1: 'İşlem Başarısız', text2: 'Sabitleme bilgisi Güncellenemedi.' }); }
  }, [updatePlanMutation]);

  const renderFilterItem = useCallback(({ item }: { item: FilterOption }) => (
    <Touchable
      onPress={() => setActiveFilter(item.key)}
      borderRadius={radius.full}
      style={[styles.filterChip, activeFilter === item.key ? styles.filterChipSelected : styles.filterChipUnselected]}
      accessibilityRole="button" accessibilityLabel={`${item.label} filtresi`}
    >
      {item.icon ? <MaterialCommunityIcons name={item.icon as never} size={14} color={activeFilter === item.key ? colors.textOnPrimary : colors.textSecondary} style={styles.filterChipIcon} /> : null}
      <Text style={[styles.filterChipLabel, activeFilter === item.key ? styles.filterChipLabelSelected : styles.filterChipLabelUnselected]}>{item.label}</Text>
    </Touchable>
  ), [activeFilter]);

  const renderPlanItem = useCallback(({ item }: { item: Plan }) => (
    <PlanCard plan={item} onPress={openPlanDetail} onToggleFavorite={toggleFavorite} onTogglePin={togglePin} onLongPress={setSelectedPlan} actionsDisabled={updatePlanMutation.isPending || deletePlanMutation.isPending} progress={0} />
  ), [deletePlanMutation.isPending, openPlanDetail, toggleFavorite, togglePin, updatePlanMutation.isPending]);

  if (plansQuery.isLoading && !plansQuery.data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.loadingContent}>
          {Array.from({ length: 3 }).map((_, i) => <SkeletonLoader key={`plans-skeleton-${i}`} width="100%" height={176} borderRadius={radius.lg} />)}
        </View>
      </SafeAreaView>
    );
  }

  if (plansQuery.isError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
        <View style={styles.errorWrap}>
          <ErrorView type="generic" title="Planlar Yüklenemedi" description="Liste şu anda getirilemiyor. Lütfen tekrar deneyin." onRetry={() => { void plansQuery.refetch(); }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Planlarım</Text>
          <Touchable style={styles.filterButton} borderRadius={radius.full} accessibilityRole="button" accessibilityLabel="Filtre seçenekleri">
            <MaterialCommunityIcons name="filter-variant" size={22} color={colors.primary} />
          </Touchable>
        </View>

        <FlatList horizontal data={filterOptions} keyExtractor={item => item.key} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList} renderItem={renderFilterItem} />

        <FlatList
          data={filteredPlans}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={renderPlanItem}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          ListFooterComponent={<View style={styles.listFooterBottom} />}
          ListEmptyComponent={
            <EmptyState icon="calendar-plus" title="Henüz plan oluşturmadınız" description="Sağ alttaki + butonuyla ilk planınızı oluşturabilirsiniz." />
          }
        />

        <Touchable style={styles.fab} onPress={() => navigation.navigate('CreatePlan')} borderRadius={radius.lg} accessibilityRole="button" accessibilityLabel="Yeni plan oluştur">
          <LinearGradient colors={[colors.gradientPrimary[0], colors.gradientPrimary[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
            <MaterialCommunityIcons name="plus" size={28} color={colors.textOnPrimary} />
          </LinearGradient>
        </Touchable>
      </View>

      <BottomSheet visible={Boolean(selectedPlan)} onClose={() => setSelectedPlan(null)} title="Plan İşlemleri">
        <View style={styles.sheetActions}>
          <Button title={selectedPlan?.favorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'} onPress={() => { if (selectedPlan) { void toggleFavorite(selectedPlan); } setSelectedPlan(null); }} variant="ghost" size="md" fullWidth icon="star-outline" accessibilityLabel="Favori işlemi" />
          <Button title={selectedPlan?.pin ? 'Sabitlemeyi Kaldır' : 'Sabitle'} onPress={() => { if (selectedPlan) { void togglePin(selectedPlan); } setSelectedPlan(null); }} variant="ghost" size="md" fullWidth icon="pin-outline" accessibilityLabel="Sabitleme işlemi" />
          <Button title="Planı Sil" onPress={() => { if (selectedPlan) { setSelectedPlan(null); setPlanToDelete(selectedPlan); } }} variant="danger" size="md" fullWidth icon="delete-outline" accessibilityLabel="Planı sil" />
        </View>
      </BottomSheet>

      <AppModal
        visible={Boolean(planToDelete)}
        onClose={() => setPlanToDelete(null)}
        title="Bu planı silmek istediğinize emin misiniz?"
        description="Bu işlem geri alınamaz."
        icon="delete-outline"
        iconColor={colors.error}
        actions={[
          { label: 'İptal', variant: 'ghost', onPress: () => setPlanToDelete(null) },
          {
            label: 'Sil', variant: 'danger',
            onPress: () => {
              if (!planToDelete) return;
              const runDelete = async () => {
                try {
                  await deletePlanMutation.mutateAsync(planToDelete.id);
                  setPlanToDelete(null);
                  Toast.show({ type: 'success', position: 'top', text1: 'Plan silindi', text2: 'Plan listenizden kaldırıldı.' });
                } catch {
                  Toast.show({ type: 'error', position: 'top', text1: 'Silme Başarısız', text2: 'Plan silinemedi. Lütfen tekrar deneyin.' });
                }
              };
              void runDelete();
            },
          },
        ]}
        autoDismissMs={10000}
        dismissOnBackdrop
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  loadingContent: { paddingHorizontal: spacing.base, paddingTop: spacing.base, gap: spacing.sm },
  errorWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.base },
  headerRow: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.h2, color: colors.text },
  filterButton: { width: 38, height: 38, borderRadius: radius.full, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  filterList: { paddingHorizontal: spacing.base, paddingVertical: spacing.base, gap: spacing.sm },
  filterChip: { height: 36, paddingHorizontal: spacing.base, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  filterChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipUnselected: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight },
  filterChipIcon: { marginRight: spacing.xs },
  filterChipLabel: { ...typography.bodySmMedium },
  filterChipLabelSelected: { color: colors.textOnPrimary },
  filterChipLabelUnselected: { color: colors.textSecondary },
  listContent: { paddingHorizontal: spacing.base, paddingBottom: spacing.huge + spacing.huge, gap: spacing.sm },
  listFooterBottom: { height: spacing.md },
  fab: { position: 'absolute', right: spacing.xl, bottom: spacing.xl, width: 56, height: 56, borderRadius: radius.lg, overflow: 'hidden', ...shadows.lg },
  fabGradient: { width: '100%', height: '100%', borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  sheetActions: { gap: spacing.sm, paddingBottom: spacing.base },
});

export default PlansScreen;
