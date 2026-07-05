import type { Habit } from './types';

export function getHabitActivationDate(habit: Habit): string {
  return habit.restart_from_date || habit.created_at.slice(0, 10);
}

export function getHabitIncrementAmount(habit: Habit, current: number): number {
  if (habit.target_type === 'checkbox' || habit.cadence_type === 'weekly_count' || habit.cadence_type === 'times_per_week') {
    return 1;
  }
  const remaining = Math.max(0, habit.target_value - current);
  if (remaining <= 5) return remaining || 5;
  return habit.target_value >= 30 ? 10 : 5;
}

export function getHabitMinimumAmount(habit: Habit, current: number): number {
  if (habit.target_type === 'checkbox' || habit.cadence_type === 'weekly_count' || habit.cadence_type === 'times_per_week') {
    return 1;
  }
  if (habit.minimum_value && habit.minimum_value > current) return habit.minimum_value - current;
  return Math.max(1, Math.min(habit.target_value, getHabitIncrementAmount(habit, current)));
}

export function getHabitRemainingAmount(habit: Habit, current: number): number {
  if (habit.target_type === 'checkbox' || habit.cadence_type === 'weekly_count' || habit.cadence_type === 'times_per_week') {
    return 1;
  }
  return Math.max(1, habit.target_value - current);
}
