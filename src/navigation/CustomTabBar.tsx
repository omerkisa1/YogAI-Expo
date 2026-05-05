import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Touchable from '@/shared/components/Touchable';
import { FLOATING_TAB_BAR_BOTTOM_OFFSET } from '@/navigation/tabBarMetrics';
import { colors } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import type { MainTabParamList } from './types';

interface TabMeta {
  label: string;
  activeIcon: string;
  inactiveIcon: string;
}

const tabMetaMap: Record<keyof MainTabParamList, TabMeta> = {
  Home: { label: 'Ana Sayfa', activeIcon: 'home', inactiveIcon: 'home-outline' },
  Plans: { label: 'Planlar', activeIcon: 'calendar-text', inactiveIcon: 'calendar-text-outline' },
  Training: { label: 'Antrenman', activeIcon: 'yoga', inactiveIcon: 'yoga' },
  Profile: { label: 'Profil', activeIcon: 'account', inactiveIcon: 'account-outline' },
};

const CustomTabBar = ({ state, descriptors, navigation }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const bottomOffset = FLOATING_TAB_BAR_BOTTOM_OFFSET + Math.max(insets.bottom, spacing.sm);

  const tint: 'light' | 'dark' = 'light';

  return (
    <View pointerEvents="box-none" style={[styles.shell, { bottom: bottomOffset }]}>
      <BlurView intensity={Platform.OS === 'ios' ? 55 : 48} tint={tint} style={styles.blur}>
        <View style={styles.innerTint}>
          <View style={styles.row}>
            {state.routes.map((route, index) => {
              const meta = tabMetaMap[route.name as keyof MainTabParamList];
              const isFocused = state.index === index;
              const color = isFocused ? colors.primary : colors.textMuted;
              const icon = isFocused ? meta.activeIcon : meta.inactiveIcon;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const onLongPress = () => {
                navigation.emit({ type: 'tabLongPress', target: route.key });
              };

              const accessibilityLabel = descriptors[route.key]?.options.tabBarAccessibilityLabel ?? meta.label;

              return (
                <Touchable
                  key={route.key}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={styles.tabItem}
                  borderRadius={radius.full}
                  accessibilityRole="button"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={accessibilityLabel}
                >
                  <MaterialCommunityIcons name={icon as never} size={24} color={color} />
                  <Text style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}>{meta.label}</Text>
                </Touchable>
              );
            })}
          </View>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: spacing.base,
    right: spacing.base,
    borderRadius: 40,
    overflow: 'hidden',
    shadowColor: 'rgba(0, 106, 66, 0.18)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 12,
  },
  blur: {
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  innerTint: {
    backgroundColor: Platform.OS === 'android' ? 'rgba(250,250,247,0.92)' : 'rgba(255,255,255,0.28)',
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: 2,
  },
  tabLabel: {
    textAlign: 'center',
  },
  tabLabelActive: {
    ...typography.captionMedium,
    color: colors.primary,
  },
  tabLabelInactive: {
    ...typography.caption,
    color: colors.textMuted,
  },
});

export default CustomTabBar;
