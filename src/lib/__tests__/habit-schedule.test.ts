import { describe, expect, it } from 'vitest';
import { getHabitMissedDates, getHabitProgressForDate, isHabitDueOnDate } from '../habit-schedule';
import type { Habit, HabitLog } from '../types';

function createHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    domain_id: 'self',
    title: 'Read',
    description: null,
    frequency: 'daily',
    target_days: '[0,1,2,3,4,5,6]',
    xp_per_completion: 0,
    cadence_type: 'daily',
    cadence_days: '[0,1,2,3,4,5,6]',
    cadence_interval_days: 2,
    cadence_weekly_target: 3,
    cadence_anchor_date: null,
    target_type: 'checkbox',
    target_value: 1,
    minimum_value: null,
    unit_label: null,
    minimum_version: 'Read one page',
    recovery_grace_days: 1,
    restart_from_date: null,
    streak_current: 0,
    streak_longest: 0,
    is_active: true,
    created_at: '2026-04-07T08:00:00Z',
    ...overrides,
  };
}

describe('habit-schedule activation boundaries', () => {
  it('does not mark dates before creation as due', () => {
    const habit = createHabit();

    expect(isHabitDueOnDate(habit, '2026-04-06', [])).toBe(false);
    expect(isHabitDueOnDate(habit, '2026-04-07', [])).toBe(true);
  });

  it('does not count misses from before a new habit existed', () => {
    const habit = createHabit();

    expect(getHabitMissedDates(habit, [], '2026-04-07', 21)).toEqual([]);
    expect(getHabitMissedDates(habit, [], '2026-04-10', 21)).toEqual(['2026-04-07', '2026-04-08', '2026-04-09']);
  });

  it('respects restart dates when checking due and missed history', () => {
    const habit = createHabit({
      restart_from_date: '2026-04-05',
      created_at: '2026-03-01T08:00:00Z',
    });
    const logs: HabitLog[] = [
      {
        id: 'log-1',
        habit_id: habit.id,
        completed_date: '2026-04-05',
        xp_awarded: 0,
        value_completed: 1,
        status: 'completed',
        skip_reason: null,
        created_at: '2026-04-05T09:00:00Z',
      },
    ];

    expect(isHabitDueOnDate(habit, '2026-04-04', logs)).toBe(false);
    expect(getHabitMissedDates(habit, logs, '2026-04-07', 21)).toEqual(['2026-04-06']);
    expect(getHabitProgressForDate(habit, logs, '2026-04-05').isComplete).toBe(true);
  });
});
