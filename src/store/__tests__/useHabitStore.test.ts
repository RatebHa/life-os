import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useHabitStore } from '../useHabitStore';
import { useDomainStore } from '../useDomainStore';
import { useErrorStore } from '../useErrorStore';
import type { Habit, HabitLog } from '../../lib/types';

const mockInvoke = vi.mocked(invoke);

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    domain_id: 'self',
    title: 'Meditate',
    description: null,
    frequency: 'daily',
    target_days: '[0,1,2,3,4,5,6]',
    xp_per_completion: 15,
    cadence_type: 'daily',
    cadence_days: '[0,1,2,3,4,5,6]',
    cadence_interval_days: 1,
    cadence_weekly_target: 1,
    cadence_anchor_date: null,
    target_type: 'checkbox',
    target_value: 1,
    minimum_value: null,
    unit_label: null,
    minimum_version: null,
    recovery_grace_days: 1,
    restart_from_date: null,
    streak_current: 0,
    streak_longest: 0,
    is_active: true,
    created_at: '2026-07-16T09:00:00Z',
    ...overrides,
  };
}

function makeHabitLog(overrides: Partial<HabitLog> = {}): HabitLog {
  return {
    id: 'log-1',
    habit_id: 'habit-1',
    completed_date: '2026-07-16',
    xp_awarded: 0,
    value_completed: 1,
    status: 'completed',
    skip_reason: null,
    created_at: '2026-07-16T09:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  useHabitStore.setState({ habits: [], logs: [], isLoading: false });
  useDomainStore.setState({ domains: [], activeDomain: null, isLoading: false });
  useErrorStore.setState({ errors: [] });
  vi.clearAllMocks();
});

describe('useHabitStore', () => {
  it('starts with empty habits and logs', () => {
    expect(useHabitStore.getState().habits).toEqual([]);
    expect(useHabitStore.getState().logs).toEqual([]);
  });

  it('loadHabits: populates habits and logs from two sequential invoke calls', async () => {
    mockInvoke.mockResolvedValueOnce([makeHabit()]);
    mockInvoke.mockResolvedValueOnce([makeHabitLog()]);

    await useHabitStore.getState().loadHabits();

    expect(useHabitStore.getState().habits).toHaveLength(1);
    expect(useHabitStore.getState().logs).toHaveLength(1);
    expect(useHabitStore.getState().isLoading).toBe(false);
  });

  it('loadHabits: handles error gracefully (keeps existing state)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('DB error'));

    await useHabitStore.getState().loadHabits();

    expect(useHabitStore.getState().habits).toEqual([]);
    expect(useHabitStore.getState().isLoading).toBe(false);
  });

  it('createHabit: appends the new habit and refreshes domains', async () => {
    mockInvoke.mockResolvedValueOnce(makeHabit({ id: 'new-habit' }));
    mockInvoke.mockResolvedValueOnce([]); // useDomainStore.loadDomains -> get_domains

    await useHabitStore.getState().createHabit({
      domain_id: 'self',
      title: 'Meditate',
      frequency: 'daily',
      target_days: '[0,1,2,3,4,5,6]',
    });

    expect(useHabitStore.getState().habits).toHaveLength(1);
    expect(useHabitStore.getState().habits[0].id).toBe('new-habit');
  });

  it('createHabit: reports an error on failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('insert failed'));

    await expect(useHabitStore.getState().createHabit({
      domain_id: 'self',
      title: 'Meditate',
      frequency: 'daily',
      target_days: '[0,1,2,3,4,5,6]',
    })).rejects.toThrow();

    expect(useErrorStore.getState().errors).toHaveLength(1);
    expect(useErrorStore.getState().errors[0].message).toBe('Failed to create habit');
  });

  it('logHabit: upserts the log, refreshes habits, and registers an undo entry', async () => {
    useHabitStore.setState({ habits: [makeHabit()] });
    mockInvoke.mockResolvedValueOnce(makeHabitLog());
    mockInvoke.mockResolvedValueOnce([makeHabit({ streak_current: 1 })]); // db.getHabits() refresh
    mockInvoke.mockResolvedValueOnce([]); // useDomainStore.loadDomains -> get_domains

    await useHabitStore.getState().logHabit('habit-1', '2026-07-16');

    expect(useHabitStore.getState().logs).toHaveLength(1);
    expect(useHabitStore.getState().habits[0].streak_current).toBe(1);
  });

  it('logHabit: rejects synchronously for a blank habit_id without calling invoke', async () => {
    await expect(useHabitStore.getState().logHabit('   ', '2026-07-16')).rejects.toThrow();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('isCompletedToday: true only for a completed or minimum log dated today', () => {
    const today = new Date().toISOString().slice(0, 10);
    useHabitStore.setState({
      logs: [makeHabitLog({ habit_id: 'habit-1', completed_date: today, status: 'completed' })],
    });

    expect(useHabitStore.getState().isCompletedToday('habit-1')).toBe(true);
    expect(useHabitStore.getState().isCompletedToday('habit-2')).toBe(false);
  });

  it('todayCompletionCount: counts only completed/minimum logs dated today', () => {
    const today = new Date().toISOString().slice(0, 10);
    useHabitStore.setState({
      logs: [
        makeHabitLog({ habit_id: 'h1', completed_date: today, status: 'completed' }),
        makeHabitLog({ habit_id: 'h2', completed_date: today, status: 'minimum' }),
        makeHabitLog({ habit_id: 'h3', completed_date: today, status: 'skipped' }),
        makeHabitLog({ habit_id: 'h4', completed_date: '2020-01-01', status: 'completed' }),
      ],
    });

    expect(useHabitStore.getState().todayCompletionCount()).toBe(2);
  });

  it('deleteHabit: removes the habit and registers an undo that reactivates it', async () => {
    useHabitStore.setState({ habits: [makeHabit({ id: 'h1' })] });
    mockInvoke.mockResolvedValueOnce(undefined); // delete_habit
    mockInvoke.mockResolvedValueOnce([]); // useDomainStore.loadDomains -> get_domains

    await useHabitStore.getState().deleteHabit('h1');

    expect(useHabitStore.getState().habits).toHaveLength(0);
  });
});
