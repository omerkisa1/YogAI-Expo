import type { TrainingSession, TrainingStats } from '@/shared/types/training';

const formatLocalDay = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const sessionLocalDay = (startedAt: string): string => formatLocalDay(new Date(startedAt));

export const computeTrainingStatsFromSessions = (sessions: TrainingSession[]): TrainingStats => {
  let completedCount = 0;
  let totalAcc = 0;
  let accCount = 0;
  let totalDur = 0;
  const activeDays = new Set<string>();

  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    completedCount++;
    const acc = s.average_accuracy ?? 0;
    if (acc > 0) {
      totalAcc += acc;
      accCount++;
    }
    totalDur += s.total_duration_sec ?? 0;
    if (s.started_at) activeDays.add(sessionLocalDay(s.started_at));
  }

  const average_accuracy = accCount > 0 ? totalAcc / accCount : 0;

  let current_streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const day = formatLocalDay(d);
    if (activeDays.has(day)) {
      current_streak++;
    } else if (i > 0) {
      break;
    }
  }

  return {
    total_sessions: completedCount,
    total_duration_sec: totalDur,
    average_accuracy,
    current_streak,
  };
};
