import { describe, it, expect, beforeEach } from 'vitest';
import { getAchievementsToUnlock, type GameStateSnapshot } from '../achievement-checker';
import type { Task, Habit, HabitLog, Domain, Achievement, XpEvent, Goal } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function makeDomain(overrides: Partial<Domain> = {}): Domain {
  return {
    id: 'military',
    name: 'Military',
    icon: '⚔',
    color: '#c8a020',
    created_at: `${TODAY}T00:00:00Z`,
    xp_total: 0,
    level: 1,
    streak_current: 0,
    streak_longest: 0,
    streak_freeze_tokens: 0,
    last_activity_date: null,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    domain_id: 'military',
    title: 'Test task',
    description: null,
    priority: 'medium',
    status: 'done',
    is_mit: false,
    is_top_three: false,
    xp_value: 30,
    xp_awarded: true,
    parent_task_id: null,
    goal_id: null,
    tags: '[]',
    time_estimate_minutes: null,
    due_date: null,
    planned_for_date: null,
    task_kind: 'standard',
    scheduled_for: null,
    recurring_template_id: null,
    recurrence_type: null,
    recurrence_interval: null,
    recurrence_days: '[]',
    recurrence_anchor_date: null,
    completed_at: `${TODAY}T10:00:00Z`,
    created_at: `${TODAY}T09:00:00Z`,
    updated_at: `${TODAY}T10:00:00Z`,
    attachments: '[]',
    recurrence_rule: null,
    time_actual_minutes: null,
    energy_level: 'medium',
    ...overrides,
  };
}

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-1',
    domain_id: 'military',
    title: 'Test habit',
    description: null,
    frequency: 'daily',
    target_days: '[0,1,2,3,4,5,6]',
    xp_per_completion: 15,
    cadence_type: 'daily',
    cadence_days: '[0,1,2,3,4,5,6]',
    cadence_interval_days: 1,
    cadence_weekly_target: 1,
    cadence_anchor_date: null,
    target_type: 'checkbox',
    target_value: 1,
    minimum_value: null,
    unit_label: null,
    minimum_version: null,
    recovery_grace_days: 1,
    restart_from_date: null,
    streak_current: 0,
    streak_longest: 0,
    is_active: true,
    created_at: `${TODAY}T00:00:00Z`,
    ...overrides,
  };
}

function makeLog(habitId = 'habit-1', date = TODAY): HabitLog {
  return {
    id: `log-${habitId}-${date}`,
    habit_id: habitId,
    completed_date: date,
    xp_awarded: 15,
    value_completed: 1,
    status: 'completed',
    skip_reason: null,
    created_at: `${date}T10:00:00Z`,
  };
}

function makeXpEvent(overrides: Partial<XpEvent> = {}): XpEvent {
  return {
    id: 'xp-1',
    domain_id: 'military',
    source_type: 'task',
    source_id: 'task-1',
    xp_amount: 50,
    ai_scored: false,
    ai_reasoning: null,
    created_at: `${TODAY}T10:00:00Z`,
    ...overrides,
  };
}

function emptyState(): GameStateSnapshot {
  return {
    tasks: [],
    habits: [],
    logs: [],
    domains: [
      makeDomain({ id: 'military' }),
      makeDomain({ id: 'builder' }),
      makeDomain({ id: 'self' }),
    ],
    goals: [],
    achievements: [],
    xpEvents: [],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getAchievementsToUnlock', () => {
  it('returns empty array when no conditions met', () => {
    expect(getAchievementsToUnlock(emptyState())).toEqual([]);
  });

  it('never re-unlocks already unlocked achievements', () => {
    const state = emptyState();
    state.tasks = [makeTask()];
    state.achievements = [{ id: 'first_blood', title: '', description: '', icon: '', unlocked: true, unlocked_at: TODAY }];
    const result = getAchievementsToUnlock(state);
    expect(result).not.toContain('first_blood');
  });
});

