import type { LandmarkPoint } from '@/lib/poseAnalyzer';

/**
 * Exponential Moving Average (EMA) smoother for landmark positions.
 *
 * Eliminates ML Kit jitter (2-5px frame-to-frame) which causes 10-20° angle
 * fluctuations in raw data. Yoga movements are slow → alpha 0.3 is ideal.
 *
 * Usage:
 * ```ts
 * const smoother = new LandmarkSmoother(0.3);
 * const smoothed = smoother.smooth(rawLandmarks);
 * ```
 */
export class LandmarkSmoother {
  private history: Map<number, { x: number; y: number; z: number; visibility: number }>;
  private readonly alpha: number;

  /**
   * @param alpha 0–1. Lower = smoother (more lag), higher = more responsive (more jitter).
   *   - 0.3 = yoga ideal (slow movements, 2-3 frame lag)
   *   - 0.5 = moderate (1-2 frame lag)
   *   - 0.7 = responsive (fast movements, still some jitter)
   */
  constructor(alpha: number = 0.3) {
    this.history = new Map();
    this.alpha = Math.max(0.01, Math.min(1, alpha));
  }

  smooth(landmarks: LandmarkPoint[]): LandmarkPoint[] {
    return landmarks.map(lm => {
      const prev = this.history.get(lm.index);

      if (!prev) {
        // First frame — use raw values
        this.history.set(lm.index, {
          x: lm.x,
          y: lm.y,
          z: lm.z ?? 0,
          visibility: lm.visibility,
        });
        return lm;
      }

      // EMA: smoothed = alpha * current + (1 - alpha) * previous
      const smoothed: LandmarkPoint = {
        index: lm.index,
        x: this.alpha * lm.x + (1 - this.alpha) * prev.x,
        y: this.alpha * lm.y + (1 - this.alpha) * prev.y,
        z: this.alpha * (lm.z ?? 0) + (1 - this.alpha) * prev.z,
        visibility: lm.visibility, // Don't smooth visibility — instant value matters
      };

      this.history.set(lm.index, {
        x: smoothed.x,
        y: smoothed.y,
        z: smoothed.z ?? 0,
        visibility: smoothed.visibility,
      });

      return smoothed;
    });
  }

  reset(): void {
    this.history.clear();
  }
}

/**
 * Moving-window smoother for the final accuracy score.
 *
 * Even after landmark EMA, the accuracy score can fluctuate by ±5%.
 * Averaging over the last N frames stabilizes the displayed value.
 */
export class AccuracySmoother {
  private history: number[];
  private readonly windowSize: number;

  /**
   * @param windowSize Number of frames to average. 5 = ~0.5s at 10fps.
   */
  constructor(windowSize: number = 5) {
    this.history = [];
    this.windowSize = Math.max(1, windowSize);
  }

  smooth(accuracy: number): number {
    this.history.push(accuracy);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
    const sum = this.history.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.history.length) * 10) / 10;
  }

  reset(): void {
    this.history = [];
  }
}
