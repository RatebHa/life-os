import { create } from 'zustand';
import type { Goal, CreateGoalPayload, UpdateGoalPayload, DomainId } from '../lib/types';
import { db } from '../lib/db';
import { useErrorStore } from './useErrorStore';
import { useUndoStore } from './useUndoStore';

interface GoalStore {
  goals: Goal[];
  isLoading: boolean;

  loadGoals: () => Promise<void>;
  createGoal: (payload: CreateGoalPayload) => Promise<Goal>;
  updateGoal: (payload: UpdateGoalPayload) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;

  goalsByDomain: (domainId: DomainId) => Goal[];
  rootGoals: () => Goal[];
  subGoals: (parentId: string) => Goal[];
}

export const useGoalStore = create<GoalStore>((set, get) => ({
  goals: [],
  isLoading: false,

  loadGoals: async () => {
    set({ isLoading: true });
    try {
      const goals = await db.getGoals();
      set({ goals });
    } catch (err) {
      console.error('Failed to load goals:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createGoal: async (payload) => {
    try {
      const goal = await db.createGoal(payload);
      set((state) => ({ goals: [goal, ...state.goals] }));
      return goal;
    } catch (err) {
      useErrorStore.getState().addError('Failed to create goal');
      throw err;
    }
  },

  updateGoal: async (payload) => {
    try {
      const updated = await db.updateGoal(payload);
      set((state) => ({
        goals: state.goals.map((g) => g.id === updated.id ? updated : g),
      }));
      return updated;
    } catch (err) {
      useErrorStore.getState().addError('Failed to update goal');
      throw err;
    }
  },

  deleteGoal: async (id) => {
    try {
      const goalSnapshot = get().goals.find((goal) => goal.id === id);
      await db.deleteGoal(id);
      set((state) => ({ goals: state.goals.filter((g) => g.id !== id) }));
      if (goalSnapshot) {
        useUndoStore.getState().registerUndo({
          title: 'GOAL DELETED',
          detail: goalSnapshot.title,
          undo: async () => {
            await db.restoreGoal(goalSnapshot.id);
            await get().loadGoals();
          },
        });
      }
    } catch (err) {
      useErrorStore.getState().addError('Failed to delete goal');
      throw err;
    }
  },

  goalsByDomain: (domainId) => get().goals.filter((g) => g.domain_id === domainId && g.status !== 'archived'),

  rootGoals: () => get().goals.filter((g) => !g.parent_goal_id && g.status !== 'archived'),

  subGoals: (parentId) => get().goals.filter((g) => g.parent_goal_id === parentId),
}));
