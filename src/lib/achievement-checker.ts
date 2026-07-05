import type { Task, Habit, HabitLog, Domain, Achievement, XpEvent, Goal } from './types';

export interface GameStateSnapshot {
  tasks: Task[];
  habits: Habit[];
  logs: HabitLog[];
  domains: Domain[];
  goals: Goal[];
  achievements: Achievement[];
  xpEvents: XpEvent[];
}

export function getAchievementsToUnlock(state: GameStateSnapshot): string[] {
  const { tasks, habits, logs, domains, goals, achievements, xpEvents } = state;
  const toUnlock: string[] = [];
  const already = new Set(achievements.filter((a) => a.unlocked).map((a) => a.id));

  const tryUnlock = (id: string, condition: boolean) => {
    if (!already.has(id) && condition) toUnlock.push(id);
  };

  const today = new Date().toISOString().slice(0, 10);
  const completedTasks = tasks.filter((t) => t.status === 'done');

  // ── Basic counts ────────────────────────────────────────────────────────────

  tryUnlock('first_blood', completedTasks.length >= 1);
  tryUnlock('centurion', completedTasks.length >= 100);

  // ── Domain streaks ──────────────────────────────────────────────────────────

  tryUnlock('on_fire', domains.some((d) => d.streak_current >= 7));
  tryUnlock('streak_30', domains.some((d) => d.streak_current >= 30));

  // ── Domain levels ───────────────────────────────────────────────────────────

  const levelFiveCount = domains.filter((d) => d.level >= 5).length;
  tryUnlock('warrior', levelFiveCount >= 1);
  tryUnlock('architect', levelFiveCount >= 2);
  tryUnlock('monk', levelFiveCount >= 3);
  tryUnlock('level_10', domains.some((d) => d.level >= 10));

  // ── Total XP ────────────────────────────────────────────────────────────────

  const totalXP = domains.reduce((sum, d) => sum + d.xp_total, 0);
  tryUnlock('xp_10000', totalXP >= 10000);

  // ── Domain balance ──────────────────────────────────────────────────────────

  if (domains.length >= 2) {
    const xps = domains.map((d) => d.xp_total);
    const min = Math.min(...xps);
    const max = Math.max(...xps);
    if (max > 0) tryUnlock('balanced', (max - min) / max <= 0.1);
  }

  // ── Daily XP ────────────────────────────────────────────────────────────────

  const todayXP = xpEvents
    .filter((e) => e.created_at.slice(0, 10) === today)
    .reduce((sum, e) => sum + e.xp_amount, 0);
  tryUnlock('overdrive', todayXP >= 200);

  // ── Habit streaks ───────────────────────────────────────────────────────────

  tryUnlock('habit_machine', habits.some((h) => h.streak_current >= 30));

  // ── All habits today ────────────────────────────────────────────────────────

  const activeHabits = habits.filter((h) => h.is_active);
  if (activeHabits.length > 0) {
    const todayLogSet = new Set(
      logs.filter((l) => l.completed_date === today).map((l) => l.habit_id)
    );
    tryUnlock('all_habits', activeHabits.every((h) => todayLogSet.has(h.id)));
  }

  // ── Range — work across multiple domains today ──────────────────────────────

  const todayDomains = new Set(
    completedTasks
      .filter((t) => t.completed_at?.slice(0, 10) === today)
      .map((t) => t.domain_id)
  );
  const requiredDomainCoverage = domains.length >= 3 ? 3 : domains.length >= 2 ? domains.length : Number.POSITIVE_INFINITY;
  tryUnlock('triple_threat', todayDomains.size >= requiredDomainCoverage);

  // ── Dawn operator — before 7am on 5 different days ─────────────────────────

  const earlyDays = new Set(
    completedTasks
      .filter((t) => t.completed_at && new Date(t.completed_at).getHours() < 7)
      .map((t) => t.completed_at!.slice(0, 10))
  );
  tryUnlock('dawn_operator', earlyDays.size >= 5);

  // ── Deep work — 5 tasks with 90min+ in last 7 days ─────────────────────────

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const deepWorkCount = completedTasks.filter(
    (t) =>
      (t.time_estimate_minutes ?? 0) >= 90 &&
      (t.completed_at?.slice(0, 10) ?? '') >= weekAgo
  ).length;
  tryUnlock('deep_work', deepWorkCount >= 5);

  // ── Goal crusher — 10 goals completed ──────────────────────────────────────

  tryUnlock('goal_crusher', goals.filter((g) => g.status === 'completed').length >= 10);

  // ── MIT master — MIT completed 5 consecutive days ──────────────────────────
  // Approximate: check if any 5 days in the last 7 had at least one MIT completion

  const mitDays = new Set(
    completedTasks
      .filter((t) => t.is_mit && t.completed_at)
      .map((t) => t.completed_at!.slice(0, 10))
  );
  // Check for 5 consecutive days in sorted list
  const sortedMitDays = [...mitDays].sort();
  let mitConsecutive = 1;
  let maxMitConsecutive = sortedMitDays.length > 0 ? 1 : 0;
  for (let i = 1; i < sortedMitDays.length; i++) {
    const prev = new Date(sortedMitDays[i - 1]);
    const curr = new Date(sortedMitDays[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) {
      mitConsecutive++;
      maxMitConsecutive = Math.max(maxMitConsecutive, mitConsecutive);
    } else {
      mitConsecutive = 1;
    }
  }
  tryUnlock('mit_master', maxMitConsecutive >= 5);
  tryUnlock('mit_streak_5', maxMitConsecutive >= 5);

  return toUnlock;
}
