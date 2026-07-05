export type MomentumState = 'peak' | 'normal' | 'amber' | 'red_alert';

export interface DayActivity {
  date: string;
  tasksCompleted: number;
  habitsCompleted: number;
  mitCompleted: boolean;
}

const DAY_WEIGHTS = [0.30, 0.25, 0.18, 0.12, 0.08, 0.05, 0.02];

export function calcMomentum(last7Days: DayActivity[]): number {
  if (!last7Days || last7Days.length === 0) return 50;

  // If user has zero activity across all 7 days, return neutral 50
  // (fresh install or no data yet — don't punish with RED ALERT)
  const totalActivity = last7Days.reduce(
    (sum, day) => sum + (day.tasksCompleted ?? 0) + (day.habitsCompleted ?? 0) + ((day.mitCompleted ?? false) ? 1 : 0),
    0
  );
  if (totalActivity === 0) return 50;

  let score = 0;

  for (let i = 0; i < Math.min(last7Days.length, 7); i++) {
    const day = last7Days[i];
    let dayScore = 0;
    dayScore += Math.min((day.tasksCompleted ?? 0) * 10, 50);
    dayScore += Math.min((day.habitsCompleted ?? 0) * 8, 32);
    dayScore += (day.mitCompleted ?? false) ? 18 : 0;
    score += dayScore * DAY_WEIGHTS[i];
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function getMomentumState(score: number): MomentumState {
  if (score >= 80) return 'peak';
  if (score >= 30) return 'normal';
  if (score >= 15) return 'amber';
  return 'red_alert';
}

export function getMomentumColor(state: MomentumState): string {
  switch (state) {
    case 'peak':      return 'var(--momentum-peak)';
    case 'normal':    return 'var(--momentum-normal)';
    case 'amber':     return 'var(--momentum-amber)';
    case 'red_alert': return 'var(--momentum-red)';
  }
}

export function getMomentumLabel(state: MomentumState): string {
  switch (state) {
    case 'peak':      return 'PEAK';
    case 'normal':    return 'ACTIVE';
    case 'amber':     return 'WARNING';
    case 'red_alert': return 'CRITICAL';
  }
}

export interface MomentumDriver {
  label: string;
  value: number;
  max: number;
}

export interface MomentumBreakdown {
  score: number;
  state: MomentumState;
  drivers: MomentumDriver[];
  whyLow: string[];       // human-readable reasons if score is low
  recoveryPlan: string;   // actionable next step
}

export function getMomentumBreakdown(last7Days: DayActivity[]): MomentumBreakdown {
  const score = calcMomentum(last7Days);
  const state = getMomentumState(score);

  const today = last7Days[0] ?? { tasksCompleted: 0, habitsCompleted: 0, mitCompleted: false };
  const yesterday = last7Days[1] ?? { tasksCompleted: 0, habitsCompleted: 0, mitCompleted: false };

  const todayTaskPts  = Math.min((today.tasksCompleted ?? 0) * 10, 50);
  const todayHabitPts = Math.min((today.habitsCompleted ?? 0) * 8, 32);
  const todayMitPts   = (today.mitCompleted ?? false) ? 18 : 0;

  // Rolling score from past 6 days (contribution from history)
  let historyScore = 0;
  for (let i = 1; i < Math.min(last7Days.length, 7); i++) {
    const day = last7Days[i];
    let dayScore = 0;
    dayScore += Math.min((day.tasksCompleted ?? 0) * 10, 50);
    dayScore += Math.min((day.habitsCompleted ?? 0) * 8, 32);
    dayScore += (day.mitCompleted ?? false) ? 18 : 0;
    historyScore += dayScore * DAY_WEIGHTS[i];
  }

  const drivers: MomentumDriver[] = [
    { label: 'TODAY — TASKS',   value: todayTaskPts,  max: 50 },
    { label: 'TODAY — HABITS',  value: todayHabitPts, max: 32 },
    { label: 'TODAY — MIT',     value: todayMitPts,   max: 18 },
    { label: 'HISTORY (6D)',    value: Math.round(historyScore), max: 70 },
  ];

  const whyLow: string[] = [];
  if (state !== 'peak') {
    if (today.tasksCompleted === 0) whyLow.push('No tasks completed today');
    if (today.habitsCompleted === 0) whyLow.push('No habits logged today');
    if (!today.mitCompleted) whyLow.push('MIT not completed today');
    if (!yesterday.mitCompleted && yesterday.tasksCompleted === 0 && yesterday.habitsCompleted === 0) {
      whyLow.push('No activity recorded yesterday');
    }
  }

  let recoveryPlan = '';
  if (state === 'red_alert') {
    recoveryPlan = 'COMPLETE MIT + 2 HABITS + 1 TASK → RECOVER TO AMBER';
  } else if (state === 'amber') {
    recoveryPlan = 'COMPLETE MIT + 2 HABITS TODAY → RECOVER TO NOMINAL';
  } else if (state === 'normal') {
    recoveryPlan = 'COMPLETE MIT + 3 TASKS + ALL HABITS → REACH PEAK';
  }

  return { score, state, drivers, whyLow, recoveryPlan };
}
