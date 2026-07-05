import { describe, expect, it } from 'vitest';
import { formatLocalDate, getLastNDaysWindow, iterateLocalDates, parseLocalDate, shiftLocalDate } from '../weekly-review-date';

describe('weekly-review-date', () => {
  it('parses valid local dates and rejects invalid ones', () => {
    expect(formatLocalDate(parseLocalDate('2026-04-01') as Date)).toBe('2026-04-01');
    expect(parseLocalDate('2026-02-30')).toBeNull();
    expect(parseLocalDate('bad-date')).toBeNull();
  });

  it('shifts dates forward and backward safely', () => {
    expect(shiftLocalDate('2026-04-01', 1)).toBe('2026-04-02');
    expect(shiftLocalDate('2026-04-01', -1)).toBe('2026-03-31');
  });

  it('iterates a bounded inclusive local date range', () => {
    expect(iterateLocalDates('2026-03-30', '2026-04-02')).toEqual([
      '2026-03-30',
      '2026-03-31',
      '2026-04-01',
      '2026-04-02',
    ]);
  });

  it('caps oversized ranges instead of growing forever', () => {
    const dates = iterateLocalDates('2025-01-01', '2026-12-31', 30);
    expect(dates).toHaveLength(30);
    expect(dates[0]).toBe('2025-01-01');
    expect(dates[29]).toBe('2025-01-30');
  });

  it('returns a valid recent window', () => {
    const window = getLastNDaysWindow(7);
    expect(parseLocalDate(window.start)).not.toBeNull();
    expect(parseLocalDate(window.end)).not.toBeNull();
    expect(iterateLocalDates(window.start, window.end)).toHaveLength(7);
  });
});

