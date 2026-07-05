import { create } from 'zustand';
import type { CalendarDay } from '../lib/types';
import { db } from '../lib/db';

interface CalendarStore {
  year: number;
  month: number; // 1-12
  selectedDate: string | null;
  days: CalendarDay[];
  isLoading: boolean;

  loadMonth: (year?: number, month?: number) => Promise<void>;
  nextMonth: () => void;
  prevMonth: () => void;
  selectDate: (date: string | null) => void;
  dayData: (date: string) => CalendarDay | undefined;
}

export const useCalendarStore = create<CalendarStore>((set, get) => {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    selectedDate: null,
    days: [],
    isLoading: false,

    loadMonth: async (year, month) => {
      const y = year ?? get().year;
      const m = month ?? get().month;
      set({ isLoading: true, year: y, month: m });
      try {
        const days = await db.getCalendarData(y, m);
        set({ days });
      } catch (err) {
        console.error('Failed to load calendar:', err);
      } finally {
        set({ isLoading: false });
      }
    },

    nextMonth: () => {
      const { year, month } = get();
      const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
      get().loadMonth(next.year, next.month);
    },

    prevMonth: () => {
      const { year, month } = get();
      const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
      get().loadMonth(prev.year, prev.month);
    },

    selectDate: (date) => set({ selectedDate: date }),
    dayData: (date) => get().days.find((d) => d.date === date),
  };
});
