import React, { useEffect, useMemo, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import { useDomainStore } from '../store/useDomainStore';
import { useNoteStore } from '../store/useNoteStore';
import { useGoalStore } from '../store/useGoalStore';
import { useInboxStore } from '../store/useInboxStore';
import { useDebugStore } from '../store/useDebugStore';
import { PageHeader } from '../components/shared/PageHeader';
import { PanelHeader } from '../components/shared/PanelHeader';
import { isHabitDueOnDate } from '../lib/habit-schedule';
import { getLastNDaysWindow, iterateLocalDates, shiftLocalDate } from '../lib/weekly-review-date';
import type { Domain, DomainId, Goal, Habit, HabitLog, Priority, Task } from '../lib/types';
import { getDefaultDomainId, getDomainLabel } from '../lib/domain-utils';
import { formatDateDisplay, formatDateRangeDisplay } from '../lib/date-format';

type DomainReviewStat = {
  id: DomainId;
  label: string;
  taskCount: number;
  habitDays: number;
  commitmentLoad: number;
  score: number;
};

type SlipDriver = {
  id: string;
  label: string;
  count: number;
  detail: string;
};

type GoalReviewItem = {
  id: string;
  domainId: DomainId;
  title: string;
  health: Goal['health'];
  nextAction: string | null;
  blockedBy: string | null;
  reviewDate: string | null;
};

type HabitSuggestion = {
  id: string;
  domainId: DomainId;
  habitTitle: string;
  suggestion: string;
  rationale: string;
  taskTitle: string;
  priority: Priority;
};

type WeeklyReviewData = {
  completedTasks: Task[];
  effectiveLogs: HabitLog[];
  activeHabitDays: number;
  commitmentLoad: number;
  domainStats: DomainReviewStat[];
  strongestDomain: DomainReviewStat | null;
  weakestDomain: DomainReviewStat | null;
  balanceSummary: string;
  focusSuggestion: string;
  topThreeSuggestions: string[];
  missedTasks: Task[];
  slipDrivers: SlipDriver[];
  attentionGoals: GoalReviewItem[];
  stalledGoalsCount: number;
  habitSuggestions: HabitSuggestion[];
  planTag: string;
  planAlreadyApplied: boolean;
  weekStart: string;
  weekEnd: string;
  nextWeekStart: string;
  nextWeekEnd: string;
  warning: string | null;
};

function isInDateRange(value: string | null | undefined, start: string, end: string): boolean {
  if (!value) return false;
  const date = value.slice(0, 10);
  return date >= start && date <= end;
}

function normalizeDomainId(value: string | null | undefined): DomainId {
  return value?.trim() || 'self';
}

function parseTags(tags: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(tags || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function hasTag(task: Task, tag: string): boolean {
  return parseTags(task.tags).includes(tag);
}

function formatPlanningEntry(domainId: DomainId, title: string, domains: Array<Pick<Domain, 'id' | 'name' | 'icon' | 'color'>>): string {
  return `[${getDomainLabel(domainId, domains)}] ${title}`;
}

function extractPlanningDomain(entry: string, domains: Array<Pick<Domain, 'id' | 'name' | 'icon' | 'color'>>): DomainId | null {
  const match = entry.match(/\[([^\]]+)\]/)?.[1]?.trim().toLowerCase();
  if (!match) return null;
  const domain = domains.find((item) => getDomainLabel(item.id, domains).toLowerCase() === match || item.id.toLowerCase() === match);
  if (domain) return domain.id;
  return null;
}

function stripPlanningPrefix(entry: string): string {
  return entry.replace(/^\d+\.\s*/, '').replace(/\[[^\]]+\]\s*/i, '').trim();
}

function buildLatestLogsMap(logs: HabitLog[], start: string, end: string): Map<string, HabitLog> {
  const map = new Map<string, HabitLog>();
  for (const log of logs) {
    if (log.completed_date < start || log.completed_date > end) continue;
    const key = `${log.habit_id}:${log.completed_date}`;
    const existing = map.get(key);
    if (!existing || log.created_at > existing.created_at) map.set(key, log);
  }
  return map;
}

function buildSlipDrivers(missedTasks: Task[]): SlipDriver[] {
  if (missedTasks.length === 0) return [];

  const noEstimate = missedTasks.filter((task) => task.time_estimate_minutes == null).length;
  const highPressure = missedTasks.filter((task) => task.priority === 'high' || task.priority === 'critical').length;
  const neverStarted = missedTasks.filter((task) => task.status === 'todo').length;
  const goalDetached = missedTasks.filter((task) => !task.goal_id).length;

  const dueDateLoad = new Map<string, number>();
  for (const task of missedTasks) {
    const due = task.due_date?.slice(0, 10);
    if (!due) continue;
    dueDateLoad.set(due, (dueDateLoad.get(due) ?? 0) + 1);
  }
  const overloadedDays = Array.from(dueDateLoad.values()).filter((count) => count >= 3).length;

  const drivers: SlipDriver[] = [];
  if (overloadedDays > 0) {
    drivers.push({
      id: 'overload',
      label: 'Too much stacked on the same day',
      count: overloadedDays,
      detail: 'Several missed tasks landed on overloaded days, which usually means planning exceeded real capacity.',
    });
  }
  if (noEstimate > 0) {
    drivers.push({
      id: 'no-estimate',
      label: 'Tasks were not sized clearly',
      count: noEstimate,
      detail: 'Tasks without estimates are easier to postpone because they never feel concrete enough to schedule.',
    });
  }
  if (neverStarted > 0) {
    drivers.push({
      id: 'never-started',
      label: 'Work never got a first step',
      count: neverStarted,
      detail: 'These items stayed untouched all week, which usually means the opening step was still too vague.',
    });
  }
  if (goalDetached > 0) {
    drivers.push({
      id: 'not-linked',
      label: 'Work was disconnected from goals',
      count: goalDetached,
      detail: 'Tasks without a visible reason behind them lose urgency faster during a crowded week.',
    });
  }
  if (highPressure > 0) {
    drivers.push({
      id: 'high-pressure',
      label: 'Hard important work kept slipping',
      count: highPressure,
      detail: 'High-pressure work slipping usually points to overload, avoidance, or not protecting enough deep-work space.',
    });
  }

  return drivers.sort((left, right) => right.count - left.count).slice(0, 4);
}

function normalizeGoal(goal: Goal): GoalReviewItem {
  return {
    id: goal.id,
    domainId: normalizeDomainId(goal.domain_id),
    title: goal.title || 'Untitled goal',
    health: goal.health === 'stalled' || goal.health === 'at_risk' || goal.health === 'on_track' ? goal.health : 'on_track',
    nextAction: goal.next_action?.trim() || null,
    blockedBy: goal.blocked_by?.trim() || null,
    reviewDate: goal.review_date ?? null,
  };
}

function buildHabitSuggestions(habits: Habit[], logs: HabitLog[], start: string, end: string): HabitSuggestion[] {
  const dates = iterateLocalDates(start, end);
  const latestLogs = buildLatestLogsMap(logs, start, end);
  const suggestions: HabitSuggestion[] = [];

  for (const habit of habits.filter((entry) => entry.is_active)) {
      const safeHabit = {
        ...habit,
        domain_id: normalizeDomainId(habit.domain_id),
        target_days: typeof habit.target_days === 'string' ? habit.target_days : '[]',
      };

      let dueCount = 0;
      let completed = 0;
      let minimum = 0;
      let skipped = 0;
      let missed = 0;

      for (const date of dates) {
        if (!isHabitDueOnDate(safeHabit, date)) continue;
        dueCount += 1;
        const log = latestLogs.get(`${safeHabit.id}:${date}`);
        if (!log) {
          missed += 1;
          continue;
        }
        if (log.status === 'completed') completed += 1;
        else if (log.status === 'minimum') minimum += 1;
        else skipped += 1;
      }

      if (dueCount === 0) continue;

      const completionRate = (completed + minimum) / dueCount;
      const minimumRate = minimum / dueCount;
      const skipRate = skipped / dueCount;

      if (missed >= 3 && !safeHabit.minimum_version) {
        suggestions.push({
          id: `${safeHabit.id}-minimum`,
          domainId: safeHabit.domain_id,
          habitTitle: safeHabit.title,
          suggestion: 'Add a smaller minimum version.',
          rationale: `${missed} scheduled days were missed completely in the last three weeks.`,
          taskTitle: `Define a minimum version for ${safeHabit.title}`,
          priority: 'high' as const,
        });
        continue;
      }
      if (completionRate < 0.55) {
        suggestions.push({
          id: `${safeHabit.id}-schedule`,
          domainId: safeHabit.domain_id,
          habitTitle: safeHabit.title,
          suggestion: 'Review the schedule or trigger.',
          rationale: `Only ${Math.round(completionRate * 100)}% of scheduled days were recovered or completed.`,
          taskTitle: `Adjust timing or trigger for ${safeHabit.title}`,
          priority: 'high' as const,
        });
        continue;
      }
      if (skipRate >= 0.25) {
        suggestions.push({
          id: `${safeHabit.id}-skip`,
          domainId: safeHabit.domain_id,
          habitTitle: safeHabit.title,
          suggestion: 'Investigate why it keeps getting consciously skipped.',
          rationale: `${skipped} scheduled days were skipped instead of done.`,
          taskTitle: `Review skip pattern for ${safeHabit.title}`,
          priority: 'medium' as const,
        });
        continue;
      }
      if (minimumRate >= 0.4) {
        suggestions.push({
          id: `${safeHabit.id}-support`,
          domainId: safeHabit.domain_id,
          habitTitle: safeHabit.title,
          suggestion: 'Keep the minimum version but add a support step.',
          rationale: 'Minimum-only completions are carrying this habit right now.',
          taskTitle: `Add one support step to ${safeHabit.title}`,
          priority: 'medium' as const,
        });
      }
  }

  return suggestions.slice(0, 5);
}

function deriveWeeklyReviewData(
  tasks: Task[],
  habits: Habit[],
  logs: HabitLog[],
  goals: Goal[],
  domains: Array<Pick<Domain, 'id' | 'name' | 'icon' | 'color'>>,
): WeeklyReviewData {
  const { start: weekStart, end: weekEnd } = getLastNDaysWindow(7);
  const nextWeekStart = shiftLocalDate(weekEnd, 1);
  const nextWeekEnd = shiftLocalDate(nextWeekStart, 6);
  const habitWindowStart = shiftLocalDate(weekEnd, -20);
  const planTag = `weekly-plan-${weekStart}`;

  try {
    const safeTasks = tasks.filter((task) => Boolean(task?.id && task?.title));
    const safeGoals = goals.filter((goal) => Boolean(goal?.id && goal?.title)).map(normalizeGoal);
    const safeHabits = habits.filter((habit) => Boolean(habit?.id && habit?.title));
    const safeLogs = logs.filter((log) => Boolean(log?.id && log?.habit_id && log?.completed_date));

    const completedTasks = safeTasks.filter((task) => task.status === 'done' && isInDateRange(task.completed_at, weekStart, weekEnd));
    const effectiveLogs = safeLogs.filter((log) => log.status !== 'skipped' && log.completed_date >= weekStart && log.completed_date <= weekEnd);
    const activeHabitDays = new Set(effectiveLogs.map((log) => log.completed_date)).size;
    const commitmentLoad = completedTasks.length + activeHabitDays;

    const habitDomainById = new Map<string, DomainId>();
    for (const habit of safeHabits) {
      habitDomainById.set(habit.id, normalizeDomainId(habit.domain_id));
    }

    const fallbackDomainId = getDefaultDomainId(domains);
    const domainIds = (domains.length > 0 ? domains.map((domain) => normalizeDomainId(domain.id)) : [fallbackDomainId]) as DomainId[];
    const uniqueDomainIds = Array.from(new Set(domainIds));

    const domainStats = uniqueDomainIds.map((domainId) => {
      const domainTasks = completedTasks.filter((task) => normalizeDomainId(task.domain_id) === domainId);
      const domainLogs = effectiveLogs.filter((log) => habitDomainById.get(log.habit_id) === domainId);
      const taskCount = domainTasks.length;
      const habitDays = new Set(domainLogs.map((log) => log.completed_date)).size;
      const commitmentLoad = taskCount + habitDays;

      return {
        id: domainId,
        label: getDomainLabel(domainId, domains),
        taskCount,
        habitDays,
        commitmentLoad,
        score: taskCount * 3 + habitDays * 2,
      };
    });

    const sortedDomainStats = [...domainStats].sort((left, right) => right.score - left.score);
    const strongestDomain = sortedDomainStats[0] ?? null;
    const weakestDomain = sortedDomainStats[sortedDomainStats.length - 1] ?? null;
    const balanceSpread = strongestDomain && weakestDomain ? strongestDomain.score - weakestDomain.score : 0;
    const balanceSummary = strongestDomain && weakestDomain
      ? balanceSpread <= 2
      ? 'The week stayed reasonably balanced across your active domains.'
        : `${strongestDomain.label.toUpperCase()} carried the week while ${weakestDomain.label.toUpperCase()} needs protected attention next week.`
      : 'There is not enough clean weekly data yet to judge balance.';

    const missedTasks = safeTasks
      .filter((task) => task.status !== 'done' && task.status !== 'archived' && isInDateRange(task.due_date, weekStart, weekEnd))
      .sort((left, right) => (left.due_date ?? '').localeCompare(right.due_date ?? ''));

    const completedTaskGoalIds = new Set(
      completedTasks
        .map((task) => task.goal_id)
        .filter((goalId): goalId is string => Boolean(goalId)),
    );

    const attentionGoals = safeGoals
      .filter((goal) => {
        if (goal.health === 'stalled' || goal.health === 'at_risk') return true;
        if (!goal.nextAction) return true;
        if (goal.reviewDate && goal.reviewDate < nextWeekStart) return true;
        return !completedTaskGoalIds.has(goal.id);
      })
      .slice(0, 5);

    const habitSuggestions = buildHabitSuggestions(safeHabits, safeLogs, habitWindowStart, weekEnd);
    const stalledGoalsCount = safeGoals.filter((goal) => goal.health === 'stalled').length;
    const planAlreadyApplied = safeTasks.some((task) => hasTag(task, planTag));

    const focusSuggestion = attentionGoals[0]?.nextAction
      ? `Move ${getDomainLabel(attentionGoals[0].domainId, domains)} forward through one clear next action.`
      : weakestDomain
        ? `Rebalance next week toward ${weakestDomain.label}.`
        : 'Protect one meaningful win in each domain.';

    const topThreeSuggestions: string[] = [];
    for (const goal of attentionGoals) {
      topThreeSuggestions.push(formatPlanningEntry(goal.domainId, goal.nextAction || `Move ${goal.title} forward`, domains));
      if (topThreeSuggestions.length >= 3) break;
    }
    if (topThreeSuggestions.length < 3) {
      for (const task of missedTasks) {
        topThreeSuggestions.push(formatPlanningEntry(normalizeDomainId(task.domain_id), `Recover ${task.title}`, domains));
        if (topThreeSuggestions.length >= 3) break;
      }
    }
    if (topThreeSuggestions.length < 3 && weakestDomain) {
      topThreeSuggestions.push(formatPlanningEntry(weakestDomain.id, `Protect one meaningful win in ${weakestDomain.label}`, domains));
    }

    return {
      completedTasks,
      effectiveLogs,
      activeHabitDays,
      commitmentLoad,
      domainStats,
      strongestDomain,
      weakestDomain,
      balanceSummary,
      focusSuggestion,
      topThreeSuggestions,
      missedTasks,
      slipDrivers: buildSlipDrivers(missedTasks),
      attentionGoals,
      stalledGoalsCount,
      habitSuggestions,
      planTag,
      planAlreadyApplied,
      weekStart,
      weekEnd,
      nextWeekStart,
      nextWeekEnd,
      warning: null,
    };
  } catch (error) {
    console.error('[weekly-review] derive failed:', error);
    return {
      completedTasks: [],
      effectiveLogs: [],
      activeHabitDays: 0,
      commitmentLoad: 0,
      domainStats: ([getDefaultDomainId(domains)] as DomainId[]).map((domainId) => ({
        id: domainId,
        label: getDomainLabel(domainId, domains),
        taskCount: 0,
        habitDays: 0,
      commitmentLoad: 0,
        score: 0,
      })),
      strongestDomain: null,
      weakestDomain: null,
      balanceSummary: 'Weekly review is running in safe mode because some saved data could not be interpreted cleanly.',
      focusSuggestion: 'Use one simple focus theme for the next week.',
      topThreeSuggestions: [],
      missedTasks: [],
      slipDrivers: [],
      attentionGoals: [],
      stalledGoalsCount: 0,
      habitSuggestions: [],
      planTag,
      planAlreadyApplied: false,
      weekStart,
      weekEnd,
      nextWeekStart,
      nextWeekEnd,
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}

function getHealthLabel(health: Goal['health']): string {
  return health.replace('_', ' ').toUpperCase();
}

export const WeeklyReviewPage: React.FC = () => {
  const tasks = useTaskStore((state) => state.tasks);
  const createTask = useTaskStore((state) => state.createTask);
  const habits = useHabitStore((state) => state.habits);
  const logs = useHabitStore((state) => state.logs);
  const domains = useDomainStore((state) => state.domains);
  const goals = useGoalStore((state) => state.goals);
  const createNote = useNoteStore((state) => state.createNote);
  const captureInboxItem = useInboxStore((state) => state.captureInboxItem);
  const addDebugEntry = useDebugStore((state) => state.addEntry);

  const [whatWorked, setWhatWorked] = useState('');
  const [whatSlipped, setWhatSlipped] = useState('');
  const [whyItSlipped, setWhyItSlipped] = useState('');
  const [focusTheme, setFocusTheme] = useState('');
  const [topThree, setTopThree] = useState('');
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  const data = useMemo(
    () => deriveWeeklyReviewData(tasks, habits, logs, goals, domains),
    [tasks, habits, logs, goals, domains],
  );

  useEffect(() => {
    addDebugEntry({
      level: 'info',
      scope: 'weekly-review',
      message: 'Mounted weekly review',
      detail: `tasks=${tasks.length}, habits=${habits.length}, logs=${logs.length}, goals=${goals.length}`,
    });
  }, [addDebugEntry, goals.length, habits.length, logs.length, tasks.length]);

  useEffect(() => {
    addDebugEntry({
      level: data.warning ? 'warn' : 'info',
      scope: 'weekly-review',
      message: 'Derived weekly review data',
      detail: `completed=${data.completedTasks.length}, missed=${data.missedTasks.length}, attentionGoals=${data.attentionGoals.length}, habitSuggestions=${data.habitSuggestions.length}${data.warning ? `, warning=${data.warning}` : ''}`,
    });
  }, [
    addDebugEntry,
    data.attentionGoals.length,
    data.completedTasks.length,
    data.habitSuggestions.length,
    data.missedTasks.length,
    data.warning,
  ]);

  const focusThemeValue = focusTheme.trim() || data.focusSuggestion;
  const defaultTopThreeText = data.topThreeSuggestions.map((entry, index) => `${index + 1}. ${entry}`).join('\n');
  const topThreeValue = topThree.trim() || defaultTopThreeText;
  const reviewPlanEntries = topThreeValue.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3);
  const selectedSuggestionLookup = new Set(selectedSuggestionIds);
  const hasApplyPayload = reviewPlanEntries.length > 0 || selectedSuggestionLookup.size > 0;

  async function handleSaveNote() {
    const habitNotes = data.habitSuggestions
      .filter((suggestion) => selectedSuggestionLookup.has(suggestion.id))
      .map((suggestion) => `- ${suggestion.habitTitle}: ${suggestion.suggestion} ${suggestion.rationale}`)
      .join('\n') || '(no habit adjustments selected)';

    const content = [
      `## WEEK OF ${formatDateRangeDisplay(data.weekStart, data.weekEnd)}`,
      '',
      '### SCOREBOARD',
      `- Tasks completed: ${data.completedTasks.length}`,
      `- Habits completed/minimum: ${data.effectiveLogs.length}`,
      `- Active habit days: ${data.activeHabitDays}`,
      `- Commitment load: ${data.commitmentLoad.toLocaleString()}`,
      '',
      '### NEXT WEEK FOCUS',
      focusThemeValue,
      '',
      '### DOMAIN BALANCE',
      data.balanceSummary,
      '',
      '### WHAT WORKED',
      whatWorked.trim() || '(empty)',
      '',
      '### WHAT SLIPPED',
      (whatSlipped.trim() || data.missedTasks.slice(0, 3).map((task) => `- ${task.title}`).join('\n')) || '(empty)',
      '',
      '### WHY IT SLIPPED',
      whyItSlipped.trim() || '(empty)',
      '',
      '### TOP 3 FOR NEXT WEEK',
      topThreeValue || '(empty)',
      '',
      '### HABIT ADJUSTMENTS',
      habitNotes,
    ].join('\n');

    setIsSaving(true);
    try {
      await createNote({
        title: `WEEKLY PLAN // ${formatDateDisplay(data.weekStart)}`,
        content,
        tags: JSON.stringify(['weekly-review', 'weekly-plan', data.planTag]),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('[weekly-review] save note failed:', error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApplyPlan() {
    if (data.planAlreadyApplied) return;

    if (!hasApplyPayload) return;

    setIsApplying(true);
    try {
      for (let index = 0; index < reviewPlanEntries.length; index += 1) {
        const entry = reviewPlanEntries[index];
        const domainId = extractPlanningDomain(entry, domains) ?? data.weakestDomain?.id ?? getDefaultDomainId(domains);
        const title = stripPlanningPrefix(entry);
        if (!title) continue;

        const priority: Priority = index === 0 ? 'high' : 'medium';
        const isMit = index === 0;
        await createTask({
          domain_id: domainId,
          title,
          priority,
          is_mit: isMit,
          due_date: data.nextWeekEnd,
          tags: JSON.stringify(['weekly-plan', data.planTag, 'weekly-top-3']),
          time_estimate_minutes: 60,
        });
      }

      for (const suggestion of data.habitSuggestions.filter((item) => selectedSuggestionLookup.has(item.id))) {
        await createTask({
          domain_id: suggestion.domainId,
          title: suggestion.taskTitle,
          description: suggestion.rationale,
          priority: suggestion.priority,
          is_mit: false,
          due_date: data.nextWeekStart,
          tags: JSON.stringify(['weekly-plan', data.planTag, 'habit-adjustment']),
          time_estimate_minutes: 30,
        });
      }
    } catch (error) {
      console.error('[weekly-review] apply plan failed:', error);
    } finally {
      setIsApplying(false);
    }
  }

  async function handleSendToInbox() {
    const content = [
      focusThemeValue ? `Focus theme: ${focusThemeValue}` : null,
      whatSlipped.trim() ? `What slipped: ${whatSlipped.trim()}` : null,
      whyItSlipped.trim() ? `Why it slipped: ${whyItSlipped.trim()}` : null,
      topThreeValue ? `Top 3:\n${topThreeValue}` : null,
    ].filter((value): value is string => Boolean(value)).join('\n\n');

    if (!content.trim()) return;

    try {
      await captureInboxItem({
        content,
        source_label: 'review',
        suggested_kind: 'generic',
        domain_id: data.weakestDomain?.id ?? null,
      });
    } catch (error) {
      console.error('[weekly-review] send to inbox failed:', error);
    }
  }

  function toggleSuggestion(id: string) {
    setSelectedSuggestionIds((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ));
  }

  return (
    <div className="page-content fade-in">
      {data.warning ? (
        <div className="card" style={{ marginBottom: 12, borderColor: 'var(--color-warning)' }}>
          <PanelHeader title={<span style={{ color: 'var(--color-warning)' }}>WEEKLY REVIEW SAFE MODE</span>} style={{ borderColor: 'var(--color-warning)' }} />
          <div className="card-body">
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              The page stayed open using safe defaults because some saved records were malformed.
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-warning)' }}>{data.warning}</div>
          </div>
        </div>
      ) : null}

      <PageHeader
        title="WEEKLY REVIEW"
        subtitle={formatDateRangeDisplay(data.weekStart, data.weekEnd)}
        actions={(
          <>
            <button className="btn btn-ghost" onClick={() => handleSendToInbox().catch(console.error)}>SEND SUMMARY TO INBOX</button>
            <button className="btn btn-ghost" onClick={() => handleSaveNote().catch(console.error)} disabled={isSaving}>
              {saved ? 'SAVED TO NOTES' : isSaving ? 'SAVING...' : 'SAVE REVIEW NOTE'}
            </button>
            <button className="btn btn-primary" onClick={() => handleApplyPlan().catch(console.error)} disabled={isApplying || data.planAlreadyApplied || !hasApplyPayload}>
              {data.planAlreadyApplied ? 'PLAN ALREADY APPLIED' : isApplying ? 'APPLYING...' : 'APPLY NEXT WEEK'}
            </button>
          </>
        )}
      />

      <div className="panel-note" style={{ marginBottom: 12 }}>
        Primary outcome: commit next week&apos;s Top 3. Notes and inbox capture are optional, and habit adjustments only apply when you explicitly select them.
      </div>

      <hr className="page-sep" />

      <div className="layout-grid-stats" style={{ marginBottom: 12 }}>
        {[
          { label: 'TASKS DONE', value: data.completedTasks.length },
          { label: 'HABITS KEPT', value: data.effectiveLogs.length },
          { label: 'ACTIVE DAYS', value: data.activeHabitDays },
          { label: 'COMMITMENT LOAD', value: data.commitmentLoad.toLocaleString() },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="layout-grid-two" style={{ marginBottom: 12 }}>
        <div className="card">
          <PanelHeader title="NEXT-WEEK FOCUS THEME" meta={formatDateRangeDisplay(data.nextWeekStart, data.nextWeekEnd)} />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea className="input" style={{ width: '100%', minHeight: 90, resize: 'vertical' }} placeholder={data.focusSuggestion} value={focusTheme} onChange={(event) => setFocusTheme(event.target.value)} />
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{focusThemeValue}</div>
          </div>
        </div>

        <div className="card">
          <PanelHeader title="DOMAIN BALANCE" />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.domainStats.map((domain) => (
              <div key={domain.id} data-domain={domain.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', gap: 8, alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--domain-primary)' }}>{domain.label.toUpperCase()}</div>
                <div style={{ fontSize: 12, color: 'var(--color-accent)' }}>{domain.taskCount} tasks, {domain.habitDays} habit days</div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--color-warning)' }}>{domain.commitmentLoad} LOAD</div>
              </div>
            ))}
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--color-text-muted)' }}>{data.balanceSummary}</div>
          </div>
        </div>
      </div>

      <div className="layout-grid-two" style={{ marginBottom: 12 }}>
        <div className="card">
          <PanelHeader title="WHAT WORKED" />
          <div className="card-body">
            <textarea className="input" style={{ width: '100%', minHeight: 120, resize: 'vertical' }} placeholder="Capture what actually helped this week." value={whatWorked} onChange={(event) => setWhatWorked(event.target.value)} />
          </div>
        </div>

        <div className="card">
          <PanelHeader title="TOP 3 FOR NEXT WEEK" meta="FIRST ITEM BECOMES MIT" />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea className="input" style={{ width: '100%', minHeight: 140, resize: 'vertical' }} placeholder={defaultTopThreeText || '1. [Domain] ...\n2. [Domain] ...\n3. [Domain] ...'} value={topThree} onChange={(event) => setTopThree(event.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{topThreeValue || 'Add the three most important outcomes you want next week to protect.'}</div>
          </div>
        </div>
      </div>

      <div className="layout-grid-two" style={{ marginBottom: 12 }}>
        <div className="card">
          <PanelHeader title="WHAT SLIPPED AND WHY" meta={`${data.missedTasks.length} MISSED TASKS`} />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea className="input" style={{ width: '100%', minHeight: 90, resize: 'vertical' }} placeholder="What slipped this week?" value={whatSlipped} onChange={(event) => setWhatSlipped(event.target.value)} />
            <textarea className="input" style={{ width: '100%', minHeight: 90, resize: 'vertical' }} placeholder="Why did it slip?" value={whyItSlipped} onChange={(event) => setWhyItSlipped(event.target.value)} />
            {data.slipDrivers.length === 0 ? (
              <div className="empty-state" style={{ padding: '12px 0' }}>
                <div className="empty-state-title">NO STRONG FAILURE PATTERN</div>
                <div>No scheduled tasks slipped inside the review window.</div>
              </div>
            ) : (
              data.slipDrivers.map((driver) => (
                <div key={driver.id} style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', padding: '8px 10px' }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text)' }}>{driver.label} ({driver.count})</div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>{driver.detail}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <PanelHeader title="GOALS NEEDING ATTENTION" meta={`${data.stalledGoalsCount} STALLED`} />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.attentionGoals.length === 0 ? (
              <div className="empty-state" style={{ padding: '12px 0' }}>
                <div className="empty-state-title">GOALS LOOK STABLE</div>
                <div>No active goals are showing a strong warning sign right now.</div>
              </div>
            ) : (
              data.attentionGoals.map((goal) => (
                <div key={goal.id} data-domain={goal.domainId} style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-accent)' }}>{goal.title}</div>
                    <div style={{ fontSize: 11, color: goal.health === 'stalled' ? 'var(--color-danger)' : goal.health === 'at_risk' ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                      {getHealthLabel(goal.health)}
                    </div>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>{goal.nextAction || goal.blockedBy || 'No next action recorded yet.'}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="layout-grid-two">
        <div className="card">
          <PanelHeader title="MISSED WORK TO RECOVER" meta={data.missedTasks.length} />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.missedTasks.length === 0 ? (
              <div className="empty-state" style={{ padding: '12px 0' }}>
                <div className="empty-state-title">CLEAN WEEK</div>
                <div>No scheduled tasks slipped in the weekly window.</div>
              </div>
            ) : (
              data.missedTasks.slice(0, 6).map((task) => (
                <div key={task.id} data-domain={normalizeDomainId(task.domain_id)} style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13, color: 'var(--color-accent)' }}>{task.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-danger)' }}>{formatDateDisplay(task.due_date)}</div>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {task.goal_id ? 'Linked to a goal.' : 'Not linked to a goal.'}
                    {task.time_estimate_minutes ? ` Estimated at ${task.time_estimate_minutes}m.` : ' No estimate set.'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <PanelHeader title="HABIT ADJUSTMENTS" meta={`${selectedSuggestionLookup.size} SELECTED`} />
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Opt in only to the adjustments you want turned into next-week tasks.
            </div>
            {data.habitSuggestions.length === 0 ? (
              <div className="empty-state" style={{ padding: '12px 0' }}>
                <div className="empty-state-title">NO STRONG HABIT CHANGE SIGNAL</div>
                <div>Your recent habit data does not suggest an obvious adjustment.</div>
              </div>
            ) : (
              data.habitSuggestions.map((suggestion) => {
                const selected = selectedSuggestionLookup.has(suggestion.id);
                return (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="btn btn-ghost"
                    data-domain={suggestion.domainId}
                    onClick={() => toggleSuggestion(suggestion.id)}
                    style={{
                      width: '100%',
                      minHeight: 52,
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderColor: selected ? 'var(--color-warning)' : 'var(--color-border)',
                      color: selected ? 'var(--color-warning)' : 'var(--color-accent)',
                    }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 13 }}>{suggestion.habitTitle}: {suggestion.suggestion}</span>
                      <span style={{ fontSize: 11, color: selected ? 'var(--color-text)' : 'var(--color-text-muted)' }}>{suggestion.rationale}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