describe('first_blood', () => {
  it('unlocks when 1 task is completed', () => {
    const state = emptyState();
    state.tasks = [makeTask({ status: 'done' })];
    expect(getAchievementsToUnlock(state)).toContain('first_blood');
  });

  it('does not unlock with zero completed tasks', () => {
    const state = emptyState();
    state.tasks = [makeTask({ status: 'todo' })];
    expect(getAchievementsToUnlock(state)).not.toContain('first_blood');
  });
});

describe('centurion', () => {
  it('unlocks at 100 completed tasks', () => {
    const state = emptyState();
    state.tasks = Array.from({ length: 100 }, (_, i) =>
      makeTask({ id: `t-${i}`, status: 'done' })
    );
    expect(getAchievementsToUnlock(state)).toContain('centurion');
  });

  it('does not unlock at 99 tasks', () => {
    const state = emptyState();
    state.tasks = Array.from({ length: 99 }, (_, i) =>
      makeTask({ id: `t-${i}`, status: 'done' })
    );
    expect(getAchievementsToUnlock(state)).not.toContain('centurion');
  });
});

describe('on_fire', () => {
  it('unlocks when any domain has streak >= 7', () => {
    const state = emptyState();
    state.domains[0] = makeDomain({ id: 'military', streak_current: 7 });
    expect(getAchievementsToUnlock(state)).toContain('on_fire');
  });

  it('does not unlock at streak 6', () => {
    const state = emptyState();
    state.domains[0] = makeDomain({ id: 'military', streak_current: 6 });
    expect(getAchievementsToUnlock(state)).not.toContain('on_fire');
  });
});

describe('warrior / architect / monk', () => {
  it('unlocks warrior when one domain reaches level 5', () => {
    const state = emptyState();
    state.domains[0] = makeDomain({ id: 'military', level: 5 });
    expect(getAchievementsToUnlock(state)).toContain('warrior');
  });

  it('unlocks architect when two domains reach level 5', () => {
    const state = emptyState();
    state.domains[0] = makeDomain({ id: 'military', level: 5 });
    state.domains[1] = makeDomain({ id: 'builder', level: 5 });
    expect(getAchievementsToUnlock(state)).toContain('architect');
  });

  it('unlocks monk when three domains reach level 5', () => {
    const state = emptyState();
    state.domains[0] = makeDomain({ id: 'military', level: 5 });
    state.domains[1] = makeDomain({ id: 'builder', level: 5 });
    state.domains[2] = makeDomain({ id: 'self', level: 5 });
    expect(getAchievementsToUnlock(state)).toContain('monk');
  });
});

describe('overdrive', () => {
  it('unlocks when today XP >= 200', () => {
    const state = emptyState();
    state.xpEvents = [makeXpEvent({ xp_amount: 200, created_at: `${TODAY}T10:00:00Z` })];
    expect(getAchievementsToUnlock(state)).toContain('overdrive');
  });

  it('does not count old XP events', () => {
    const state = emptyState();
    state.xpEvents = [makeXpEvent({ xp_amount: 200, created_at: `${YESTERDAY}T10:00:00Z` })];
    expect(getAchievementsToUnlock(state)).not.toContain('overdrive');
  });
});

describe('xp_10000', () => {
  it('unlocks when total XP across all domains >= 10000', () => {
    const state = emptyState();
    state.domains[0] = makeDomain({ id: 'military', xp_total: 10000 });
    expect(getAchievementsToUnlock(state)).toContain('xp_10000');
  });

  it('counts across multiple domains', () => {
    const state = emptyState();
    state.domains[0] = makeDomain({ id: 'military', xp_total: 5000 });
    state.domains[1] = makeDomain({ id: 'builder', xp_total: 5000 });
    expect(getAchievementsToUnlock(state)).toContain('xp_10000');
  });
});

