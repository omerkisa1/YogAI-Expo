import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';

interface OfflineBannerProps { visible: boolean }

const OfflineBanner = ({ visible }: OfflineBannerProps) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(visible ? 0 : -52)).current;
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: visible ? 0 : -52, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.wrapper, { top: insets.top, transform: [{ translateY }], opacity }]}
    >
      <View style={styles.container}>
        <MaterialCommunityIcons name="wifi-off" size={16} color={colors.textOnPrimary} />
        <Text style={styles.text}>İnternet bağlantısı yok</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 0, right: 0, zIndex: 999 },
  container: {
    width: '100%',
    height: 36,
    backgroundColor: colors.error,
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  text: { ...typography.captionMedium, color: colors.textOnPrimary },
});

export default OfflineBanner;
