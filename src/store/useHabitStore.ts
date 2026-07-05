import { create } from 'zustand';
import type { Habit, HabitLog, CreateHabitPayload, UpdateHabitPayload } from '../lib/types';
import { db } from '../lib/db';
import { useErrorStore } from './useErrorStore';
import { useDomainStore } from './useDomainStore';
import { useUndoStore } from './useUndoStore';

interface HabitStore {
  habits: Habit[];
  logs: HabitLog[];
  isLoading: boolean;

  loadHabits: () => Promise<void>;
  loadLogsRange: (start: string, end: string) => Promise<void>;
  createHabit: (payload: CreateHabitPayload) => Promise<Habit>;
  updateHabit: (payload: UpdateHabitPayload) => Promise<Habit>;
  logHabit: (habitId: string, date: string, valueCompleted?: number) => Promise<HabitLog>;
  logHabitMinimum: (habitId: string, date: string, valueCompleted?: number) => Promise<HabitLog>;
  skipHabit: (habitId: string, date: string, reason: string) => Promise<HabitLog>;
  undoHabitLog: (habitId: string, date: string) => Promise<void>;
  restartHabit: (habitId: string) => Promise<Habit>;
  deleteHabit: (id: string) => Promise<void>;

  isCompletedToday: (habitId: string) => boolean;
  todayCompletionCount: () => number;
}

async function refreshHabitState(): Promise<void> {
  await Promise.all([
    useHabitStore.getState().loadHabits(),
    useDomainStore.getState().loadDomains(),
  ]);
}

