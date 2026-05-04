import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import {
  runAtTargetFps,
  useFrameProcessor,
} from 'react-native-vision-camera';
import type { Orientation } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { detectPose } from 'vision-camera-pose-detector';

import {
  analyzePoseClientSide,
  type AnalyzeResult,
  type LandmarkPoint,
  type LandmarkRule,
} from '@/lib/poseAnalyzer';
import { LandmarkSmoother, AccuracySmoother } from '@/lib/poseSmoothing';
import {
  landmarksFromDetector,
  mirrorSwapLandmarks,
  rawLandmarkBounds,
  rawLandmarkBoundsVisible,
} from '@/lib/poseLandmarks';
import {
  logPoseDiagnostics,
  type VisionPoseBundle,
} from '@/lib/poseDiagnosticsLog';

const ANALYZE_THROTTLE_MS = 150;
const ML_TARGET_FPS = 10;
const POSE_LOG_INTERVAL_MS = 600;

export type PoseVisionPipelineOptions = {
  rulesRef: MutableRefObject<LandmarkRule[]>;
  rulesOriginRef: MutableRefObject<'api' | 'fallback' | 'none'>;
  selectedPoseIdRef: MutableRefObject<string | null>;
  devResizeModeRef: MutableRefObject<'cover' | 'contain'>;
  overlayLayoutRef: MutableRefObject<{ w: number; h: number }>;
  formatVideoRef: MutableRefObject<{ vw: number; vh: number } | null>;
  enablePoseConsoleLog: boolean;
  setLandmarks: Dispatch<SetStateAction<LandmarkPoint[]>>;
  setFrameInfo: Dispatch<
    SetStateAction<{
      w: number;
      h: number;
      orientation: Orientation;
      isMirrored: boolean;
      rawBounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
    } | null>
  >;
  setAnalyzeResult: Dispatch<SetStateAction<AnalyzeResult | null>>;
  setFps: Dispatch<SetStateAction<number>>;
  /** Her hesaplanan smoothing'li accuracy (ör. antrenman submit ortalaması). */
  onSmoothedAccuracy?: (accuracyPercent: number, result: AnalyzeResult) => void;
  /** CameraTest: ilk N throttle'da ek konsol dump. */
  onDevAnalyzeFrame?: (payload: {
    bundle: VisionPoseBundle;
    smoothedPoints: LandmarkPoint[];
    analyze: AnalyzeResult;
  }) => void;
};