describe('balanced', () => {
  it('unlocks when all domain XPs are within 10% of each other', () => {
    const state = emptyState();
    state.domains = [
      makeDomain({ id: 'military', xp_total: 1000 }),
      makeDomain({ id: 'builder', xp_total: 1000 }),
      makeDomain({ id: 'self', xp_total: 1000 }),
    ];
    expect(getAchievementsToUnlock(state)).toContain('balanced');
  });

  it('does not unlock when domains are unbalanced', () => {
    const state = emptyState();
    state.domains = [
      makeDomain({ id: 'military', xp_total: 1000 }),
      makeDomain({ id: 'builder', xp_total: 100 }),
      makeDomain({ id: 'self', xp_total: 100 }),
    ];
    expect(getAchievementsToUnlock(state)).not.toContain('balanced');
  });
});

describe('all_habits', () => {
  it('unlocks when all active habits are logged today', () => {
    const state = emptyState();
    state.habits = [
      makeHabit({ id: 'h1', is_active: true }),
      makeHabit({ id: 'h2', is_active: true }),
    ];
    state.logs = [makeLog('h1', TODAY), makeLog('h2', TODAY)];
    expect(getAchievementsToUnlock(state)).toContain('all_habits');
  });

  it('does not unlock when one habit is missing', () => {
    const state = emptyState();
    state.habits = [
      makeHabit({ id: 'h1', is_active: true }),
      makeHabit({ id: 'h2', is_active: true }),
    ];
    state.logs = [makeLog('h1', TODAY)]; // h2 missing
    expect(getAchievementsToUnlock(state)).not.toContain('all_habits');
  });

  it('ignores inactive habits', () => {
    const state = emptyState();
    state.habits = [
      makeHabit({ id: 'h1', is_active: true }),
      makeHabit({ id: 'h2', is_active: false }), // inactive — should be ignored
    ];
    state.logs = [makeLog('h1', TODAY)];
    expect(getAchievementsToUnlock(state)).toContain('all_habits');
  });
});

describe('triple_threat', () => {
  it('unlocks when tasks completed in all 3 domains today', () => {
    const state = emptyState();
    state.tasks = [
      makeTask({ id: 't1', domain_id: 'military', status: 'done', completed_at: `${TODAY}T10:00:00Z` }),
      makeTask({ id: 't2', domain_id: 'builder', status: 'done', completed_at: `${TODAY}T10:00:00Z` }),
      makeTask({ id: 't3', domain_id: 'self', status: 'done', completed_at: `${TODAY}T10:00:00Z` }),
    ];
    expect(getAchievementsToUnlock(state)).toContain('triple_threat');
  });

  it('does not unlock with only 2 domains', () => {
    const state = emptyState();
    state.tasks = [
      makeTask({ id: 't1', domain_id: 'military', status: 'done', completed_at: `${TODAY}T10:00:00Z` }),
      makeTask({ id: 't2', domain_id: 'builder', status: 'done', completed_at: `${TODAY}T10:00:00Z` }),
    ];
    expect(getAchievementsToUnlock(state)).not.toContain('triple_threat');
  });
});

describe('mit_master', () => {
  it('unlocks when MIT completed on 5 consecutive days', () => {
    const state = emptyState();
    const base = new Date(TODAY);
    state.tasks = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      return makeTask({
        id: `mit-${i}`,
        is_mit: true,
        status: 'done',
        completed_at: `${dateStr}T10:00:00Z`,
      });
    });
    expect(getAchievementsToUnlock(state)).toContain('mit_master');
  });

  it('does not unlock with only 4 consecutive MIT days', () => {
    const state = emptyState();
    const base = new Date(TODAY);
    state.tasks = Array.from({ length: 4 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      return makeTask({
        id: `mit-${i}`,
        is_mit: true,
        status: 'done',
        completed_at: `${d.toISOString().slice(0, 10)}T10:00:00Z`,
      });
    });
    expect(getAchievementsToUnlock(state)).not.toContain('mit_master');
  });
});
