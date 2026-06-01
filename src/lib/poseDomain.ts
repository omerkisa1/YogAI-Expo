import { FACE_EXERCISE_CONFIGS } from '@/lib/faceRepCounter';
import { FACE_HAND_EXERCISE_CONFIGS } from '@/lib/faceHandRepCounter';
import type { Pose } from '@/shared/types/pose';

export type PlanDomain = 'body' | 'face';

export type ExerciseAnalysisKind = 'body' | 'face' | 'face_hand';

export type PlanType = PlanDomain;

export function resolveExerciseAnalysisKind(
  poseId: string,
  catalogKind?: Pose['analysis_kind'],
): ExerciseAnalysisKind {
  if (FACE_HAND_EXERCISE_CONFIGS[poseId]) return 'face_hand';
  if (FACE_EXERCISE_CONFIGS[poseId]) return 'face';
  if (catalogKind === 'face' || catalogKind === 'face_hand') return catalogKind;
  return 'body';
}

export function posePlanDomain(p: Pick<Pose, 'analysis_kind'>): PlanDomain {
  if (p.analysis_kind === 'face' || p.analysis_kind === 'face_hand') {
    return 'face';
  }
  return 'body';
}

export function domainsCompatible(a: PlanDomain, b: PlanDomain): boolean {
  return a === b;
}

export function mixDomainErrorMessage(): string {
  return 'Yüz yogası hareketleri ile normal yoga hareketleri aynı planda birleştirilemez.';
}

export function domainBadgeLabel(domain: PlanDomain, locale: string): string {
  if (domain === 'face') return locale === 'tr' ? 'Yüz Yogası' : 'Face Yoga';
  return locale === 'tr' ? 'Vücut Yogası' : 'Body Yoga';
}

export function isFacePlanType(planType: string): boolean {
  return (
    planType === 'face' ||
    planType === 'face_hand' ||
    planType === 'face_yoga' ||
    planType === 'mixed'
  );
}

export function normalizePlanType(planType?: string): PlanDomain {
  if (
    planType === 'face' ||
    planType === 'face_hand' ||
    planType === 'face_yoga' ||
    planType === 'mixed'
  ) {
    return 'face';
  }
  return 'body';
}
