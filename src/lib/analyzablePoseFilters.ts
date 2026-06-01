import type { AnalyzablePoseMeta } from '@/features/pose/analyzablePoseTypes';
import { FACE_EXERCISE_CONFIGS } from '@/lib/faceRepCounter';
import { FACE_HAND_EXERCISE_CONFIGS } from '@/lib/faceHandRepCounter';

export const SHOW_TEST_POSES =
  __DEV__ || process.env.EXPO_PUBLIC_SHOW_TEST_POSES === '1';

const TEST_POSE_ID_PREFIX = 'test_';

export function isUserFacingTestPose(pose: Pick<AnalyzablePoseMeta, 'pose_id' | 'name_en' | 'name_tr'>): boolean {
  if (pose.pose_id.startsWith(TEST_POSE_ID_PREFIX)) return true;
  const n = `${pose.name_en} ${pose.name_tr}`.toUpperCase();
  return n.includes('[TEST]') || /\bTEST\b/.test(n);
}

export function filterPosesWithRepConfig<T extends Pick<AnalyzablePoseMeta, 'pose_id' | 'analysis_kind'>>(
  poses: T[],
): T[] {
  return poses.filter(p => {
    if (p.analysis_kind === 'face') {
      return p.pose_id in FACE_EXERCISE_CONFIGS;
    }
    if (p.analysis_kind === 'face_hand') {
      return p.pose_id in FACE_HAND_EXERCISE_CONFIGS;
    }
    return true;
  });
}

export function filterAnalyzablePosesForUser<
  T extends Pick<AnalyzablePoseMeta, 'pose_id' | 'name_en' | 'name_tr' | 'analysis_kind'>,
>(poses: T[]): T[] {
  let filtered = poses;
  if (!SHOW_TEST_POSES) {
    filtered = filtered.filter(p => !isUserFacingTestPose(p));
  }
  return filterPosesWithRepConfig(filtered);
}
