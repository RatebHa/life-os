import { create } from 'zustand';
import type { Update } from '../lib/updater';
import { checkForUpdate, downloadUpdate, installAndRelaunch } from '../lib/updater';

export type UpdaterStatus = 'idle' | 'checking' | 'up_to_date' | 'available' | 'downloading' | 'ready' | 'error';

interface UpdaterStore {
  status: UpdaterStatus;
  version: string | null;
  error: string | null;
  update: Update | null;

  checkNow: () => Promise<void>;
  download: () => Promise<void>;
  restart: () => Promise<void>;
}

export const useUpdaterStore = create<UpdaterStore>((set, get) => ({
  status: 'idle',
  version: null,
  error: null,
  update: null,

  checkNow: async () => {
    set({ status: 'checking', error: null });
    try {
      const update = await checkForUpdate();
      if (update) {
        set({ status: 'available', version: update.version, update });
      } else {
        set({ status: 'up_to_date', update: null });
      }
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },

  download: async () => {
    const { update } = get();
    if (!update) return;
    set({ status: 'downloading', error: null });
    try {
      await downloadUpdate(update);
      set({ status: 'ready' });
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },

  restart: async () => {
    const { update } = get();
    if (!update) return;
    try {
      await installAndRelaunch(update);
    } catch (err) {
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
