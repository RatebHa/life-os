import { create } from 'zustand';
import type { CompleteFocusSessionPayload, FocusSession } from '../lib/types';
import { db } from '../lib/db';
import { useErrorStore } from './useErrorStore';

interface FocusStore {
  sessions: FocusSession[];
  isLoading: boolean;
  loadFocusSessions: (days?: number) => Promise<void>;
  completeFocusSession: (payload: CompleteFocusSessionPayload) => Promise<FocusSession>;
}

export const useFocusStore = create<FocusStore>((set) => ({
  sessions: [],
  isLoading: false,

  loadFocusSessions: async (days = 30) => {
    set({ isLoading: true });
    try {
      const sessions = await db.getFocusSessions(days);
      set({ sessions });
    } catch (err) {
      console.error('Failed to load focus sessions:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  completeFocusSession: async (payload) => {
    try {
      const session = await db.completeFocusSession(payload);
      set((state) => ({ sessions: [session, ...state.sessions] }));
      return session;
    } catch (err) {
      useErrorStore.getState().addError('Failed to save focus session');
      throw err;
    }
  },
}));
