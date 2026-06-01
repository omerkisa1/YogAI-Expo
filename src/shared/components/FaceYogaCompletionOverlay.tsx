import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TrainingStrings } from '@/lib/i18n';

type Props = {
  strings: TrainingStrings;
  targetReps: number;
  countdown: number | null;
  onRetry?: () => void;
};

export function FaceYogaCompletionOverlay({
  strings,
  targetReps,
  countdown,
  onRetry,
}: Props) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>{strings.congratulations}</Text>
        <Text style={styles.subtitle}>
          {targetReps} {strings.repsCompleted}
        </Text>
        {countdown !== null && (
          <>
            <Text style={styles.countdown}>{countdown}</Text>
            <Text style={styles.countdownHint}>{strings.nextPoseIn}</Text>
          </>
        )}
        {onRetry && countdown === null && (
          <Pressable style={styles.retryBtn} onPress={onRetry}>
            <Text style={styles.retryText}>{strings.tryAgain}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    maxWidth: 320,
    padding: 32,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
  },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '700', color: '#fff' },
  subtitle: { marginTop: 8, fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  countdown: { marginTop: 16, fontSize: 48, fontWeight: '700', color: '#4ade80' },
  countdownHint: { marginTop: 4, fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  retryBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#22c55e',
  },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
