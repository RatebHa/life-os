import { create } from 'zustand';

export interface ErrorEntry {
  id: string;
  message: string;
}

interface ErrorStore {
  errors: ErrorEntry[];
  addError: (message: string) => void;
  dismissError: (id: string) => void;
}

let _counter = 0;

export const useErrorStore = create<ErrorStore>((set) => ({
  errors: [],

  addError: (message) => {
    const id = `err-${++_counter}`;
    set((state) => ({
      // cap at 3 visible errors
      errors: [...state.errors.slice(-2), { id, message }],
    }));
    setTimeout(() => {
      useErrorStore.getState().dismissError(id);
    }, 5000);
  },

  dismissError: (id) => {
    set((state) => ({ errors: state.errors.filter((e) => e.id !== id) }));
  },
}));
