import { create } from 'zustand';

export interface DebugEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  detail?: string;
  created_at: string;
}

interface DebugStore {
  entries: DebugEntry[];
  open: boolean;
  addEntry: (entry: Omit<DebugEntry, 'id' | 'created_at'>) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
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
  },

  clear: () => set({ entries: [] }),
  setOpen: (open) => set({ open }),
  toggleOpen: () => set((state) => ({ open: !state.open })),
}));

