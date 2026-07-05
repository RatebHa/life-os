/**
 * post-action.ts
 *
 * Called after every task completion or habit log.
 * Handles: domain refresh, level-up detection, achievement checks, momentum recalc.
 * Plain module (no React) — safe to call from Zustand stores via getState().
 */

import { db } from './db';
import { calcMomentum } from './momentum';
import { getAchievementsToUnlock } from './achievement-checker';
import { useDomainStore } from '../store/useDomainStore';
import { useAppStore } from '../store/useAppStore';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import { useGoalStore } from '../store/useGoalStore';
import type { DomainId, Task, HabitLog, XpEvent } from './types';
import type { DayActivity } from './momentum';

export async function runPostAction(domainId: DomainId): Promise<void> {
  try {
    const domainState = useDomainStore.getState();
    const appState = useAppStore.getState();

    // ── 1. Snapshot prev level for level-up detection ─────────────────────────
    const prevLevel = domainState.domains.find((d) => d.id === domainId)?.level ?? 1;

    // ── 2. Refresh domains from DB (Rust has updated XP + level + streak) ─────
    const freshDomains = await db.getDomains();
    domainState.setDomains(freshDomains);

    // ── 3. Level-up detection ─────────────────────────────────────────────────
    const newLevel = freshDomains.find((d) => d.id === domainId)?.level ?? 1;
    if (newLevel > prevLevel) {
      appState.triggerLevelUp(domainId, newLevel);
    }

    // ── 4. Achievement checks ─────────────────────────────────────────────────
    const tasks = useTaskStore.getState().tasks;
    const { habits, logs } = useHabitStore.getState();
    const goals = useGoalStore.getState().goals;
    const achievements = useAppStore.getState().achievements;

    let xpEvents: XpEvent[] = [];
    try { xpEvents = await db.getXpEvents(200); } catch { /* non-fatal */ }

    const toUnlock = getAchievementsToUnlock({
      tasks, habits, logs, domains: freshDomains, goals, achievements, xpEvents,
    });

    for (const id of toUnlock) {
      await useAppStore.getState().unlockAchievement(id);
    }

    // ── 5. Momentum recalculation ─────────────────────────────────────────────
    await _calcAndSaveMomentum(tasks, logs);
  } catch (err) {
    console.error('[post-action] error:', err);
  }
}

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
