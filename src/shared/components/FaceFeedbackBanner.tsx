import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FaceFeedbackState } from '@/lib/faceRepCounter';
import type { FaceHandFeedbackState } from '@/lib/faceHandRepCounter';
import { FEEDBACK_MESSAGES, HAND_FEEDBACK_MESSAGES } from '@/lib/faceFeedbackMessages';
import type { AppLocale } from '@/lib/i18n';

export type FaceBannerVariant = 'face' | 'face_hand';

type Props = {
  locale: AppLocale;
  variant?: FaceBannerVariant;
  feedbackState: FaceFeedbackState | FaceHandFeedbackState;
  feedbackKey: string;
};

export default function FaceFeedbackBanner({
  locale,
  variant = 'face',
  feedbackState,
  feedbackKey,
}: Props) {
  const lang = locale === 'tr' ? 'tr' : 'en';

  if (feedbackState === 'complete') return null;

  if (variant === 'face_hand') {
    const m = HAND_FEEDBACK_MESSAGES[lang]?.[feedbackKey];
    if (!m) return null;
    const text =
      feedbackState === 'guide_tilt'
        ? (m.guide_tilt ?? 'Tilt your head slightly to the side')
        : feedbackState === 'guide_hand'
          ? m.guide_hand
          : feedbackState === 'guide_action'
            ? m.guide_action
            : feedbackState === 'guide_motion'
              ? m.guide_motion
              : feedbackState === 'hold'
                ? m.hold
                : feedbackState === 'good'
                  ? m.good
                  : null;
    if (!text) return null;

    const bgStyle =
      feedbackState === 'guide_tilt'
        ? styles.bgPurple
        : feedbackState === 'guide_hand'
          ? styles.bgMuted
          : feedbackState === 'guide_action'
            ? styles.bgAmber
            : feedbackState === 'guide_motion'
              ? styles.bgBlue
              : styles.bgGreen;

    const textStyle =
      feedbackState === 'guide_tilt'
        ? styles.textPurple
        : feedbackState === 'guide_hand'
          ? styles.textMuted
          : feedbackState === 'guide_action'
            ? styles.textAmber
            : feedbackState === 'guide_motion'
              ? styles.textBlue
              : styles.textGreen;

    const icon =
      feedbackState === 'guide_tilt'
        ? '↩️'
        : feedbackState === 'guide_hand'
          ? '👆'
          : feedbackState === 'guide_action'
            ? '✋'
            : feedbackState === 'guide_motion'
              ? '🔄'
              : feedbackState === 'hold'
                ? '✊'
                : '✅';

    return (
      <View style={[styles.row, bgStyle]}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={[styles.message, textStyle]}>{text}</Text>
      </View>
    );
  }

  const messages = FEEDBACK_MESSAGES[lang]?.[feedbackKey];
  if (!messages) return null;

  const text =
    feedbackState === 'guide'
      ? messages.guide
      : feedbackState === 'hold'
        ? messages.hold
        : messages.good;

  const bgStyle =
    feedbackState === 'guide' ? styles.bgMuted : styles.bgGreen;
  const textStyle = feedbackState === 'guide' ? styles.textMuted : styles.textGreen;
  const icon = feedbackState === 'guide' ? '👆' : feedbackState === 'hold' ? '✊' : '✅';

  return (
    <View style={[styles.row, bgStyle]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.message, textStyle]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  icon: { fontSize: 18 },
  message: { fontSize: 14, fontWeight: '500', flex: 1 },
  bgMuted: { backgroundColor: 'rgba(255,255,255,0.1)' },
  bgGreen: { backgroundColor: 'rgba(34,197,94,0.25)' },
  bgPurple: { backgroundColor: 'rgba(168,85,247,0.2)' },
  bgAmber: { backgroundColor: 'rgba(245,158,11,0.2)' },
  bgBlue: { backgroundColor: 'rgba(59,130,246,0.2)' },
  textMuted: { color: 'rgba(255,255,255,0.7)' },
  textGreen: { color: '#86efac' },
  textPurple: { color: '#d8b4fe' },
  textAmber: { color: '#fde68a' },
  textBlue: { color: '#93c5fd' },
});
