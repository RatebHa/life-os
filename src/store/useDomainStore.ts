import { create } from 'zustand';
import type { CreateDomainPayload, Domain, DomainId, UpdateDomainProfilePayload } from '../lib/types';
import { db } from '../lib/db';
import { sortDomains } from '../lib/domain-utils';

interface DomainStore {
  domains: Domain[];
  activeDomain: DomainId | null;
  isLoading: boolean;

  loadDomains: () => Promise<void>;
  setDomains: (domains: Domain[]) => void;
  setActiveDomain: (id: DomainId | null) => void;
  getDomain: (id: DomainId) => Domain | undefined;
  refreshDomain: (id: DomainId) => Promise<void>;
  useStreakFreeze: (domainId: DomainId) => Promise<Domain>;
  createDomain: (payload: CreateDomainPayload) => Promise<Domain>;
  updateDomainProfile: (payload: UpdateDomainProfilePayload) => Promise<Domain>;
  deleteDomain: (id: DomainId) => Promise<void>;
}

export const useDomainStore = create<DomainStore>((set, get) => ({
  domains: [],
  activeDomain: null,
  isLoading: false,

  loadDomains: async () => {
    set({ isLoading: true });
    try {
      const domains = await db.getDomains();
      set({ domains: sortDomains(domains) });
    } catch (err) {
      console.error('Failed to load domains:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  setDomains: (domains) => set({ domains: sortDomains(domains) }),

  setActiveDomain: (id) => set({ activeDomain: id }),

  getDomain: (id) => get().domains.find((d) => d.id === id),

  refreshDomain: async (id) => {
    try {
      const domains = await db.getDomains();
      set({ domains: sortDomains(domains) });
    } catch (err) {
      console.error('Failed to refresh domain:', err);
    }
  },

  useStreakFreeze: async (domainId) => {
    try {
      const updated = await db.useStreakFreeze(domainId);
      set((state) => ({
        domains: state.domains.map((d) => d.id === domainId ? updated : d),
      }));
      return updated;
    } catch (err) {
      console.error('Failed to use streak freeze:', err);
      throw err;
    }
  },

  createDomain: async (payload) => {
    try {
      const created = await db.createDomain(payload);
      set((state) => ({
        domains: sortDomains([...state.domains, created]),
        activeDomain: state.activeDomain ?? created.id,
      }));
      return created;
    } catch (err) {
      console.error('Failed to create domain:', err);
      throw err;
    }
  },

  updateDomainProfile: async (payload) => {
    try {
      const updated = await db.updateDomainProfile(payload);
      set((state) => ({
        domains: sortDomains(state.domains.map((domain) => domain.id === updated.id ? updated : domain)),
      }));
      return updated;
    } catch (err) {
      console.error('Failed to update domain profile:', err);
      throw err;
    }
  },

  deleteDomain: async (id) => {
    try {
      await db.deleteDomain(id);
      set((state) => {
        const domains = sortDomains(state.domains.filter((domain) => domain.id !== id));
        return {
          domains,
          activeDomain: state.activeDomain === id ? domains[0]?.id ?? null : state.activeDomain,
        };
      });
    } catch (err) {
      console.error('Failed to delete domain:', err);
      throw err;
    }
  },
}));
