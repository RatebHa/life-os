import type { Habit, HabitLog, HabitLogStatus } from './types';

function toLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shiftLocalDate(date: string, days: number): string {
  const next = toLocalDate(date);
  next.setDate(next.getDate() + days);
  return formatLocalDate(next);
}

function diffLocalDays(later: string, earlier: string): number {
  const laterMs = toLocalDate(later).getTime();
  const earlierMs = toLocalDate(earlier).getTime();
  return Math.floor((laterMs - earlierMs) / 86_400_000);
}

function parseDayList(raw: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(raw || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is number => typeof value === 'number' && value >= 0 && value <= 6)
      .sort((left, right) => left - right);
  } catch {
    return [];
  }
}

function getCadenceDays(habit: Habit): number[] {
  if (habit.cadence_days?.trim()) {
    return parseDayList(habit.cadence_days);
  }
  return parseDayList(habit.target_days);
}

function getAnchorDate(habit: Habit): string {
  return habit.restart_from_date
    || habit.cadence_anchor_date
    || habit.created_at.slice(0, 10);
}

function getActivationDate(habit: Habit): string {
  return habit.restart_from_date || habit.created_at.slice(0, 10);
}

function isOnOrAfterActivationDate(habit: Habit, date: string): boolean {
  return diffLocalDays(date, getActivationDate(habit)) >= 0;
}

function getWeekStart(date: string): string {
  const base = toLocalDate(date);
  const day = base.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + delta);
  return formatLocalDate(base);
}

function getWeekEnd(date: string): string {
  return shiftLocalDate(getWeekStart(date), 6);
}

function latestLogsForHabit(logs: HabitLog[], habitId: string): HabitLog[] {
  const deduped = new Map<string, HabitLog>();
  for (const log of logs) {
    if (log.habit_id !== habitId) continue;
    const existing = deduped.get(log.completed_date);
    if (!existing || log.created_at > existing.created_at) {
      deduped.set(log.completed_date, log);
    }
  }
  return Array.from(deduped.values());
}

function isCompletionStatus(status: HabitLogStatus): boolean {
  return status === 'completed' || status === 'minimum';
}

function getWeeklyTarget(habit: Habit): number {
  return Math.max(1, habit.cadence_weekly_target || habit.target_value || 1);
}

export function parseTargetDays(targetDays: string): number[] {
  return parseDayList(targetDays);
}

export function getHabitProgressForDate(
  habit: Habit,
  logs: HabitLog[],
  date: string,
): {
  current: number;
  target: number;
  isComplete: boolean;
  latestLog: HabitLog | null;
  periodStart: string;
  periodEnd: string;
} {
  const habitLogs = latestLogsForHabit(logs, habit.id);
  const latestLog = habitLogs.find((log) => log.completed_date === date) ?? null;
  const target = Math.max(1, habit.target_value || 1);

  if (habit.cadence_type === 'weekly_count' || habit.cadence_type === 'times_per_week') {
    const periodStart = getWeekStart(date);
    const periodEnd = getWeekEnd(date);
    const current = habitLogs
      .filter((log) => log.completed_date >= periodStart && log.completed_date <= periodEnd)
      .reduce((sum, log) => sum + (isCompletionStatus(log.status) ? 1 : 0), 0);
    const weeklyTarget = getWeeklyTarget(habit);
    return {
      current,
      target: weeklyTarget,
      isComplete: current >= weeklyTarget,
      latestLog,
      periodStart,
      periodEnd,
    };
  }

  const current = latestLog ? Math.max(0, latestLog.value_completed || 0) : 0;
  return {
    current,
    target,
    isComplete: latestLog ? isCompletionStatus(latestLog.status) : false,
    latestLog,
    periodStart: date,
    periodEnd: date,
  };
}

export function isHabitDueOnDate(habit: Habit, date: string, logs: HabitLog[] = []): boolean {
  if (!isOnOrAfterActivationDate(habit, date)) return false;

  const cadence = habit.cadence_type || 'daily';
  const weekday = toLocalDate(date).getDay();
  const progress = getHabitProgressForDate(habit, logs, date);

  switch (cadence) {
    case 'daily':
      return !progress.isComplete;
    case 'weekdays':
      return weekday >= 1 && weekday <= 5 && !progress.isComplete;
    case 'selected_days': {
      const days = getCadenceDays(habit);
      return days.includes(weekday) && !progress.isComplete;
    }
    case 'interval': {
      const anchor = getAnchorDate(habit);
      const interval = Math.max(1, habit.cadence_interval_days || 1);
      const delta = diffLocalDays(date, anchor);
      return delta >= 0 && delta % interval === 0 && !progress.isComplete;
    }
    case 'weekly':
    case 'weekly_count':
    case 'times_per_week':
      return !progress.isComplete;
    default:
      return !progress.isComplete;
  }
}

