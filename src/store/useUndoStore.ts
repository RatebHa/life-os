import { create } from 'zustand';
import { useErrorStore } from './useErrorStore';

export interface UndoEntry {
  id: string;
  title: string;
  detail: string;
  createdAt: number;
  expiresAt: number;
  isUndoing: boolean;
  undo: () => Promise<void>;
}

interface RegisterUndoInput {
  title: string;
  detail: string;
  durationMs?: number;
  undo: () => Promise<void>;
}

interface UndoStore {
  entries: UndoEntry[];
  registerUndo: (input: RegisterUndoInput) => void;
  dismissUndo: (id: string) => void;
  undoEntry: (id: string) => Promise<void>;
  undoLatest: () => Promise<void>;
}

let counter = 0;
const timers = new Map<string, number>();

function clearUndoTimer(id: string): void {
  const timer = timers.get(id);
  if (typeof timer === 'number') {
    window.clearTimeout(timer);
    timers.delete(id);
  }
}

export const useUndoStore = create<UndoStore>((set, get) => ({
  entries: [],

  registerUndo: ({ title, detail, durationMs = 8000, undo }) => {
    const id = `undo-${++counter}`;
    const entry: UndoEntry = {
      id,
      title,
      detail,
      createdAt: Date.now(),
      expiresAt: Date.now() + durationMs,
      isUndoing: false,
      undo,
    };

    set((state) => {
      const trimmed = state.entries.slice(-2);
      if (state.entries.length >= 3) {
        clearUndoTimer(state.entries[0].id);
      }
      return { entries: [...trimmed, entry] };
    });

    const timeout = window.setTimeout(() => {
      get().dismissUndo(id);
    }, durationMs);
    timers.set(id, timeout);
  },

  dismissUndo: (id) => {
    clearUndoTimer(id);
    set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) }));
  },

  undoEntry: async (id) => {
    const entry = get().entries.find((item) => item.id === id);
    if (!entry || entry.isUndoing) return;

    clearUndoTimer(id);
    set((state) => ({
      entries: state.entries.map((item) => item.id === id ? { ...item, isUndoing: true } : item),
    }));

    try {
      await entry.undo();
      set((state) => ({ entries: state.entries.filter((item) => item.id !== id) }));
    } catch (error) {
      useErrorStore.getState().addError('Could not undo that action');
      set((state) => ({ entries: state.entries.filter((item) => item.id !== id) }));
      throw error;
    }
  },

  undoLatest: async () => {
    const entries = get().entries;
    const latest = entries[entries.length - 1];
    if (!latest) return;
    await get().undoEntry(latest.id);
  },
}));
