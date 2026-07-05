import { create } from 'zustand';
import type { CreateTaskFrictionLogPayload, TaskFrictionLog } from '../lib/types';
import { db } from '../lib/db';
import { useErrorStore } from './useErrorStore';

interface FrictionStore {
  taskFrictionLogs: TaskFrictionLog[];
  isLoading: boolean;
  loadTaskFrictionLogs: (days?: number) => Promise<void>;
  createTaskFrictionLog: (payload: CreateTaskFrictionLogPayload) => Promise<TaskFrictionLog>;
}

export const useFrictionStore = create<FrictionStore>((set) => ({
  taskFrictionLogs: [],
  isLoading: false,

  loadTaskFrictionLogs: async (days = 90) => {
    set({ isLoading: true });
    try {
      const taskFrictionLogs = await db.getTaskFrictionLogs(days);
      set({ taskFrictionLogs });
    } catch (err) {
      console.error('Failed to load task friction logs:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createTaskFrictionLog: async (payload) => {
    try {
      const log = await db.createTaskFrictionLog(payload);
      set((state) => ({ taskFrictionLogs: [log, ...state.taskFrictionLogs] }));
      return log;
    } catch (err) {
      useErrorStore.getState().addError('Failed to save task friction');
      throw err;
    }
  },
}));
