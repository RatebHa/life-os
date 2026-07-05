import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useTaskStore } from '../useTaskStore';
import type { Task } from '../../lib/types';

const mockInvoke = vi.mocked(invoke);

const TODAY = new Date().toISOString().slice(0, 10);

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    domain_id: 'military',
    title: 'Test task',
    description: null,
    priority: 'medium',
    status: 'todo',
    is_mit: false,
    is_top_three: false,
    xp_value: 30,
    xp_awarded: false,
    parent_task_id: null,
    goal_id: null,
    tags: '[]',
    time_estimate_minutes: null,
    due_date: null,
    planned_for_date: null,
    task_kind: 'standard',
    scheduled_for: null,
    recurring_template_id: null,
    recurrence_type: null,
    recurrence_interval: null,
    recurrence_days: '[]',
    recurrence_anchor_date: null,
    completed_at: null,
    created_at: `${TODAY}T09:00:00Z`,
    updated_at: `${TODAY}T09:00:00Z`,
    attachments: '[]',
    recurrence_rule: null,
    time_actual_minutes: null,
    energy_level: 'medium',
    ...overrides,
  };
}

// Reset Zustand store state and mocks before each test
beforeEach(() => {
  useTaskStore.setState({ tasks: [], isLoading: false });
  vi.clearAllMocks();
});

describe('useTaskStore', () => {
  it('starts with empty tasks array', () => {
    expect(useTaskStore.getState().tasks).toEqual([]);
    expect(useTaskStore.getState().isLoading).toBe(false);
  });

  it('loadTasks: populates tasks from invoke result', async () => {
    const tasks = [makeTask({ id: 't1' }), makeTask({ id: 't2' })];
    mockInvoke.mockResolvedValueOnce(tasks);

    await useTaskStore.getState().loadTasks();

    expect(useTaskStore.getState().tasks).toHaveLength(2);
    expect(useTaskStore.getState().isLoading).toBe(false);
  });

  it('loadTasks: handles error gracefully (keeps existing state)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('DB error'));

    await useTaskStore.getState().loadTasks();

    expect(useTaskStore.getState().tasks).toEqual([]);
    expect(useTaskStore.getState().isLoading).toBe(false);
  });

  it('createTask: adds task to front of list', async () => {
    const existing = makeTask({ id: 'existing' });
    const newTask = makeTask({ id: 'new-task', title: 'New Task' });
    useTaskStore.setState({ tasks: [existing] });
    mockInvoke.mockResolvedValueOnce(newTask);

    await useTaskStore.getState().createTask({
      domain_id: 'military',
      title: 'New Task',
      priority: 'medium',
      is_mit: false,
    });

    const tasks = useTaskStore.getState().tasks;
    expect(tasks[0].id).toBe('new-task');
    expect(tasks).toHaveLength(2);
  });

  it('updateTask: replaces the matching task by id', async () => {
    const original = makeTask({ id: 't1', title: 'Original' });
    const updated = makeTask({ id: 't1', title: 'Updated' });
    useTaskStore.setState({ tasks: [original] });
    mockInvoke.mockResolvedValueOnce(updated);

    await useTaskStore.getState().updateTask({ id: 't1', title: 'Updated' });

    expect(useTaskStore.getState().tasks[0].title).toBe('Updated');
  });

  it('deleteTask: removes task from list', async () => {
    useTaskStore.setState({ tasks: [makeTask({ id: 't1' }), makeTask({ id: 't2' })] });
    mockInvoke.mockResolvedValue(undefined); // delete_task + any post-action calls

    await useTaskStore.getState().deleteTask('t1');

    expect(useTaskStore.getState().tasks).toHaveLength(1);
    expect(useTaskStore.getState().tasks[0].id).toBe('t2');
  });

  it('completeTask: updates status on the matching task', async () => {
    const task = makeTask({ id: 't1' });
    const completed = makeTask({ id: 't1', status: 'done', completed_at: `${TODAY}T10:00:00Z` });
    useTaskStore.setState({ tasks: [task] });
    mockInvoke.mockResolvedValueOnce(completed);
    mockInvoke.mockResolvedValue([]); // post-action: getDomains, getAppState, etc.

    await useTaskStore.getState().completeTask('t1');

    expect(useTaskStore.getState().tasks[0].status).toBe('done');
  });

  it('tasksByDomain: filters by domain and excludes archived', () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 't1', domain_id: 'military', status: 'todo' }),
        makeTask({ id: 't2', domain_id: 'builder', status: 'todo' }),
        makeTask({ id: 't3', domain_id: 'military', status: 'archived' }),
      ],
    });

    const military = useTaskStore.getState().tasksByDomain('military');
    expect(military).toHaveLength(1);
    expect(military[0].id).toBe('t1');
  });

  it('mitTask: returns first active MIT task', () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 't1', is_mit: false }),
        makeTask({ id: 't2', is_mit: true, status: 'todo' }),
        makeTask({ id: 't3', is_mit: true, status: 'done' }),
      ],
    });

    expect(useTaskStore.getState().mitTask()?.id).toBe('t2');
  });

  it('todayTasks: includes due today, created today, overdue work, and tasks whose start date has arrived', () => {
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 't1', due_date: `${TODAY}T23:59:59Z`, status: 'todo', created_at: '2020-01-01T00:00:00Z' }),
        makeTask({ id: 't2', due_date: null, status: 'todo', created_at: `${TODAY}T00:00:00Z` }),
        makeTask({ id: 't3', due_date: '2020-01-01', status: 'todo', created_at: '2020-01-01T00:00:00Z' }),
        makeTask({ id: 't4', planned_for_date: '2020-01-02', status: 'todo', created_at: '2020-01-01T00:00:00Z' }),
        makeTask({ id: 't5', due_date: `${TODAY}T00:00:00Z`, status: 'done' }),
      ],
    });

    const today = useTaskStore.getState().todayTasks();
    const ids = today.map((t) => t.id);
    expect(ids).toContain('t1');
    expect(ids).toContain('t2');
    expect(ids).toContain('t3');
    expect(ids).toContain('t4');
    expect(ids).not.toContain('t5');
  });
});
