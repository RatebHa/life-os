import { create } from 'zustand';
import type { CreateTaskTemplatePayload, TaskTemplate, UpdateTaskTemplatePayload } from '../lib/types';
import { db } from '../lib/db';
import { useErrorStore } from './useErrorStore';

interface TemplateStore {
  taskTemplates: TaskTemplate[];
  isLoading: boolean;

  loadTaskTemplates: () => Promise<void>;
  createTaskTemplate: (payload: CreateTaskTemplatePayload) => Promise<TaskTemplate>;
  updateTaskTemplate: (payload: UpdateTaskTemplatePayload) => Promise<TaskTemplate>;
  deleteTaskTemplate: (id: string) => Promise<void>;
}

export const useTemplateStore = create<TemplateStore>((set) => ({
  taskTemplates: [],
  isLoading: false,

  loadTaskTemplates: async () => {
    set({ isLoading: true });
    try {
      const taskTemplates = await db.getTaskTemplates();
      set({ taskTemplates });
    } catch (err) {
      console.error('Failed to load task templates:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createTaskTemplate: async (payload) => {
    try {
      const taskTemplate = await db.createTaskTemplate(payload);
      set((state) => ({ taskTemplates: [taskTemplate, ...state.taskTemplates] }));
      return taskTemplate;
    } catch (err) {
      useErrorStore.getState().addError('Failed to create task template');
      throw err;
    }
  },

  updateTaskTemplate: async (payload) => {
    try {
      const updated = await db.updateTaskTemplate(payload);
      set((state) => ({
        taskTemplates: state.taskTemplates.map((template) => template.id === updated.id ? updated : template),
      }));
      return updated;
    } catch (err) {
      useErrorStore.getState().addError('Failed to update task template');
      throw err;
    }
  },

  deleteTaskTemplate: async (id) => {
    try {
      await db.deleteTaskTemplate(id);
      set((state) => ({ taskTemplates: state.taskTemplates.filter((template) => template.id !== id) }));
    } catch (err) {
      useErrorStore.getState().addError('Failed to delete task template');
      throw err;
    }
  },
}));
