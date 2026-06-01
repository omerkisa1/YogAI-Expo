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

    return (
      <View style={[styles.block, bgStyle]}>
        <Text style={[styles.message, textStyle]} numberOfLines={3}>
          {text}
        </Text>
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

  const bgStyle = feedbackState === 'guide' ? styles.bgMuted : styles.bgGreen;
  const textStyle = feedbackState === 'guide' ? styles.textMuted : styles.textGreen;

  return (
    <View style={[styles.block, bgStyle]}>
      <Text style={[styles.message, textStyle]} numberOfLines={3}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 160,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    flexShrink: 1,
  },
  bgMuted: { backgroundColor: 'rgba(255,255,255,0.14)' },
  bgGreen: { backgroundColor: 'rgba(34,197,94,0.28)' },
  bgPurple: { backgroundColor: 'rgba(168,85,247,0.22)' },
  bgAmber: { backgroundColor: 'rgba(245,158,11,0.22)' },
  bgBlue: { backgroundColor: 'rgba(59,130,246,0.22)' },
  textMuted: { color: 'rgba(255,255,255,0.92)' },
  textGreen: { color: '#bbf7d0' },
  textPurple: { color: '#e9d5ff' },
  textAmber: { color: '#fde68a' },
  textBlue: { color: '#bfdbfe' },
});