export function getHabitMissedDates(habit: Habit, logs: HabitLog[], endDate: string, days = 21): string[] {
  const habitLogs = latestLogsForHabit(logs, habit.id);
  const logMap = new Map(habitLogs.map((log) => [log.completed_date, log]));
  const result: string[] = [];
  const activationDate = getActivationDate(habit);

  if (habit.cadence_type === 'weekly_count' || habit.cadence_type === 'times_per_week') {
    const seenWeeks = new Set<string>();
    for (let offset = days; offset >= 0; offset -= 1) {
      const date = shiftLocalDate(endDate, -offset);
      const weekStart = getWeekStart(date);
      if (seenWeeks.has(weekStart)) continue;
      seenWeeks.add(weekStart);
      if (getWeekEnd(weekStart) < activationDate) continue;
      const progress = getHabitProgressForDate(habit, logs, weekStart);
      if (progress.isComplete) continue;
      if (getWeekEnd(weekStart) < endDate) {
        result.push(getWeekEnd(weekStart));
      }
    }
    return result;
  }

  for (let offset = days; offset >= 1; offset -= 1) {
    const date = shiftLocalDate(endDate, -offset);
    if (!isOnOrAfterActivationDate(habit, date)) continue;
    if (!isHabitDueOnDate(habit, date, logs)) continue;
    const log = logMap.get(date);
    if (!log || (!isCompletionStatus(log.status) && log.status !== 'partial')) {
      result.push(date);
    }
  }

  return result;
}

export function getHabitWeekdayInsights(
  habit: Habit,
  logs: HabitLog[],
  days = 60,
): { strongest: string | null; weakest: string | null; misses: number } {
  const stats = new Map<number, { successes: number; misses: number }>();
  const names = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const today = formatLocalDate(new Date());

  for (let weekday = 0; weekday < 7; weekday += 1) {
    stats.set(weekday, { successes: 0, misses: 0 });
  }

  const habitLogs = latestLogsForHabit(logs, habit.id);
  const logMap = new Map(habitLogs.map((log) => [log.completed_date, log]));

  for (let offset = days; offset >= 1; offset -= 1) {
    const date = shiftLocalDate(today, -offset);
    if (!isOnOrAfterActivationDate(habit, date)) continue;
    const weekday = toLocalDate(date).getDay();
    const bucket = stats.get(weekday);
    if (!bucket) continue;
    const log = logMap.get(date);

    if (log && isCompletionStatus(log.status)) {
      bucket.successes += 1;
      continue;
    }

    if (isHabitDueOnDate(habit, date, logs) && !log) {
      bucket.misses += 1;
    }
  }

  let strongest: string | null = null;
  let weakest: string | null = null;
  let strongestRate = -1;
  let weakestRate = Number.POSITIVE_INFINITY;
  let misses = 0;

  for (const [weekday, bucket] of stats.entries()) {
    const total = bucket.successes + bucket.misses;
    misses += bucket.misses;
    if (total === 0) continue;
    const rate = bucket.successes / total;
    if (rate > strongestRate) {
      strongestRate = rate;
      strongest = names[weekday] ?? null;
    }
    if (rate < weakestRate) {
      weakestRate = rate;
      weakest = names[weekday] ?? null;
    }
  }

  return { strongest, weakest, misses };
}

export function getHabitCadenceLabel(habit: Habit): string {
  switch (habit.cadence_type) {
    case 'daily':
      return 'DAILY';
    case 'weekdays':
      return 'WEEKDAYS';
    case 'selected_days': {
      const days = getCadenceDays(habit);
      const names = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      return days.length > 0 ? days.map((day) => names[day]).join('/') : 'SELECTED DAYS';
    }
    case 'interval':
      return `EVERY ${Math.max(1, habit.cadence_interval_days || 1)} DAY${Math.max(1, habit.cadence_interval_days || 1) === 1 ? '' : 'S'}`;
    case 'weekly':
    case 'weekly_count':
    case 'times_per_week':
      return `${getWeeklyTarget(habit)}X / WEEK`;
    default:
      return 'CUSTOM';
  }
}

export function getHabitTargetLabel(habit: Habit): string {
  if (habit.target_type === 'minutes') {
    return `${habit.target_value} MIN`;
  }
  if (habit.target_type === 'count') {
    return `${habit.target_value} ${habit.unit_label?.toUpperCase() || 'REPS'}`;
  }
  return 'CHECK';
}
