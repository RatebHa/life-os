/**
 * post-action.ts
 *
 * Momentum recalculation, derived from recent task/habit completion activity.
 * Plain module (no React) — safe to call from Zustand stores via getState().
 */

import { calcMomentum } from './momentum';
import { useAppStore } from '../store/useAppStore';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import type { Task, HabitLog } from './types';
import type { DayActivity } from './momentum';

export async function recalculateMomentum(
  tasks?: Task[],
  logs?: HabitLog[],
): Promise<void> {
  try {
    const allTasks = tasks ?? useTaskStore.getState().tasks;
    const allLogs = logs ?? useHabitStore.getState().logs;
    await _calcAndSaveMomentum(allTasks, allLogs);
  } catch (err) {
    console.error('[post-action] momentum recalc error:', err);
  }
}

async function _calcAndSaveMomentum(tasks: Task[], logs: HabitLog[]): Promise<void> {
  const today = new Date();
  const last7: DayActivity[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const tasksCompleted = tasks.filter(
      (t) => t.status === 'done' && t.completed_at?.slice(0, 10) === dateStr
    ).length;

    const habitsCompleted = logs.filter((l) => l.completed_date === dateStr).length;

    const mitCompleted = tasks.some(
      (t) => t.is_mit && t.status === 'done' && t.completed_at?.slice(0, 10) === dateStr
    );

    last7.push({ date: dateStr, tasksCompleted, habitsCompleted, mitCompleted });
  }

  const rawScore = calcMomentum(last7);

  // MIT failure cost: if yesterday's MIT task was not completed, apply an extra -5 point penalty.
  // This makes MIT meaningful — not completing the most important task has real consequences.
  const yesterday = last7[1];
  const yesterdayHadMit = tasks.some((t) => t.is_mit); // there was a MIT set
  const yesterdayMitDone = yesterday?.mitCompleted ?? false;
  const mitFailurePenalty = (yesterdayHadMit && !yesterdayMitDone) ? 5 : 0;

  // If the user completed anything today, never drop below amber (15).
  const todayHasActivity =
    (last7[0].tasksCompleted ?? 0) > 0 ||
    (last7[0].habitsCompleted ?? 0) > 0 ||
    (last7[0].mitCompleted ?? false);
  const score = todayHasActivity
    ? Math.max(rawScore - mitFailurePenalty, 15)
    : Math.max(rawScore - mitFailurePenalty, 0);

  await useAppStore.getState().updateMomentum(score);
}