export function usePoseVisionPipeline(opts: PoseVisionPipelineOptions) {
  const {
    rulesRef,
    rulesOriginRef,
    selectedPoseIdRef,
    devResizeModeRef,
    overlayLayoutRef,
    formatVideoRef,
    enablePoseConsoleLog,
    setLandmarks,
    setFrameInfo,
    setAnalyzeResult,
    setFps,
    onSmoothedAccuracy,
    onDevAnalyzeFrame,
  } = opts;

  const lastAnalyzeAtRef = useRef(0);
  const lastResultRef = useRef<AnalyzeResult | null>(null);
  const fpsCountRef = useRef(0);
  const fpsLastTickRef = useRef(Date.now());
  const fpsDisplayRef = useRef(0);
  const lastPoseLogAtRef = useRef(0);
  const landmarkSmootherRef = useRef(new LandmarkSmoother(0.3));
  const accuracySmootherRef = useRef(new AccuracySmoother(8));

  const onSmoothedAccuracyRef = useRef(onSmoothedAccuracy);
  onSmoothedAccuracyRef.current = onSmoothedAccuracy;
  const onDevAnalyzeFrameRef = useRef(onDevAnalyzeFrame);
  onDevAnalyzeFrameRef.current = onDevAnalyzeFrame;

  const resetSmoothers = useCallback(() => {
    landmarkSmootherRef.current.reset();
    accuracySmootherRef.current.reset();
    lastAnalyzeAtRef.current = 0;
    lastResultRef.current = null;
  }, []);

  const onVisionPoseBundle = useRunOnJS((bundle: VisionPoseBundle) => {
    const anatomicalPoints =
      bundle.points.length > 0 && bundle.isMirrored
        ? mirrorSwapLandmarks(bundle.points)
        : bundle.points;

    const smoothedPoints =
      anatomicalPoints.length > 0
        ? landmarkSmootherRef.current.smooth(anatomicalPoints)
        : anatomicalPoints;

    setLandmarks(smoothedPoints);
    setFrameInfo({
      w: bundle.frameW,
      h: bundle.frameH,
      orientation: bundle.orientation,
      isMirrored: bundle.isMirrored,
      rawBounds: bundle.rawBounds,
    });

    const now = Date.now();
    fpsCountRef.current += 1;
    if (now - fpsLastTickRef.current >= 1000) {
      fpsDisplayRef.current = fpsCountRef.current;
      setFps(fpsCountRef.current);
      fpsCountRef.current = 0;
      fpsLastTickRef.current = now;
    }

    const rules = rulesRef.current;
    let analyzeJustComputed: AnalyzeResult | null = null;

    if (smoothedPoints.length === 0 || rules.length === 0) {
      setAnalyzeResult(null);
      lastResultRef.current = null;
    } else if (now - lastAnalyzeAtRef.current >= ANALYZE_THROTTLE_MS) {
      lastAnalyzeAtRef.current = now;
      const rawResult = analyzePoseClientSide(rules, smoothedPoints);
      rawResult.accuracyPercent = accuracySmootherRef.current.smooth(
        rawResult.accuracyPercent,
      );
      analyzeJustComputed = rawResult;
      lastResultRef.current = analyzeJustComputed;
      setAnalyzeResult(analyzeJustComputed);
      onSmoothedAccuracyRef.current?.(
        analyzeJustComputed.accuracyPercent,
        analyzeJustComputed,
      );
      onDevAnalyzeFrameRef.current?.({
        bundle,
        smoothedPoints,
        analyze: analyzeJustComputed,
      });
    }

    if (
      enablePoseConsoleLog &&
      now - lastPoseLogAtRef.current >= POSE_LOG_INTERVAL_MS
    ) {
      lastPoseLogAtRef.current = now;
      const fv = formatVideoRef.current;
      logPoseDiagnostics({
        bundle,
        overlayW: overlayLayoutRef.current.w,
        overlayH: overlayLayoutRef.current.h,
        resizeMode: devResizeModeRef.current,
        poseId: selectedPoseIdRef.current,
        rulesCount: rules.length,
        rulesOrigin: rulesOriginRef.current,
        formatVideoW: fv?.vw ?? null,
        formatVideoH: fv?.vh ?? null,
        analyze: analyzeJustComputed ?? lastResultRef.current,
        fps: fpsDisplayRef.current,
      });
    }
  }, []);

  const frameProcessor = useFrameProcessor(
    frame => {
      'worklet';
      runAtTargetFps(ML_TARGET_FPS, () => {
        'worklet';
        const pose = detectPose(frame);
        if (pose == null) {
          onVisionPoseBundle({
            points: [],
            frameW: frame.width,
            frameH: frame.height,
            orientation: frame.orientation,
            isMirrored: frame.isMirrored,
            rawBounds: null,
            rawBoundsVisible: null,
          });
          return;
        }
        const bounds = rawLandmarkBounds(pose);
        const boundsVisible = rawLandmarkBoundsVisible(pose, 0.5);
        const mapped = landmarksFromDetector(
          pose,
          frame.width,
          frame.height,
          frame.orientation,
          false,
        );
        onVisionPoseBundle({
          points: mapped,
          frameW: frame.width,
          frameH: frame.height,
          orientation: frame.orientation,
          isMirrored: frame.isMirrored,
          rawBounds: bounds,
          rawBoundsVisible: boundsVisible,
        });
      });
    },
    [onVisionPoseBundle],
  );

  return {
    frameProcessor,
    lastResultRef,
    resetSmoothers,
    fpsCountRef,
  };
}
