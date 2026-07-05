import { create } from 'zustand';
import type { CreateInboxItemPayload, InboxItem, InboxStatus, TriageInboxItemPayload } from '../lib/types';
import { db } from '../lib/db';
import { useErrorStore } from './useErrorStore';
import { useUndoStore } from './useUndoStore';

interface InboxStore {
  items: InboxItem[];
  isLoading: boolean;

  loadInbox: (status?: InboxStatus | null) => Promise<void>;
  captureInboxItem: (payload: CreateInboxItemPayload) => Promise<InboxItem>;
  triageInboxItem: (payload: TriageInboxItemPayload) => Promise<InboxItem>;
  deleteInboxItem: (id: string) => Promise<void>;

  pendingItems: () => InboxItem[];
  somedayItems: () => InboxItem[];
}

export const useInboxStore = create<InboxStore>((set, get) => ({
  items: [],
  isLoading: false,

  loadInbox: async (status) => {
    set({ isLoading: true });
    try {
      const items = await db.getInboxItems(status ?? null);
      set({ items });
    } catch (err) {
      console.error('Failed to load inbox:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  captureInboxItem: async (payload) => {
    try {
      const item = await db.createInboxItem(payload);
      set((state) => ({ items: [item, ...state.items] }));
      return item;
    } catch (err) {
      useErrorStore.getState().addError('Failed to capture item to inbox');
      throw err;
    }
  },

  triageInboxItem: async (payload) => {
    try {
      const updated = await db.triageInboxItem(payload);
      set((state) => ({
        items: state.items.map((item) => item.id === updated.id ? updated : item),
      }));
      return updated;
    } catch (err) {
      useErrorStore.getState().addError('Failed to triage inbox item');
      throw err;
    }
  },

  deleteInboxItem: async (id) => {
    try {
      const snapshot = get().items.find((item) => item.id === id);
      await db.deleteInboxItem(id);
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
      if (snapshot) {
        useUndoStore.getState().registerUndo({
          title: 'INBOX ITEM DELETED',
          detail: snapshot.content.slice(0, 48),
          undo: async () => {
            await db.restoreInboxItem(snapshot.id);
            await get().loadInbox();
          },
        });
      }
    } catch (err) {
      useErrorStore.getState().addError('Failed to delete inbox item');
      throw err;
    }
  },

  pendingItems: () => get().items.filter((item) => item.status === 'pending'),
  somedayItems: () => get().items.filter((item) => item.status === 'someday'),
}));
