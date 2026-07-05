import { create } from 'zustand';
import type { Task, CreateTaskPayload, UpdateTaskPayload, DomainId } from '../lib/types';
import { db } from '../lib/db';
import { useErrorStore } from './useErrorStore';
import { useGoalStore } from './useGoalStore';
import { useDomainStore } from './useDomainStore';
import { useUndoStore } from './useUndoStore';

interface TaskStore {
  tasks: Task[];
  isLoading: boolean;

  loadTasks: () => Promise<void>;
  createTask: (payload: CreateTaskPayload) => Promise<Task>;
  updateTask: (payload: UpdateTaskPayload) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<Task>;
  undoTaskCompletion: (id: string) => Promise<Task>;

  // Selectors
  tasksByDomain: (domainId: DomainId) => Task[];
  todayTasks: () => Task[];
  mitTask: () => Task | undefined;
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) === today;
}

function goalProgressForTasks(goalId: string, tasks: Task[]): number {
  const goalTasks = tasks.filter((task) => task.goal_id === goalId && task.status !== 'archived');
  const completedTasks = goalTasks.filter((task) => task.status === 'done').length;
  return goalTasks.length > 0 ? Math.round((completedTasks / goalTasks.length) * 100) : 0;
}

async function syncGoalProgressForTasks(goalId: string | null | undefined, tasks: Task[]): Promise<void> {
  if (!goalId) return;
  await useGoalStore.getState().updateGoal({
    id: goalId,
    progress_percent: goalProgressForTasks(goalId, tasks),
  });
}

async function refreshAfterTaskUndo(
  goalId: string | null | undefined,
  loadTasks: () => Promise<void>,
  readTasks: () => Task[],
): Promise<void> {
  await Promise.all([
    loadTasks(),
    useDomainStore.getState().loadDomains(),
  ]);
  await syncGoalProgressForTasks(goalId, readTasks());
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  isLoading: false,

  loadTasks: async () => {
    set({ isLoading: true });
    try {
      const tasks = await db.getTasks();
      set({ tasks });
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createTask: async (payload) => {
    try {
      const task = await db.createTask(payload);
      set((state) => ({ tasks: [task, ...state.tasks] }));
      return task;
    } catch (err) {
      useErrorStore.getState().addError('Failed to create task');
      throw err;
    }
  },

  updateTask: async (payload) => {
    try {
      const updated = await db.updateTask(payload);
      set((state) => ({
        tasks: state.tasks.map((t) => t.id === updated.id ? updated : t),
      }));
      return updated;
    } catch (err) {
      useErrorStore.getState().addError('Failed to update task');
      throw err;
    }
  },

  deleteTask: async (id) => {
    try {
      const taskSnapshot = get().tasks.find((task) => task.id === id);
      await db.deleteTask(id);
      const remainingTasks = get().tasks.filter((task) => task.id !== id);
      set({ tasks: remainingTasks });
      await syncGoalProgressForTasks(taskSnapshot?.goal_id, remainingTasks);
      if (taskSnapshot) {
        useUndoStore.getState().registerUndo({
          title: 'TASK DELETED',
          detail: taskSnapshot.title,
          undo: async () => {
            await db.restoreTask(taskSnapshot);
            await refreshAfterTaskUndo(taskSnapshot.goal_id, get().loadTasks, () => get().tasks);
          },
        });
      }
    } catch (err) {
      useErrorStore.getState().addError('Failed to delete task');
      throw err;
    }
  },

  completeTask: async (id) => {
    try {
      const task = get().tasks.find((t) => t.id === id);
      const previousTask = task ? { ...task } : null;
      const updated = await db.completeTask(id);
      let tasksAfterCompletion = get().tasks.map((t) => t.id === updated.id ? updated : t);
      set({ tasks: tasksAfterCompletion });
      // Auto-update goal progress when a linked task is completed
      if (updated.goal_id) {
        await syncGoalProgressForTasks(updated.goal_id, tasksAfterCompletion);
      }
      await useDomainStore.getState().loadDomains();
      if (previousTask) {
        useUndoStore.getState().registerUndo({
          title: 'TASK COMPLETED',
          detail: updated.title,
          undo: async () => {
            await db.undoCompleteTask(updated.id, previousTask.status);
            await refreshAfterTaskUndo(updated.goal_id, get().loadTasks, () => get().tasks);
          },
        });
      }
      return updated;
    } catch (err) {
      const detail = typeof err === 'string' ? err : (err instanceof Error ? err.message : String(err));
      useErrorStore.getState().addError(`Task error: ${detail.slice(0, 120)}`);
      throw err;
    }
  },

  undoTaskCompletion: async (id): Promise<Task> => {
    try {
      const task = get().tasks.find((item) => item.id === id);
      const updated = await db.undoCompleteTask(id, null);
      set((state) => ({
        tasks: state.tasks.map((item) => item.id === updated.id ? updated : item),
      }));
      await refreshAfterTaskUndo(task?.goal_id ?? updated.goal_id, get().loadTasks, () => get().tasks);
      return get().tasks.find((item) => item.id === id) ?? updated;
    } catch (err) {
      const detail = typeof err === 'string' ? err : (err instanceof Error ? err.message : String(err));
      useErrorStore.getState().addError(`Task error: ${detail.slice(0, 120)}`);
      throw err;
    }
  },

  tasksByDomain: (domainId) => get().tasks.filter((t) => t.domain_id === domainId && t.status !== 'archived'),

  todayTasks: () => {
    const today = new Date().toISOString().slice(0, 10);
    return get().tasks.filter((t) => {
      if (t.status === 'archived' || t.status === 'done' || t.task_kind === 'recurring_template') return false;
      if (t.is_mit || t.is_top_three || t.status === 'in_progress') return true;
      if (t.scheduled_for?.slice(0, 10) === today) return true;
      if (t.planned_for_date?.slice(0, 10) && t.planned_for_date.slice(0, 10) <= today) return true;
      if (t.due_date?.slice(0, 10) === today) return true;
      if (t.due_date?.slice(0, 10) && t.due_date.slice(0, 10) < today) return true;
      if (isToday(t.created_at)) return true;
      return false;
    });
  },

  mitTask: () => get().tasks.find((t) => t.is_mit && t.status !== 'done' && t.status !== 'archived'),
}));
