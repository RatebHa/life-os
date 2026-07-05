import { create } from 'zustand';
import type { FocusTimerDraft } from '../lib/types';
import { db } from '../lib/db';

type DraftMap = Record<string, FocusTimerDraft>;

function computeElapsedSeconds(draft: FocusTimerDraft): number {
  if (!draft.is_running || !draft.last_started_at) return draft.elapsed_seconds;
  const startedAt = new Date(draft.last_started_at).getTime();
  if (Number.isNaN(startedAt)) return draft.elapsed_seconds;
  return draft.elapsed_seconds + Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function pauseDraft(draft: FocusTimerDraft): FocusTimerDraft {
  return {
    ...draft,
    elapsed_seconds: computeElapsedSeconds(draft),
    is_running: false,
    last_started_at: null,
    updated_at: new Date().toISOString(),
  };
}

function latestDraftId(drafts: DraftMap): string | null {
  const values = Object.values(drafts);
  if (values.length === 0) return null;
  values.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
  return values[0]?.task_id ?? null;
}

interface TimerStore {
  drafts: DraftMap;
  activeTaskId: string | null;
  tickKey: number;
  showSummary: boolean;
  isHydrated: boolean;

  loadDrafts: () => Promise<void>;
  startTimer: (taskId: string, plannedMinutes?: number) => Promise<void>;
  activateTask: (taskId: string | null) => void;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  stopTimer: () => Promise<void>;
  openSummary: () => Promise<void>;
  closeSummary: () => void;
  setPlannedMinutes: (minutes: number) => Promise<void>;
  addDistraction: () => Promise<void>;
  setInterruptionNotes: (notes: string) => Promise<void>;
  setReflection: (reflection: string) => Promise<void>;
  stopTimerAndSave: () => Promise<void>;
  tick: () => void;
  getActiveDraft: () => FocusTimerDraft | null;
  getElapsedMinutes: () => number;
}

async function persistDraft(draft: FocusTimerDraft): Promise<FocusTimerDraft> {
  return db.saveFocusTimerDraft({
    task_id: draft.task_id,
    planned_minutes: draft.planned_minutes,
    elapsed_seconds: draft.elapsed_seconds,
    distraction_count: draft.distraction_count,
    interruption_notes: draft.interruption_notes ?? undefined,
    reflection: draft.reflection ?? undefined,
    is_running: draft.is_running,
    last_started_at: draft.last_started_at,
  });
}

export const useTimerStore = create<TimerStore>((set, get) => ({
  drafts: {},
  activeTaskId: null,
  tickKey: 0,
  showSummary: false,
  isHydrated: false,

  loadDrafts: async () => {
    const drafts = await db.getFocusTimerDrafts();
    const normalizedEntries = await Promise.all(drafts.map(async (draft) => {
      if (!draft.is_running) return draft;
      const paused = pauseDraft(draft);
      try {
        await persistDraft(paused);
      } catch {
        return paused;
      }
      return paused;
    }));

    const draftMap = normalizedEntries.reduce<DraftMap>((acc, draft) => {
      acc[draft.task_id] = draft;
      return acc;
    }, {});

    set({
      drafts: draftMap,
      activeTaskId: latestDraftId(draftMap),
      isHydrated: true,
    });
  },

  startTimer: async (taskId, plannedMinutes = 25) => {
    const nowIso = new Date().toISOString();
    const { activeTaskId, drafts } = get();

    if (activeTaskId && activeTaskId !== taskId && drafts[activeTaskId]) {
      const pausedCurrent = pauseDraft(drafts[activeTaskId]);
      set((state) => ({
        drafts: { ...state.drafts, [activeTaskId]: pausedCurrent },
      }));
      void persistDraft(pausedCurrent).catch(console.error);
    }

    const current = drafts[taskId];
    const nextDraft: FocusTimerDraft = {
      task_id: taskId,
      planned_minutes: Math.max(5, current?.planned_minutes ?? plannedMinutes),
      elapsed_seconds: current ? computeElapsedSeconds(current) : 0,
      distraction_count: current?.distraction_count ?? 0,
      interruption_notes: current?.interruption_notes ?? null,
      reflection: current?.reflection ?? null,
      is_running: true,
      last_started_at: nowIso,
      updated_at: nowIso,
    };

    set((state) => ({
      drafts: { ...state.drafts, [taskId]: nextDraft },
      activeTaskId: taskId,
      showSummary: false,
    }));
    void persistDraft(nextDraft).catch(console.error);
  },

  activateTask: (taskId) => set({ activeTaskId: taskId }),

  pauseTimer: async () => {
    const { activeTaskId, drafts } = get();
    if (!activeTaskId || !drafts[activeTaskId]) return;
    const paused = pauseDraft(drafts[activeTaskId]);
    set((state) => ({
      drafts: { ...state.drafts, [activeTaskId]: paused },
    }));
    await persistDraft(paused);
  },

  resumeTimer: async () => {
    const { activeTaskId, drafts } = get();
    if (!activeTaskId || !drafts[activeTaskId]) return;
    const resumed: FocusTimerDraft = {
      ...drafts[activeTaskId],
      elapsed_seconds: computeElapsedSeconds(drafts[activeTaskId]),
      is_running: true,
      last_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      drafts: { ...state.drafts, [activeTaskId]: resumed },
    }));
    await persistDraft(resumed);
  },

  stopTimer: async () => {
    const { activeTaskId } = get();
    if (activeTaskId) {
      await db.clearFocusTimerDraft(activeTaskId);
    }
    set((state) => {
      if (!activeTaskId) return state;
      const drafts = { ...state.drafts };
      delete drafts[activeTaskId];
      return {
        drafts,
        activeTaskId: latestDraftId(drafts),
        showSummary: false,
      };
    });
  },

  openSummary: async () => {
    await get().pauseTimer();
    set({ showSummary: true });
  },

  closeSummary: () => set({ showSummary: false }),

  setPlannedMinutes: async (minutes) => {
    const { activeTaskId, drafts } = get();
    if (!activeTaskId || !drafts[activeTaskId]) return;
    const nextDraft = {
      ...drafts[activeTaskId],
      planned_minutes: Math.max(5, minutes),
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      drafts: { ...state.drafts, [activeTaskId]: nextDraft },
    }));
    await persistDraft(nextDraft);
  },

  addDistraction: async () => {
    const { activeTaskId, drafts } = get();
    if (!activeTaskId || !drafts[activeTaskId]) return;
    const nextDraft = {
      ...drafts[activeTaskId],
      distraction_count: drafts[activeTaskId].distraction_count + 1,
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      drafts: { ...state.drafts, [activeTaskId]: nextDraft },
    }));
    await persistDraft(nextDraft);
  },

  setInterruptionNotes: async (notes) => {
    const { activeTaskId, drafts } = get();
    if (!activeTaskId || !drafts[activeTaskId]) return;
    const nextDraft = {
      ...drafts[activeTaskId],
      interruption_notes: notes || null,
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      drafts: { ...state.drafts, [activeTaskId]: nextDraft },
    }));
    await persistDraft(nextDraft);
  },

  setReflection: async (reflection) => {
    const { activeTaskId, drafts } = get();
    if (!activeTaskId || !drafts[activeTaskId]) return;
    const nextDraft = {
      ...drafts[activeTaskId],
      reflection: reflection || null,
      updated_at: new Date().toISOString(),
    };
    set((state) => ({
      drafts: { ...state.drafts, [activeTaskId]: nextDraft },
    }));
    await persistDraft(nextDraft);
  },

  stopTimerAndSave: async () => {
    const activeDraft = get().getActiveDraft();
    if (!activeDraft) return;
    const startedAt = activeDraft.last_started_at ?? activeDraft.updated_at;
    const actualMinutes = Math.max(1, Math.floor(computeElapsedSeconds(activeDraft) / 60));

    try {
      const { useFocusStore } = await import('./useFocusStore');
      await useFocusStore.getState().completeFocusSession({
        task_id: activeDraft.task_id,
        planned_minutes: activeDraft.planned_minutes,
        actual_minutes: actualMinutes,
        distraction_count: activeDraft.distraction_count,
        interruption_notes: activeDraft.interruption_notes ?? undefined,
        reflection: activeDraft.reflection ?? undefined,
        started_at: startedAt,
        ended_at: new Date().toISOString(),
      });
      const { useTaskStore } = await import('./useTaskStore');
      await useTaskStore.getState().loadTasks();
    } finally {
      await get().stopTimer();
    }
  },

  tick: () => set((state) => ({ tickKey: state.tickKey + 1 })),

  getActiveDraft: () => {
    const { activeTaskId, drafts } = get();
    return activeTaskId ? drafts[activeTaskId] ?? null : null;
  },

  getElapsedMinutes: () => {
    const activeDraft = get().getActiveDraft();
    if (!activeDraft) return 0;
    return Math.max(0, Math.floor(computeElapsedSeconds(activeDraft) / 60));
  },
}));
