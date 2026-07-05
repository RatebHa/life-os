import { create } from 'zustand';
import type { AppStateRow, Achievement, DomainId } from '../lib/types';
import type { MomentumState } from '../lib/momentum';
import { getMomentumState } from '../lib/momentum';
import { db } from '../lib/db';

export interface LevelUpEvent {
  domainId: DomainId;
  newLevel: number;
}

interface AppStore {
  appState: AppStateRow | null;
  achievements: Achievement[];
  momentumState: MomentumState;
  isLoading: boolean;
  pendingUnlocks: Achievement[];
  levelUpEvent: LevelUpEvent | null;

  // Actions
  loadAppState: () => Promise<void>;
  loadAchievements: () => Promise<void>;
  updateMomentum: (score: number) => Promise<void>;
  setMitTask: (taskId: string | null) => Promise<void>;
  saveApiKey: (key: string) => Promise<void>;
  unlockAchievement: (id: string) => Promise<void>;
  dismissUnlock: (id: string) => void;
  triggerLevelUp: (domainId: DomainId, newLevel: number) => void;
  dismissLevelUp: () => void;
  resetData: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set, get) => ({
  appState: null,
  achievements: [],
  momentumState: 'normal',
  isLoading: false,
  pendingUnlocks: [],
  levelUpEvent: null,

  loadAppState: async () => {
    try {
      const appState = await db.getAppState();
      set({ appState, momentumState: getMomentumState(appState.momentum_score) });
    } catch (err) {
      console.error('Failed to load app state:', err);
    }
  },

  loadAchievements: async () => {
    try {
      const achievements = await db.getAchievements();
      set({ achievements });
    } catch (err) {
      console.error('Failed to load achievements:', err);
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

  unlockAchievement: async (id) => {
    const already = get().achievements.find((a) => a.id === id);
    if (already?.unlocked) return;
    try {
      const updated = await db.unlockAchievement(id);
      set((state) => ({
        achievements: state.achievements.map((a) => a.id === id ? updated : a),
        pendingUnlocks: [...state.pendingUnlocks, updated],
      }));
    } catch (err) {
      console.error('Failed to unlock achievement:', err);
    }
  },

  dismissUnlock: (id) => {
    set((state) => ({ pendingUnlocks: state.pendingUnlocks.filter((a) => a.id !== id) }));
  },

  triggerLevelUp: (domainId, newLevel) => {
    set({ levelUpEvent: { domainId, newLevel } });
  },

  dismissLevelUp: () => {
    set({ levelUpEvent: null });
  },

  resetData: async () => {
    try {
      await db.resetAllData();
      await get().loadAppState();
      await get().loadAchievements();
    } catch (err) {
      console.error('Failed to reset data:', err);
    }
  },
}));
