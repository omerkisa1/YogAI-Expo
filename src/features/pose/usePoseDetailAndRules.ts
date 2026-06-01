import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthReady } from '@/features/auth/hooks/useAuthReady';
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
  const authReady = useAuthReady();
  const poseDetailQuery = useQuery<AnalyzablePose>({
    queryKey: ['pose-detail', poseId],
    queryFn: async () => {
      const res = await api.get<YogaApiResponse<AnalyzablePose>>(`/api/v1/yoga/poses/${poseId}`);
      return res.data.data;
    },
    enabled: authReady && Boolean(poseId),
    staleTime: 10 * 60 * 1000,
  });

  const selectedPose = poseDetailQuery.data;
  const rulesRef = useRef<LandmarkRule[]>([]);
  const rulesOriginRef = useRef<'api' | 'fallback' | 'none'>('none');
  const [rulesSourceUi, setRulesSourceUi] = useState<RulesSourceUi>(RULES_SOURCE_UI_INITIAL);
  const fallbackRulesWarnedRef = useRef<Set<string>>(new Set());

  const patchRulesSourceUi = (next: RulesSourceUi) => {
    setRulesSourceUi(prev =>
      prev.phase === next.phase && prev.origin === next.origin && prev.count === next.count ? prev : next,
    );
  };

  useEffect(() => {
    if (!poseId) {
      rulesRef.current = [];
      rulesOriginRef.current = 'none';
      patchRulesSourceUi(RULES_SOURCE_UI_INITIAL);
      return;
    }

    if (poseDetailQuery.isError) {
      rulesRef.current = [];
      rulesOriginRef.current = 'none';
      patchRulesSourceUi({ phase: 'error', origin: 'none', count: 0 });
      return;
    }

    if (!selectedPose) {
      rulesRef.current = [];
      rulesOriginRef.current = 'none';
      patchRulesSourceUi({ phase: 'loading', origin: 'none', count: 0 });
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
    patchRulesSourceUi({ phase: 'ready', origin, count: rules.length });
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
