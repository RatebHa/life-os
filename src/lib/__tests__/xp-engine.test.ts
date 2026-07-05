import { describe, it, expect } from 'vitest';
import {
  calculateXP,
  applyCompletionBonuses,
  xpToLevel,
  xpForNextLevel,
  xpProgress,
} from '../xp-engine';

// ─── calculateXP ──────────────────────────────────────────────────────────────

describe('calculateXP — base from time estimate', () => {
  it('returns 30 when no time estimate provided', () => {
    expect(calculateXP({ priority: 'medium', is_mit: false })).toBe(45); // 30 * 1.5
  });

  it('uses base 20 for tasks < 30 min', () => {
    expect(calculateXP({ priority: 'low', is_mit: false, time_estimate_minutes: 15 })).toBe(20);
    expect(calculateXP({ priority: 'low', is_mit: false, time_estimate_minutes: 29 })).toBe(20);
  });

  it('uses base 50 for tasks 30–90 min', () => {
    expect(calculateXP({ priority: 'low', is_mit: false, time_estimate_minutes: 30 })).toBe(50);
    expect(calculateXP({ priority: 'low', is_mit: false, time_estimate_minutes: 90 })).toBe(50);
  });

  it('uses base 100 for tasks > 90 min', () => {
    expect(calculateXP({ priority: 'low', is_mit: false, time_estimate_minutes: 91 })).toBe(100);
    expect(calculateXP({ priority: 'low', is_mit: false, time_estimate_minutes: 240 })).toBe(100);
  });
});

describe('calculateXP — priority multipliers', () => {
  it('low: x1.0', () => {
    expect(calculateXP({ priority: 'low', is_mit: false, time_estimate_minutes: 30 })).toBe(50);
  });

  it('medium: x1.5', () => {
    expect(calculateXP({ priority: 'medium', is_mit: false, time_estimate_minutes: 30 })).toBe(75);
  });

  it('high: x2.0', () => {
    expect(calculateXP({ priority: 'high', is_mit: false, time_estimate_minutes: 30 })).toBe(100);
  });

  it('critical: x3.0', () => {
    expect(calculateXP({ priority: 'critical', is_mit: false, time_estimate_minutes: 30 })).toBe(150);
  });
});

describe('calculateXP — MIT bonus', () => {
  it('applies 1.5x MIT bonus on top of priority multiplier', () => {
    // base 50 * 2.0 (high) * 1.5 (MIT) = 150
    expect(calculateXP({ priority: 'high', is_mit: true, time_estimate_minutes: 30 })).toBe(150);
  });

  it('does not apply MIT bonus when is_mit is false', () => {
    expect(calculateXP({ priority: 'high', is_mit: false, time_estimate_minutes: 30 })).toBe(100);
  });
});

describe('calculateXP — null/undefined edge cases', () => {
  it('treats null time_estimate_minutes as no estimate', () => {
    const withNull = calculateXP({ priority: 'low', is_mit: false, time_estimate_minutes: null });
    const withUndefined = calculateXP({ priority: 'low', is_mit: false });
    expect(withNull).toBe(withUndefined);
    expect(withNull).toBe(30); // base 30 * 1.0 low
  });
});

// ─── applyCompletionBonuses ───────────────────────────────────────────────────

describe('applyCompletionBonuses', () => {
  it('returns base XP when no bonuses apply', () => {
    expect(applyCompletionBonuses(100, { isMIT: false, completedBeforeDeadline: false, domainStreakTier: 0 })).toBe(100);
  });

  it('applies 1.25x for on-time completion', () => {
    expect(applyCompletionBonuses(100, { isMIT: false, completedBeforeDeadline: true, domainStreakTier: 0 })).toBe(125);
  });

  it('applies 1.5x for MIT', () => {
    expect(applyCompletionBonuses(100, { isMIT: true, completedBeforeDeadline: false, domainStreakTier: 0 })).toBe(150);
  });

  it('applies +10% per streak tier', () => {
    // tier 1 = +10%
    expect(applyCompletionBonuses(100, { isMIT: false, completedBeforeDeadline: false, domainStreakTier: 1 })).toBe(110);
    // tier 2 = +20%
    expect(applyCompletionBonuses(100, { isMIT: false, completedBeforeDeadline: false, domainStreakTier: 2 })).toBe(120);
  });

  it('stacks all bonuses correctly', () => {
    // 100 * 1.25 (deadline) * 1.5 (MIT) * 1.1 (streak tier 1) = 206.25 → rounded = 206
    expect(applyCompletionBonuses(100, { isMIT: true, completedBeforeDeadline: true, domainStreakTier: 1 })).toBe(206);
  });
});

// ─── xpToLevel ────────────────────────────────────────────────────────────────

describe('xpToLevel', () => {
  it('level 1 at 0 XP', () => expect(xpToLevel(0)).toBe(1));
  it('level 2 at 500 XP', () => expect(xpToLevel(500)).toBe(2));
  it('level 2 still at 1199 XP', () => expect(xpToLevel(1199)).toBe(2));
  it('level 3 at 1200 XP', () => expect(xpToLevel(1200)).toBe(3));
  it('level 5 at 4500 XP', () => expect(xpToLevel(4500)).toBe(5));
  it('level 10 at 60000 XP', () => expect(xpToLevel(60000)).toBe(10));
  it('caps at level 10 above 60000', () => expect(xpToLevel(999999)).toBe(10));
});

// ─── xpForNextLevel ───────────────────────────────────────────────────────────

describe('xpForNextLevel', () => {
  it('returns 500 for level 1', () => expect(xpForNextLevel(1)).toBe(500));
  it('returns 1200 for level 2', () => expect(xpForNextLevel(2)).toBe(1200));
  it('returns 60000 for level 9', () => expect(xpForNextLevel(9)).toBe(60000));
  it('returns 60000 for max level (10)', () => expect(xpForNextLevel(10)).toBe(60000));
});

// ─── xpProgress ───────────────────────────────────────────────────────────────

describe('xpProgress', () => {
  it('returns 0 at start of level', () => {
    expect(xpProgress(0, 1)).toBe(0);
  });

  it('returns 100 at end of level range', () => {
    expect(xpProgress(500, 1)).toBe(100);
  });

  it('returns 50% halfway through a level', () => {
    // Level 1: 0 → 500 range. 250 XP = 50%
    expect(xpProgress(250, 1)).toBe(50);
  });

  it('clamps to 0 minimum', () => {
    expect(xpProgress(-100, 1)).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    expect(xpProgress(999999, 1)).toBe(100);
  });
});
