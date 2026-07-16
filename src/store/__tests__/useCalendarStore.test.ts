import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useCalendarStore } from '../useCalendarStore';
import type { CalendarDay } from '../../lib/types';

const mockInvoke = vi.mocked(invoke);

function makeCalendarDay(date: string, overrides: Partial<CalendarDay> = {}): CalendarDay {
  return {
    date,
    tasks: [],
    habits_logged: [],
    ...overrides,
  };
}

const now = new Date();
const initialState = {
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  selectedDate: null as string | null,
  days: [] as CalendarDay[],
  isLoading: false,
};

beforeEach(() => {
  useCalendarStore.setState(initialState);
  vi.clearAllMocks();
});

describe('useCalendarStore', () => {
  it('initializes with current year/month', () => {
    const state = useCalendarStore.getState();
    expect(state.year).toBe(now.getFullYear());
    expect(state.month).toBe(now.getMonth() + 1);
    expect(state.days).toEqual([]);
    expect(state.selectedDate).toBeNull();
  });

  it('loadMonth: fetches and stores calendar days', async () => {
    const days = [
      makeCalendarDay('2025-01-15'),
      makeCalendarDay('2025-01-16'),
    ];
    mockInvoke.mockResolvedValueOnce(days);

    await useCalendarStore.getState().loadMonth(2025, 1);

    expect(useCalendarStore.getState().days).toHaveLength(2);
    expect(useCalendarStore.getState().year).toBe(2025);
    expect(useCalendarStore.getState().month).toBe(1);
    expect(useCalendarStore.getState().isLoading).toBe(false);
  });

  it('loadMonth: handles errors gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Network error'));

    await useCalendarStore.getState().loadMonth(2025, 1);

    expect(useCalendarStore.getState().days).toEqual([]);
    expect(useCalendarStore.getState().isLoading).toBe(false);
  });

  it('nextMonth: advances from December to January next year', async () => {
    useCalendarStore.setState({ ...initialState, year: 2025, month: 12 });
    mockInvoke.mockResolvedValue([]);

    useCalendarStore.getState().nextMonth();
    await new Promise((r) => setTimeout(r, 20));

    expect(useCalendarStore.getState().year).toBe(2026);
    expect(useCalendarStore.getState().month).toBe(1);
  });

  it('nextMonth: advances normally within year', async () => {
    useCalendarStore.setState({ ...initialState, year: 2025, month: 6 });
    mockInvoke.mockResolvedValue([]);

    useCalendarStore.getState().nextMonth();
    await new Promise((r) => setTimeout(r, 20));

    expect(useCalendarStore.getState().year).toBe(2025);
    expect(useCalendarStore.getState().month).toBe(7);
  });

  it('prevMonth: retreats from January to December previous year', async () => {
    useCalendarStore.setState({ ...initialState, year: 2025, month: 1 });
    mockInvoke.mockResolvedValue([]);

    useCalendarStore.getState().prevMonth();
    await new Promise((r) => setTimeout(r, 20));

    expect(useCalendarStore.getState().year).toBe(2024);
    expect(useCalendarStore.getState().month).toBe(12);
  });

  it('prevMonth: retreats normally within year', async () => {
    useCalendarStore.setState({ ...initialState, year: 2025, month: 6 });
    mockInvoke.mockResolvedValue([]);

    useCalendarStore.getState().prevMonth();
    await new Promise((r) => setTimeout(r, 20));

    expect(useCalendarStore.getState().year).toBe(2025);
    expect(useCalendarStore.getState().month).toBe(5);
  });

  it('selectDate: sets selectedDate', () => {
    useCalendarStore.getState().selectDate('2025-06-15');
    expect(useCalendarStore.getState().selectedDate).toBe('2025-06-15');
  });

  it('selectDate: can clear selection', () => {
    useCalendarStore.setState({ ...initialState, selectedDate: '2025-06-15' });
    useCalendarStore.getState().selectDate(null);
    expect(useCalendarStore.getState().selectedDate).toBeNull();
  });

  it('dayData: returns matching day or undefined', () => {
    const day = makeCalendarDay('2025-06-15');
    useCalendarStore.setState({ ...initialState, days: [day, makeCalendarDay('2025-06-16')] });

    expect(useCalendarStore.getState().dayData('2025-06-99')).toBeUndefined();
  });
});
