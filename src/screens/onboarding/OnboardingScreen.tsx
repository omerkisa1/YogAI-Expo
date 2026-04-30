import React, { useRef, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Button from '@/shared/components/Button';
import Touchable from '@/shared/components/Touchable';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { shadows } from '@/theme/shadows';
import { typography } from '@/theme/typography';

interface OnboardingScreenProps { onDone: () => void }

interface OnboardingSlide { id: string; title: string; description: string; icon: string; iconColor: string; iconBackground: string }

const slides: OnboardingSlide[] = [
  { id: 'ai-plan', title: 'AI ile Kişisel Plan', description: 'Seviyenize ve hedeflerinize uygun yoga planları oluşturun.', icon: 'yoga', iconColor: colors.primary, iconBackground: colors.primarySoft },
  { id: 'camera-analysis', title: 'Kameradan Poz Analizi', description: 'Hareketlerinizi gerçek zamanlı analiz edin ve doğru formu öğrenin.', icon: 'camera-outline', iconColor: colors.accent, iconBackground: colors.accentSoft },
  { id: 'progress', title: 'İlerlemenizi Takip Edin', description: 'Antrenman geçmişinizi görün ve gelişiminizi izleyin.', icon: 'chart-timeline-variant-shimmer', iconColor: colors.secondary, iconBackground: colors.secondarySoft },
];

const OnboardingScreen = ({ onDone }: OnboardingScreenProps) => {
  const pagerRef = useRef<PagerView>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const isLast = currentPage === slides.length - 1;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={styles.skipRow}>
        <Touchable onPress={onDone} borderRadius={radius.md} style={styles.skipPressable} accessibilityLabel="Onboarding atla">
          <Text style={styles.skipText}>Atla</Text>
        </Touchable>
      </View>

      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={event => setCurrentPage(event.nativeEvent.position)}
      >
        {slides.map(slide => (
          <View key={slide.id} style={styles.page}>
            <View style={[styles.iconCircle, { backgroundColor: slide.iconBackground }]}>
              <MaterialCommunityIcons name={slide.icon as never} size={80} color={slide.iconColor} />
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.description}>{slide.description}</Text>
          </View>
        ))}
      </PagerView>

      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {slides.map((slide, index) => (
            <View key={slide.id} style={[styles.dot, currentPage === index ? styles.dotActive : styles.dotInactive]} />
          ))}
        </View>
        {isLast ? (
          <Button title="Başlayalım" onPress={onDone} variant="primary" size="lg" fullWidth accessibilityLabel="Onboarding tamamla" />
        ) : (
          <Button
            title="Sonraki"
            onPress={() => pagerRef.current?.setPage(currentPage + 1)}
            variant="outline"
            size="lg"
            fullWidth
            icon="arrow-right"
            iconPosition="right"
            accessibilityLabel="Onboarding sonraki"
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: spacing.base, paddingTop: spacing.sm },
  skipPressable: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  skipText: { ...typography.bodySm, color: colors.textMuted },
  pager: { flex: 1 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  iconCircle: { width: 120, height: 120, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl, ...shadows.md },
  title: { ...typography.h2, color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  footer: { paddingHorizontal: spacing.base, paddingBottom: spacing.base, gap: spacing.base },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  dotActive: { backgroundColor: colors.primary },
  dotInactive: { backgroundColor: colors.borderLight },
});

export default OnboardingScreen;
