import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useGoalStore } from '../useGoalStore';
import { useErrorStore } from '../useErrorStore';
import type { Goal } from '../../lib/types';

const mockInvoke = vi.mocked(invoke);

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    domain_id: 'builder',
    title: 'Ship the release',
    description: null,
    parent_goal_id: null,
    status: 'active',
    next_action: null,
    review_date: null,
    blocked_by: null,
    health: 'on_track',
    target_date: null,
    progress_percent: 0,
    created_at: '2026-07-16T09:00:00Z',
    updated_at: '2026-07-16T09:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  useGoalStore.setState({ goals: [], isLoading: false });
  useErrorStore.setState({ errors: [] });
  vi.clearAllMocks();
});

describe('useGoalStore', () => {
  it('loadGoals: populates goals from invoke result', async () => {
    mockInvoke.mockResolvedValueOnce([makeGoal({ id: 'g1' }), makeGoal({ id: 'g2' })]);

    await useGoalStore.getState().loadGoals();

    expect(useGoalStore.getState().goals).toHaveLength(2);
  });

  it('loadGoals: handles error gracefully (keeps existing state)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('DB error'));

    await useGoalStore.getState().loadGoals();

    expect(useGoalStore.getState().goals).toEqual([]);
    expect(useGoalStore.getState().isLoading).toBe(false);
  });

  it('createGoal: adds the goal to the front of the list', async () => {
    useGoalStore.setState({ goals: [makeGoal({ id: 'existing' })] });
    mockInvoke.mockResolvedValueOnce(makeGoal({ id: 'new-goal' }));

    await useGoalStore.getState().createGoal({ domain_id: 'builder', title: 'Ship the release' });

    const goals = useGoalStore.getState().goals;
    expect(goals[0].id).toBe('new-goal');
    expect(goals).toHaveLength(2);
  });

  it('createGoal: reports the static error string on failure', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('insert failed'));

    await expect(useGoalStore.getState().createGoal({ domain_id: 'builder', title: 'Ship' })).rejects.toThrow();

    expect(useErrorStore.getState().errors[0].message).toBe('Failed to create goal');
  });

  it('updateGoal: replaces the matching goal by id', async () => {
    useGoalStore.setState({ goals: [makeGoal({ id: 'g1', progress_percent: 0 })] });
    mockInvoke.mockResolvedValueOnce(makeGoal({ id: 'g1', progress_percent: 50 }));

    await useGoalStore.getState().updateGoal({ id: 'g1', progress_percent: 50 });

    expect(useGoalStore.getState().goals[0].progress_percent).toBe(50);
  });

  it('deleteGoal: removes the goal from the list', async () => {
    useGoalStore.setState({ goals: [makeGoal({ id: 'g1' }), makeGoal({ id: 'g2' })] });
    mockInvoke.mockResolvedValueOnce(undefined);

    await useGoalStore.getState().deleteGoal('g1');

    expect(useGoalStore.getState().goals).toHaveLength(1);
    expect(useGoalStore.getState().goals[0].id).toBe('g2');
  });

  it('deleteGoal: reports the static error string on failure', async () => {
    useGoalStore.setState({ goals: [makeGoal({ id: 'g1' })] });
    mockInvoke.mockRejectedValueOnce(new Error('delete failed'));

    await expect(useGoalStore.getState().deleteGoal('g1')).rejects.toThrow();

    expect(useErrorStore.getState().errors[0].message).toBe('Failed to delete goal');
  });

  it('goalsByDomain: filters by domain and excludes archived', () => {
    useGoalStore.setState({
      goals: [
        makeGoal({ id: 'g1', domain_id: 'builder', status: 'active' }),
        makeGoal({ id: 'g2', domain_id: 'self', status: 'active' }),
        makeGoal({ id: 'g3', domain_id: 'builder', status: 'archived' }),
      ],
    });

    const builderGoals = useGoalStore.getState().goalsByDomain('builder');
    expect(builderGoals).toHaveLength(1);
    expect(builderGoals[0].id).toBe('g1');
  });

  it('rootGoals: returns only goals with no parent, excluding archived', () => {
    useGoalStore.setState({
      goals: [
        makeGoal({ id: 'g1', parent_goal_id: null, status: 'active' }),
        makeGoal({ id: 'g2', parent_goal_id: 'g1', status: 'active' }),
        makeGoal({ id: 'g3', parent_goal_id: null, status: 'archived' }),
      ],
    });

    const roots = useGoalStore.getState().rootGoals();
    expect(roots).toHaveLength(1);
    expect(roots[0].id).toBe('g1');
  });

  it('subGoals: returns goals whose parent_goal_id matches', () => {
    useGoalStore.setState({
      goals: [
        makeGoal({ id: 'g1', parent_goal_id: null }),
        makeGoal({ id: 'g2', parent_goal_id: 'g1' }),
        makeGoal({ id: 'g3', parent_goal_id: 'g1' }),
      ],
    });

    const children = useGoalStore.getState().subGoals('g1');
    expect(children.map((g) => g.id).sort()).toEqual(['g2', 'g3']);
  });
});
