import { create } from 'zustand';
import type { DebugEntry } from '../lib/types';
import { db } from '../lib/db';

interface DebugStore {
  entries: DebugEntry[];
  open: boolean;
  addEntry: (entry: Omit<DebugEntry, 'id' | 'created_at'>) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  loadDebugLog: () => Promise<void>;
}

let debugCounter = 0;

export const useDebugStore = create<DebugStore>((set) => ({
  entries: [],
  open: false,

  addEntry: (entry) => {
    const nextEntry: DebugEntry = {
      id: `dbg-${++debugCounter}`,
      created_at: new Date().toISOString(),
      ...entry,
    };

    set((state) => ({
      entries: [...state.entries.slice(-119), nextEntry],
      open: state.open || entry.level === 'error',
    }));

    db.logDebugEntry({
      level: entry.level,
      scope: entry.scope,
      message: entry.message,
      detail: entry.detail,
    }).catch(() => {});
  },

  clear: () => {
    set({ entries: [] });
    db.clearDebugLog().catch(() => {});
  },

  setOpen: (open) => set({ open }),
  toggleOpen: () => set((state) => ({ open: !state.open })),

  loadDebugLog: async () => {
    try {
      const loaded = await db.getDebugLog();
      set((state) => ({ entries: [...loaded, ...state.entries].slice(-119) }));
    } catch (err) {
      console.error('Failed to load debug log:', err);
    }
  },
}));