export const useHabitStore = create<HabitStore>((set, get) => ({
  habits: [],
  logs: [],
  isLoading: false,

  loadHabits: async () => {
    set({ isLoading: true });
    try {
      const habits = await db.getHabits();
      const today = new Date().toISOString().slice(0, 10);
      const oneTwentyDaysAgo = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
      const logs = await db.getHabitLogsRange(oneTwentyDaysAgo, today);
      set({ habits, logs });
    } catch (err) {
      console.error('Failed to load habits:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  loadLogsRange: async (start, end) => {
    try {
      const logs = await db.getHabitLogsRange(start, end);
      set({ logs });
    } catch (err) {
      console.error('Failed to load habit logs:', err);
    }
  },

  createHabit: async (payload) => {
    try {
      const habit = await db.createHabit(payload);
      set((state) => ({ habits: [...state.habits, habit] }));
      await useDomainStore.getState().loadDomains();
      return habit;
    } catch (err) {
      useErrorStore.getState().addError('Failed to create habit');
      throw err;
    }
  },

  updateHabit: async (payload) => {
    try {
      const updated = await db.updateHabit(payload);
      set((state) => ({
        habits: state.habits.map((habit) => (habit.id === updated.id ? updated : habit)),
      }));
      return updated;
    } catch (err) {
      useErrorStore.getState().addError('Failed to update habit');
      throw err;
    }
  },

  logHabit: async (habitId, date, valueCompleted) => {
    try {
      const log = await db.logHabit(habitId, date, valueCompleted);
      const habit = get().habits.find((item) => item.id === habitId);
      const habits = await db.getHabits();
      set((state) => ({
        logs: [...state.logs.filter((item) => !(item.habit_id === habitId && item.completed_date === date)), log],
        habits,
      }));
      await useDomainStore.getState().loadDomains();
      if (habit) {
        useUndoStore.getState().registerUndo({
          title: 'HABIT LOGGED',
          detail: `${habit.title} · ${log.status.toUpperCase()}`,
          undo: async () => {
            await db.undoHabitLog(habitId, date);
            await refreshHabitState();
          },
        });
      }
      return log;
    } catch (err) {
      const detail = typeof err === 'string' ? err : (err instanceof Error ? err.message : String(err));
      useErrorStore.getState().addError(`Habit error: ${detail.slice(0, 120)}`);
      throw err;
    }
  },

  logHabitMinimum: async (habitId, date, valueCompleted) => {
    try {
      const log = await db.logHabitMinimum(habitId, date, valueCompleted);
      const habit = get().habits.find((item) => item.id === habitId);
      const habits = await db.getHabits();
      set((state) => ({
        logs: [...state.logs.filter((item) => !(item.habit_id === habitId && item.completed_date === date)), log],
        habits,
      }));
      await useDomainStore.getState().loadDomains();
      if (habit) {
        useUndoStore.getState().registerUndo({
          title: 'MINIMUM LOGGED',
          detail: `${habit.title} · MINIMUM`,
          undo: async () => {
            await db.undoHabitLog(habitId, date);
            await refreshHabitState();
          },
        });
      }
      return log;
    } catch (err) {
      const detail = typeof err === 'string' ? err : (err instanceof Error ? err.message : String(err));
      useErrorStore.getState().addError(`Habit error: ${detail.slice(0, 120)}`);
      throw err;
    }
  },

  skipHabit: async (habitId, date, reason) => {
    try {
      const log = await db.skipHabit(habitId, date, reason);
      const habit = get().habits.find((item) => item.id === habitId);
      const habits = await db.getHabits();
      set((state) => ({
        logs: [...state.logs.filter((item) => !(item.habit_id === habitId && item.completed_date === date)), log],
        habits,
      }));
      await useDomainStore.getState().loadDomains();
      if (habit) {
        useUndoStore.getState().registerUndo({
          title: 'HABIT SKIPPED',
          detail: `${habit.title} · ${reason}`,
          undo: async () => {
            await db.undoHabitLog(habitId, date);
            await refreshHabitState();
          },
        });
      }
      return log;
    } catch (err) {
      const detail = typeof err === 'string' ? err : (err instanceof Error ? err.message : String(err));
      useErrorStore.getState().addError(`Habit error: ${detail.slice(0, 120)}`);
      throw err;
    }
  },

  undoHabitLog: async (habitId, date) => {
    try {
      await db.undoHabitLog(habitId, date);
      await refreshHabitState();
    } catch (err) {
      const detail = typeof err === 'string' ? err : (err instanceof Error ? err.message : String(err));
      useErrorStore.getState().addError(`Habit error: ${detail.slice(0, 120)}`);
      throw err;
    }
  },

  restartHabit: async (habitId) => {
    try {
      const updated = await db.restartHabit(habitId);
      set((state) => ({
        habits: state.habits.map((habit) => (habit.id === updated.id ? updated : habit)),
      }));
      await useDomainStore.getState().loadDomains();
      return updated;
    } catch (err) {
      useErrorStore.getState().addError('Failed to restart habit');
      throw err;
    }
  },

  deleteHabit: async (id) => {
    try {
      const habitSnapshot = get().habits.find((habit) => habit.id === id);
      await db.deleteHabit(id);
      set((state) => ({ habits: state.habits.filter((habit) => habit.id !== id) }));
      await useDomainStore.getState().loadDomains();
      if (habitSnapshot) {
        useUndoStore.getState().registerUndo({
          title: 'HABIT ARCHIVED',
          detail: habitSnapshot.title,
          undo: async () => {
            await db.updateHabit({ id: habitSnapshot.id, is_active: true });
            await refreshHabitState();
          },
        });
      }
    } catch (err) {
      useErrorStore.getState().addError('Failed to delete habit');
      throw err;
    }
  },

  isCompletedToday: (habitId) => {
    const today = new Date().toISOString().slice(0, 10);
    return get().logs.some(
      (log) => log.habit_id === habitId
        && log.completed_date === today
        && (log.status === 'completed' || log.status === 'minimum'),
    );
  },

  todayCompletionCount: () => {
    const today = new Date().toISOString().slice(0, 10);
    return get().logs.filter(
      (log) => log.completed_date === today && (log.status === 'completed' || log.status === 'minimum'),
    ).length;
  },
}));
