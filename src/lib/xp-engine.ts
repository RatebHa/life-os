import type { Priority } from './types';

const PRIORITY_MULTIPLIER: Record<Priority, number> = {
  low: 1.0,
  medium: 1.5,
  high: 2.0,
  critical: 3.0,
};

export function calculateXP(task: { priority: Priority; is_mit: boolean; time_estimate_minutes?: number | null; due_date?: string | null }): number {
  let base = 30;

  if (task.time_estimate_minutes != null) {
    if (task.time_estimate_minutes < 30) base = 20;
    else if (task.time_estimate_minutes <= 90) base = 50;
    else base = 100;
  }

  let xp = base * PRIORITY_MULTIPLIER[task.priority];

  if (task.is_mit) xp *= 1.5;

  // Due-date bonus is applied at completion time
  return Math.round(xp);
}

export function applyCompletionBonuses(
  baseXP: number,
  opts: { isMIT: boolean; completedBeforeDeadline: boolean; domainStreakTier: number }
): number {
  let xp = baseXP;
  if (opts.completedBeforeDeadline) xp *= 1.25;
  if (opts.isMIT) xp *= 1.5;
  // Streak bonus: +10% per 7-day tier
  if (opts.domainStreakTier > 0) xp *= (1 + opts.domainStreakTier * 0.1);
  return Math.round(xp);
}

export function xpToLevel(xp: number): number {
  // thresholds[i] = XP required to ENTER level (i+1)
  // Level 1 = 0 XP, Level 2 = 500 XP, ... Level 10 = 60000 XP
  const thresholds = [0, 500, 1200, 2500, 4500, 7500, 12000, 20000, 35000, 60000];
  let level = 0;
  for (const threshold of thresholds) {
    if (xp >= threshold) level++;
    else break;
  }
  return Math.min(Math.max(level, 1), 10);
}

export function xpForNextLevel(currentLevel: number): number {
  const thresholds = [0, 500, 1200, 2500, 4500, 7500, 12000, 20000, 35000, 60000];
  return thresholds[currentLevel] ?? 60000;
}

export function xpProgress(totalXP: number, currentLevel: number): number {
  const thresholds = [0, 500, 1200, 2500, 4500, 7500, 12000, 20000, 35000, 60000];
  const levelStart = thresholds[currentLevel - 1] ?? 0;
  const levelEnd = thresholds[currentLevel] ?? 60000;
  const range = levelEnd - levelStart;
  const progress = totalXP - levelStart;
  return Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
}
