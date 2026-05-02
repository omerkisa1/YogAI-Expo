import type { Orientation } from 'react-native-vision-camera';

import type { AnalyzeResult, LandmarkPoint } from '@/lib/poseAnalyzer';
import { calculateAngle } from '@/lib/poseAnalyzer';
import {
  getMlNormalizationExtent,
  getPreviewContentExtent,
} from '@/lib/poseLandmarks';
import {
  computeContainFitTransform,
  computeCoverCropTransform,
  type CoverCropTransform,
  type ContainFitTransform,
} from '@/shared/components/SkeletonOverlay';

/** Metro / Xcode konsolunda filtre: `YogAI.Pose` */
export const POSE_LOG_TAG = 'YogAI.Pose';

export type VisionPoseBundle = {
  points: LandmarkPoint[];
  frameW: number;
  frameH: number;
  orientation: Orientation;
  isMirrored: boolean;
  rawBounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
  /** confidence ≥ 0.5 olan landmark'lar — outlier kalça vb. hariç */
  rawBoundsVisible: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null;
};

function pickLm(pts: LandmarkPoint[], index: number): LandmarkPoint | undefined {
  return pts.find(p => p.index === index);
}

function lmBrief(p: LandmarkPoint | undefined): {
  x: number;
  y: number;
  v: number;
} | null {
  if (!p) return null;
  return {
    x: Math.round(p.x * 10000) / 10000,
    y: Math.round(p.y * 10000) / 10000,
    v: Math.round(p.visibility * 1000) / 1000,
  };
}

function tripleAngle(
  pts: LandmarkPoint[],
  a: number,
  b: number,
  c: number,
): number | null {
  const pa = pickLm(pts, a);
  const pb = pickLm(pts, b);
  const pc = pickLm(pts, c);
  if (!pa || !pb || !pc) return null;
  return Math.round(calculateAngle(pa.x, pa.y, pb.x, pb.y, pc.x, pc.y) * 10) / 10;
}

export type PoseDiagnosticContext = {
  bundle: VisionPoseBundle;
  overlayW: number;
  overlayH: number;
  resizeMode: 'cover' | 'contain';
  poseId: string | null;
  rulesCount: number;
  rulesOrigin: 'api' | 'fallback' | 'none';
  formatVideoW: number | null;
  formatVideoH: number | null;
  analyze: AnalyzeResult | null;
  fps: number;
};

function buildSnapshot(ctx: PoseDiagnosticContext): Record<string, unknown> {
  const { bundle, analyze } = ctx;
  const { normW, normH } = getMlNormalizationExtent(
    bundle.frameW,
    bundle.frameH,
    bundle.orientation,
  );
  const { contentW, contentH } = getPreviewContentExtent(
    bundle.frameW,
    bundle.frameH,
    bundle.orientation,
  );
  const pts = bundle.points;

  let crop: CoverCropTransform | undefined;
  let contain: ContainFitTransform | undefined;
  if (
    ctx.overlayW > 0 &&
    ctx.overlayH > 0 &&
    bundle.frameW > 0 &&
    bundle.frameH > 0
  ) {
    if (ctx.resizeMode === 'cover') {
      crop = computeCoverCropTransform(
        ctx.overlayW,
        ctx.overlayH,
        contentW,
        contentH,
      );
    } else {
      contain = computeContainFitTransform(
        ctx.overlayW,
        ctx.overlayH,
        contentW,
        contentH,
      );
    }
  }

  const raw = bundle.rawBounds;
  const rawVis = bundle.rawBoundsVisible;
  const fitFrom = (
    b: typeof raw,
  ): { maxX_over_normW: number | null; maxY_over_normH: number | null } => {
    if (!b || normW <= 0 || normH <= 0) {
      return { maxX_over_normW: null, maxY_over_normH: null };
    }
    return {
      maxX_over_normW: Math.round((b.maxX / normW) * 1000) / 1000,
      maxY_over_normH: Math.round((b.maxY / normH) * 1000) / 1000,
    };
  };
  const rawVsNormFit = fitFrom(raw);
  const rawVsNormFit_visible_ge_0_5 = fitFrom(rawVis);

  const visOk = (v: number) => v >= 0.5;
  const visibleCount = pts.filter(p => visOk(p.visibility)).length;

  const ruleSumm =
    analyze?.rules.map(r => ({
      id: r.ruleId,
      type: r.ruleType,
      deg: r.angleDegrees,
      score: r.scorePercent,
      st: r.status,
    })) ?? [];

  return {
    t: new Date().toISOString(),
    tag: POSE_LOG_TAG,
    poseId: ctx.poseId,
    rulesOrigin: ctx.rulesOrigin,
    rulesCount: ctx.rulesCount,
    fps: ctx.fps,
    resizeMode: ctx.resizeMode,
    format: {
      videoW: ctx.formatVideoW,
      videoH: ctx.formatVideoH,
    },
    frame: {
      bufferW: bundle.frameW,
      bufferH: bundle.frameH,
      orientation: bundle.orientation,
      isMirrored: bundle.isMirrored,
      normW,
      normH,
    },
    overlay: { w: ctx.overlayW, h: ctx.overlayH },
    previewContent: { w: contentW, h: contentH },
    coverCrop: crop ?? null,
    containFit: contain ?? null,
    rawBounds: raw,
    rawBoundsVisible_ge_0_5: rawVis,
    rawVsNormFit: rawVsNormFit,
    rawVsNormFit_visible_ge_0_5: rawVsNormFit_visible_ge_0_5,
    visibleLandmarks_ge_0_5: visibleCount,
    normalizedKeypoints: {
      nose_0: lmBrief(pickLm(pts, 0)),
      L_shoulder_11: lmBrief(pickLm(pts, 11)),
      R_shoulder_12: lmBrief(pickLm(pts, 12)),
      L_elbow_13: lmBrief(pickLm(pts, 13)),
      R_elbow_14: lmBrief(pickLm(pts, 14)),
      L_wrist_15: lmBrief(pickLm(pts, 15)),
      R_wrist_16: lmBrief(pickLm(pts, 16)),
      L_hip_23: lmBrief(pickLm(pts, 23)),
      R_hip_24: lmBrief(pickLm(pts, 24)),
    },
    angles_deg: {
      R_elbow_12_14_16: tripleAngle(pts, 12, 14, 16),
      L_elbow_11_13_15: tripleAngle(pts, 11, 13, 15),
      R_shoulder_24_12_14: tripleAngle(pts, 24, 12, 14),
      L_shoulder_23_11_13: tripleAngle(pts, 23, 11, 13),
    },
    analyze: analyze
      ? {
          accuracyPct: analyze.accuracyPercent,
          faultPenalty: analyze.faultPenaltyTotal,
          rules: ruleSumm,
        }
      : null,
  };
}

/**
 * Tek satır JSON — kullanıcı Metro logundan kopyalayıp yapıştırabilir.
 */
export function logPoseDiagnostics(ctx: PoseDiagnosticContext): void {
  const snapshot = buildSnapshot(ctx);
  try {
    console.log(`[${POSE_LOG_TAG}]`, JSON.stringify(snapshot));
  } catch {
    console.log(`[${POSE_LOG_TAG}]`, snapshot);
  }
}
