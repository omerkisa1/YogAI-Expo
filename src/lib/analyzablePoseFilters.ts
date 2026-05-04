import type { AnalyzablePoseMeta } from '@/features/pose/analyzablePoseTypes';

/** QA için: production'da test pozlarını listelemek. */
export const SHOW_TEST_POSES =
  __DEV__ || process.env.EXPO_PUBLIC_SHOW_TEST_POSES === '1';

const TEST_POSE_ID_PREFIX = 'test_';

export function isUserFacingTestPose(pose: Pick<AnalyzablePoseMeta, 'pose_id' | 'name_en' | 'name_tr'>): boolean {
  if (pose.pose_id.startsWith(TEST_POSE_ID_PREFIX)) return true;
  const n = `${pose.name_en} ${pose.name_tr}`.toUpperCase();
  return n.includes('[TEST]') || /\bTEST\b/.test(n);
}

export function filterAnalyzablePosesForUser<T extends Pick<AnalyzablePoseMeta, 'pose_id' | 'name_en' | 'name_tr'>>(
  poses: T[],
): T[] {
  if (SHOW_TEST_POSES) return poses;
  return poses.filter(p => !isUserFacingTestPose(p));
}
