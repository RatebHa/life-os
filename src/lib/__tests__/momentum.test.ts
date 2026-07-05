import { describe, it, expect } from 'vitest';
import {
  calcMomentum,
  getMomentumState,
  getMomentumColor,
  getMomentumLabel,
  type DayActivity,
} from '../momentum';

// ─── calcMomentum ─────────────────────────────────────────────────────────────

function makeDay(tasksCompleted = 0, habitsCompleted = 0, mitCompleted = false): DayActivity {
  return { date: '2025-01-01', tasksCompleted, habitsCompleted, mitCompleted };
}

describe('calcMomentum', () => {
  it('returns 50 for zero activity (fresh install guard)', () => {
    const days = Array.from({ length: 7 }, () => makeDay());
    expect(calcMomentum(days)).toBe(50);
  });

  it('returns 50 for empty array (fresh install guard)', () => {
    expect(calcMomentum([])).toBe(50);
  });

  it('returns a value between 0 and 100', () => {
    const days = Array.from({ length: 7 }, () => makeDay(10, 10, true));
    const score = calcMomentum(days);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('today (index 0) has highest weight (0.30)', () => {
    // Only today has activity
    const days = [makeDay(5, 0, false), ...Array(6).fill(makeDay())];
    const scoreToday = calcMomentum(days);

    // Only day index 1 (yesterday) has activity
    const daysYesterday = [makeDay(), makeDay(5, 0, false), ...Array(5).fill(makeDay())];
    const scoreYesterday = calcMomentum(daysYesterday);

    expect(scoreToday).toBeGreaterThan(scoreYesterday);
  });

  it('tasks cap at 5 tasks contributing (10 pts each, max 50)', () => {
    // 10 tasks today vs 5 tasks today — should have same contribution from tasks
    const days10 = [makeDay(10, 0, false), ...Array(6).fill(makeDay())];
    const days5 = [makeDay(5, 0, false), ...Array(6).fill(makeDay())];
    expect(calcMomentum(days10)).toBe(calcMomentum(days5));
  });

  it('habits cap at 4 habits contributing (8 pts each, max 32)', () => {
    const days4 = [makeDay(0, 4, false), ...Array(6).fill(makeDay())];
    const days8 = [makeDay(0, 8, false), ...Array(6).fill(makeDay())];
    expect(calcMomentum(days4)).toBe(calcMomentum(days8));
  });

  it('MIT completion adds 18 pts before weight', () => {
    // Use 1 task as baseline so neither triggers the zero-activity guard
    const withMIT    = [makeDay(1, 0, true),  ...Array(6).fill(makeDay())];
    const withoutMIT = [makeDay(1, 0, false), ...Array(6).fill(makeDay())];
    const diff = calcMomentum(withMIT) - calcMomentum(withoutMIT);
    // 18 * 0.30 weight = 5.4, rounded → expect difference of ~5
    expect(diff).toBeGreaterThanOrEqual(5);
    expect(diff).toBeLessThanOrEqual(6);
  });

  it('handles fewer than 7 days gracefully', () => {
    const days = [makeDay(3, 2, true)]; // only 1 day
    expect(() => calcMomentum(days)).not.toThrow();
    expect(calcMomentum(days)).toBeGreaterThan(0);
  });

  it('ignores days beyond index 6', () => {
    const exactly7 = Array.from({ length: 7 }, (_, i) => makeDay(i, 0, false));
    const moreThan7 = [...exactly7, makeDay(100, 100, true)]; // extra day should be ignored
    expect(calcMomentum(exactly7)).toBe(calcMomentum(moreThan7));
  });
});

// ─── getMomentumState ─────────────────────────────────────────────────────────

describe('getMomentumState', () => {
  it('returns peak at 80', () => expect(getMomentumState(80)).toBe('peak'));
  it('returns peak at 100', () => expect(getMomentumState(100)).toBe('peak'));
  it('returns normal at 79', () => expect(getMomentumState(79)).toBe('normal'));
  it('returns normal at 30', () => expect(getMomentumState(30)).toBe('normal'));
  it('returns amber at 29', () => expect(getMomentumState(29)).toBe('amber'));
  it('returns amber at 15', () => expect(getMomentumState(15)).toBe('amber'));
  it('returns red_alert at 14', () => expect(getMomentumState(14)).toBe('red_alert'));
  it('returns red_alert at 0', () => expect(getMomentumState(0)).toBe('red_alert'));
});

// ─── getMomentumColor ─────────────────────────────────────────────────────────

describe('getMomentumColor', () => {
  it('returns CSS variable strings', () => {
    expect(getMomentumColor('peak')).toMatch(/^var\(/);
    expect(getMomentumColor('normal')).toMatch(/^var\(/);
    expect(getMomentumColor('amber')).toMatch(/^var\(/);
    expect(getMomentumColor('red_alert')).toMatch(/^var\(/);
  });

  it('each state returns a different variable', () => {
    const colors = new Set([
      getMomentumColor('peak'),
      getMomentumColor('normal'),
      getMomentumColor('amber'),
      getMomentumColor('red_alert'),
    ]);
    expect(colors.size).toBe(4);
  });
});

// ─── getMomentumLabel ─────────────────────────────────────────────────────────

describe('getMomentumLabel', () => {
  it('returns non-empty string for all states', () => {
    expect(getMomentumLabel('peak').length).toBeGreaterThan(0);
    expect(getMomentumLabel('normal').length).toBeGreaterThan(0);
    expect(getMomentumLabel('amber').length).toBeGreaterThan(0);
    expect(getMomentumLabel('red_alert').length).toBeGreaterThan(0);
  });

  it('returns different labels for different states', () => {
    const labels = new Set([
      getMomentumLabel('peak'),
      getMomentumLabel('normal'),
      getMomentumLabel('amber'),
      getMomentumLabel('red_alert'),
    ]);
    expect(labels.size).toBe(4);
  });
});
