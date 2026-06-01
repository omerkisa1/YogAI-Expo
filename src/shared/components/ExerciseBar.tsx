import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  value: number;
  enterThreshold: number;
  label: string;
  minLabel?: string;
  maxLabel?: string;
};

export function ExerciseBar({
  value,
  enterThreshold,
  label,
  minLabel = '0',
  maxLabel = 'MAX',
}: Props) {
  const thresholdPercent = enterThreshold * 100;
  const isAboveThreshold = value >= enterThreshold;
  const fillWidth = `${Math.min(value * 100, 100)}%` as const;

  return (
    <View style={styles.panel}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: fillWidth },
            isAboveThreshold ? styles.fillGood : styles.fillWarn,
          ]}
        />
        <View style={[styles.threshold, { left: `${thresholdPercent}%` }]} />
      </View>
      <View style={styles.range}>
        <Text style={styles.rangeText}>{minLabel}</Text>
        <Text style={styles.rangeText}>{maxLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    width: 240,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  label: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 6,
  },
  fillGood: {
    backgroundColor: '#4ade80',
  },
  fillWarn: {
    backgroundColor: '#fbbf24',
  },
  threshold: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  range: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  rangeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
});
