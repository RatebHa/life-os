import { create } from 'zustand';
import type { AppStateRow } from '../lib/types';
import type { MomentumState } from '../lib/momentum';
import { getMomentumState } from '../lib/momentum';
import { db } from '../lib/db';

interface AppStore {
  appState: AppStateRow | null;
  momentumState: MomentumState;
  isLoading: boolean;

  // Actions
  loadAppState: () => Promise<void>;
  updateMomentum: (score: number) => Promise<void>;
  setMitTask: (taskId: string | null) => Promise<void>;
  saveApiKey: (key: string) => Promise<void>;
  resetData: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  appState: null,
  momentumState: 'normal',
  isLoading: false,

  loadAppState: async () => {
    try {
      const appState = await db.getAppState();
      set({ appState, momentumState: getMomentumState(appState.momentum_score) });
    } catch (err) {
      console.error('Failed to load app state:', err);
    }
  },

  updateMomentum: async (score) => {
    try {
      await db.updateMomentum(score);
      set((state) => ({
        appState: state.appState ? { ...state.appState, momentum_score: score } : state.appState,
        momentumState: getMomentumState(score),
      }));
    } catch (err) {
      console.error('Failed to update momentum:', err);
    }
  },

  setMitTask: async (taskId) => {
    try {
      await db.setMitTask(taskId);
      set((state) => ({
        appState: state.appState ? { ...state.appState, current_mit_task_id: taskId } : state.appState,
      }));
    } catch (err) {
      console.error('Failed to set MIT:', err);
    }
  },

  saveApiKey: async (key) => {
    try {
      await db.saveApiKey(key);
      set((state) => ({
        appState: state.appState ? { ...state.appState, api_key: key } : state.appState,
      }));
    } catch (err) {
      console.error('Failed to save API key:', err);
    }
  },

  resetData: async () => {
    try {
      await db.resetAllData();
      await get().loadAppState();
    } catch (err) {
      console.error('Failed to reset data:', err);
    }
  },
}));
