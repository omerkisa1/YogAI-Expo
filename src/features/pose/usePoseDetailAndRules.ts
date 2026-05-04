import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import api from '@/shared/api/axiosInstance';
import type { AnalyzablePose, YogaApiResponse } from '@/features/pose/analyzablePoseTypes';
import { parseLandmarkRules, type LandmarkRule } from '@/lib/poseAnalyzer';
import { getFallbackRulesForPose } from '@/lib/fallbackPoseRules';

export type RulesSourceUiPhase = 'idle' | 'loading' | 'error' | 'ready';

export type RulesSourceUi = {
  phase: RulesSourceUiPhase;
  origin: 'api' | 'fallback' | 'none';
  count: number;
};

export const RULES_SOURCE_UI_INITIAL: RulesSourceUi = {
  phase: 'idle',
  origin: 'none',
  count: 0,
};

export function usePoseDetailAndRules(poseId: string | null) {
  const poseDetailQuery = useQuery<AnalyzablePose>({
    queryKey: ['pose-detail', poseId],
    queryFn: async () => {
      const res = await api.get<YogaApiResponse<AnalyzablePose>>(`/api/v1/yoga/poses/${poseId}`);
      return res.data.data;
    },
    enabled: Boolean(poseId),
  });

  const selectedPose = poseDetailQuery.data;
  const rulesRef = useRef<LandmarkRule[]>([]);
  const rulesOriginRef = useRef<'api' | 'fallback' | 'none'>('none');
  const [rulesSourceUi, setRulesSourceUi] = useState<RulesSourceUi>(RULES_SOURCE_UI_INITIAL);
  const fallbackRulesWarnedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!poseId) {
      rulesRef.current = [];
      rulesOriginRef.current = 'none';
      setRulesSourceUi(RULES_SOURCE_UI_INITIAL);
      return;
    }

    if (poseDetailQuery.isError) {
      rulesRef.current = [];
      rulesOriginRef.current = 'none';
      setRulesSourceUi({ phase: 'error', origin: 'none', count: 0 });
      return;
    }

    if (!selectedPose) {
      rulesRef.current = [];
      rulesOriginRef.current = 'none';
      setRulesSourceUi({ phase: 'loading', origin: 'none', count: 0 });
      return;
    }

    const parsed = parseLandmarkRules(
      selectedPose.landmark_rules ?? selectedPose.landmarkRules,
    );

    let rules = parsed;
    let origin: 'api' | 'fallback' | 'none' = 'none';

    if (parsed.length > 0) {
      origin = 'api';
    } else {
      const fb = getFallbackRulesForPose(poseId);
      if (fb.length > 0) {
        rules = fb;
        origin = 'fallback';
        if (
          __DEV__ &&
          !fallbackRulesWarnedRef.current.has(poseId)
        ) {
          fallbackRulesWarnedRef.current.add(poseId);
          console.warn(
            `[YogAI.Pose] landmark_rules API'de yok — "${poseId}" için yerel test kuralları kullanılıyor.`,
          );
        }
      }
    }

    rulesRef.current = rules;
    rulesOriginRef.current = origin;
    setRulesSourceUi({ phase: 'ready', origin, count: rules.length });
  }, [
    poseDetailQuery.isError,
    poseId,
    selectedPose,
    selectedPose?.landmark_rules,
    selectedPose?.landmarkRules,
  ]);

  return {
    selectedPose,
    isPoseDetailLoading: poseDetailQuery.isLoading,
    isPoseDetailError: poseDetailQuery.isError,
    rulesRef,
    rulesOriginRef,
    rulesSourceUi,
  };
}
