import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import { useDomainStore } from '../store/useDomainStore';
import { useGoalStore } from '../store/useGoalStore';
import { useTimerStore } from '../store/useTimerStore';
import { useFocusStore } from '../store/useFocusStore';
import { useFrictionStore } from '../store/useFrictionStore';
import { useAppStore } from '../store/useAppStore';
import { TextInput, Select, Textarea } from '../components/shared/form';
import type { DomainId, EnergyLevel, Habit, Priority, Task, TaskFrictionReason } from '../lib/types';
import { getHabitCadenceLabel, getHabitProgressForDate, getHabitTargetLabel, isHabitDueOnDate } from '../lib/habit-schedule';
import {
  formatMinutes,
  getTaskRecurrenceLabel,
  hasTaskReachedStartDate,
  isTaskActionable,
  isTaskNeglected,
  isTaskOpen,
  isTaskOverdue,
  isTaskScheduledFor,
  isTaskStartingOn,
  isoDate,
  shiftDate,
  taskAgeDays,
  taskDueDay,
  taskEstimatedMinutes,
} from '../lib/task-planning';
import { Modal } from '../components/shared/Modal';
import { TaskForm } from '../components/tasks/TaskForm';
import { CompletionButton } from '../components/shared/CompletionButton';
import { PageHeader } from '../components/shared/PageHeader';
import { PanelHeader } from '../components/shared/PanelHeader';
import { getDefaultDomainId, getDomainLabel } from '../lib/domain-utils';
import { formatDateWithWeekday } from '../lib/date-format';

const DAILY_CAPACITY_MINUTES = 360;
const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const ENERGY_ORDER: Record<EnergyLevel, number> = { deep: 0, medium: 1, light: 2 };
const TASK_FRICTION_OPTIONS: Array<{ value: TaskFrictionReason; label: string }> = [
  { value: 'unclear', label: 'UNCLEAR' },
  { value: 'too_big', label: 'TOO BIG' },
  { value: 'low_energy', label: 'LOW ENERGY' },
  { value: 'overloaded', label: 'OVERLOADED' },
  { value: 'blocked', label: 'BLOCKED' },
  { value: 'avoidance', label: 'AVOIDANCE' },
  { value: 'interrupted', label: 'INTERRUPTED' },
  { value: 'priority_shift', label: 'PRIORITY SHIFT' },
];
const HABIT_SKIP_SUGGESTIONS = ['LOW ENERGY', 'OVERBOOKED', 'SICK', 'TRAVEL', 'DISRUPTED ROUTINE', 'FORGOT'];

type ReasonTone = 'default' | 'warning' | 'critical' | 'highlight';
type TaskReason = { label: string; tone: ReasonTone };

function chipStyle(tone: ReasonTone): React.CSSProperties {
  if (tone === 'highlight') return { border: '1px solid var(--color-warning)', color: 'var(--color-warning)', background: 'rgba(200,160,32,0.08)', padding: '2px var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', letterSpacing: 1, textTransform: 'uppercase' };
  if (tone === 'warning') return { border: '1px solid var(--color-text)', color: 'var(--color-text)', background: 'rgba(124,108,255,0.08)', padding: '2px var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', letterSpacing: 1, textTransform: 'uppercase' };
  if (tone === 'critical') return { border: '1px solid var(--color-danger)', color: 'var(--color-danger)', background: 'rgba(255,64,64,0.08)', padding: '2px var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', letterSpacing: 1, textTransform: 'uppercase' };
  return { border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', background: 'rgba(124,108,255,0.03)', padding: '2px var(--space-2)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', letterSpacing: 1, textTransform: 'uppercase' };
}

function taskReasons(task: Task, today: string): TaskReason[] {
  const reasons: TaskReason[] = [];
  if (task.is_mit) reasons.push({ label: 'MIT', tone: 'highlight' });
  if (task.is_top_three) reasons.push({ label: 'TOP 3', tone: 'highlight' });
  if (task.status === 'in_progress') reasons.push({ label: 'IN PROGRESS', tone: 'warning' });
  if (isTaskOverdue(task, today)) reasons.push({ label: 'OVERDUE', tone: 'critical' });
  else if (taskDueDay(task) === today) reasons.push({ label: 'DUE TODAY', tone: 'warning' });
  if (isTaskStartingOn(task, today)) reasons.push({ label: 'STARTS TODAY', tone: 'default' });
  else if (hasTaskReachedStartDate(task, today)) reasons.push({ label: 'READY NOW', tone: 'default' });
  if (isTaskScheduledFor(task, today)) reasons.push({ label: 'RECURS TODAY', tone: 'default' });
  if (isTaskNeglected(task, today)) reasons.push({ label: `NEGLECTED ${taskAgeDays(task, today)}D`, tone: 'critical' });
  if (task.goal_id) reasons.push({ label: 'GOAL LINKED', tone: 'default' });
  return reasons;
}

function taskScore(task: Task, today: string): number {
  let score = 0;
  if (task.is_mit) score += 150;
  if (task.status === 'in_progress') score += 120;
  if (task.is_top_three) score += 100;
  if (isTaskOverdue(task, today)) score += 90;
  if (taskDueDay(task) === today) score += 80;
  if (hasTaskReachedStartDate(task, today)) score += isTaskStartingOn(task, today) ? 70 : 60;
  if (isTaskScheduledFor(task, today)) score += 65;
  if (task.goal_id) score += 25;
  if (isTaskNeglected(task, today)) score += 15;
  score += Math.max(0, 4 - PRIORITY_ORDER[task.priority]) * 5;
  score += Math.max(0, 3 - ENERGY_ORDER[task.energy_level]) * 2;
  return score;
}

function focusSuggestionScore(task: Task, today: string, preferredEnergy: EnergyLevel, availableMinutes: number): number {
  const estimate = taskEstimatedMinutes(task);
  let score = taskScore(task, today);
  if (task.energy_level === preferredEnergy) score += 20;
  else if (Math.abs(ENERGY_ORDER[task.energy_level] - ENERGY_ORDER[preferredEnergy]) === 1) score += 8;
  if (estimate <= availableMinutes) score += 16;
  else if (estimate <= availableMinutes + 15) score += 6;
  return score;
}

function habitIncrementAmount(habit: Habit, current: number): number {
  if (habit.target_type === 'checkbox') return 1;
  if (habit.target_type === 'count') return 1;
  const remaining = Math.max(0, habit.target_value - current);
  if (remaining <= 5) return remaining || 5;
  return habit.target_value >= 30 ? 10 : 5;
}

function habitMinimumAmount(habit: Habit, current: number): number {
  if (habit.target_type === 'checkbox') return 1;
  if (habit.minimum_value && habit.minimum_value > current) return habit.minimum_value - current;
  return Math.max(1, Math.min(habit.target_value, habitIncrementAmount(habit, current)));
}

function habitRemainingAmount(habit: Habit, current: number): number {
  if (habit.target_type === 'checkbox') return 1;
  return Math.max(1, habit.target_value - current);
}

export const TodayPage: React.FC = () => {
  const { tasks, completeTask, updateTask, createTask } = useTaskStore();
  const { habits, logs, logHabit, logHabitMinimum, skipHabit, undoHabitLog } = useHabitStore();
  const { domains } = useDomainStore();
  const { goals } = useGoalStore();
  const { startTimer } = useTimerStore();
  const { sessions } = useFocusStore();
  const { createTaskFrictionLog, taskFrictionLogs } = useFrictionStore();
  const { setMitTask } = useAppStore();

  const [showNewTask, setShowNewTask] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false);
  const [showShrinkToday, setShowShrinkToday] = useState(false);
  const [showTomorrow, setShowTomorrow] = useState(false);
  const [tomorrowCarryTaskId, setTomorrowCarryTaskId] = useState<string | null>(null);
  const [tomorrowTaskTitle, setTomorrowTaskTitle] = useState('');
  const [availableFocusMinutes, setAvailableFocusMinutes] = useState(60);
  const [preferredEnergy, setPreferredEnergy] = useState<EnergyLevel>('medium');
  const [frictionTarget, setFrictionTarget] = useState<{ task: Task; plannedForDate?: string; actionType: 'deferred' | 'blocked' } | null>(null);
  const [frictionReason, setFrictionReason] = useState<TaskFrictionReason>('overloaded');
  const [frictionDetails, setFrictionDetails] = useState('');
  const [skipTarget, setSkipTarget] = useState<{ habit: Habit; date: string } | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const briefShown = useRef(false);

  const today = isoDate(new Date());
  const tomorrow = shiftDate(today, 1);
  const weekStart = shiftDate(today, -6);
  const defaultDomainId = getDefaultDomainId(domains);

  const actionableTasks = useMemo(() => tasks.filter((task) => isTaskActionable(task)), [tasks]);
  const openTasks = useMemo(() => actionableTasks.filter((task) => isTaskOpen(task)), [actionableTasks]);
  const mitTask = useMemo(() => openTasks.find((task) => task.is_mit), [openTasks]);
  const topThreeTasks = useMemo(() => openTasks.filter((task) => task.is_top_three).sort((a, b) => taskScore(b, today) - taskScore(a, today)), [openTasks, today]);
  const overdueTasks = useMemo(() => openTasks.filter((task) => isTaskOverdue(task, today)).sort((a, b) => taskScore(b, today) - taskScore(a, today)), [openTasks, today]);
  const inProgressTasks = useMemo(() => openTasks.filter((task) => task.status === 'in_progress').sort((a, b) => taskScore(b, today) - taskScore(a, today)), [openTasks, today]);
  const neglectedTasks = useMemo(() => openTasks.filter((task) => isTaskNeglected(task, today)).sort((a, b) => taskScore(b, today) - taskScore(a, today)), [openTasks, today]);
  const dueTodayTasks = useMemo(() => openTasks.filter((task) => taskDueDay(task) === today).sort((a, b) => taskScore(b, today) - taskScore(a, today)), [openTasks, today]);
  const startedTasks = useMemo(() => openTasks.filter((task) => hasTaskReachedStartDate(task, today)).sort((a, b) => taskScore(b, today) - taskScore(a, today)), [openTasks, today]);
  const recurringTodayTasks = useMemo(() => openTasks.filter((task) => isTaskScheduledFor(task, today)).sort((a, b) => taskScore(b, today) - taskScore(a, today)), [openTasks, today]);
  const boardTasks = useMemo(() => {
    const ordered = [mitTask, ...topThreeTasks, ...inProgressTasks, ...overdueTasks, ...dueTodayTasks, ...startedTasks, ...recurringTodayTasks];
    const seen = new Set<string>();
    return ordered.filter((task): task is Task => {
      if (!task) return false;
      if (seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  }, [dueTodayTasks, inProgressTasks, mitTask, overdueTasks, recurringTodayTasks, startedTasks, topThreeTasks]);
  const suggestedPlanTasks = useMemo(() => openTasks.slice().sort((a, b) => taskScore(b, today) - taskScore(a, today)).slice(0, 3), [openTasks, today]);
  const nextActionTask = boardTasks[0] ?? suggestedPlanTasks[0] ?? null;
  const primaryFocusTask = mitTask ?? nextActionTask;
  const shrinkKeepTask = primaryFocusTask ?? boardTasks[0] ?? null;
  const shrinkMoveTasks = boardTasks.filter((task) => task.id !== shrinkKeepTask?.id);
  const focusLoadMinutes = boardTasks.reduce((sum, task) => sum + taskEstimatedMinutes(task), 0);
  const capacityPct = Math.min(100, Math.round((focusLoadMinutes / DAILY_CAPACITY_MINUTES) * 100));
  const isOverCapacity = focusLoadMinutes > DAILY_CAPACITY_MINUTES;
  const doneTodayCount = actionableTasks.filter((task) => task.status === 'done' && task.completed_at?.slice(0, 10) === today).length;

  const habitProgressById = useMemo(() => new Map(habits.map((habit) => [habit.id, getHabitProgressForDate(habit, logs, today)] as const)), [habits, logs, today]);
  const dueHabitsToday = useMemo(() => habits.filter((habit) => habit.is_active && isHabitDueOnDate(habit, today, logs)), [habits, logs, today]);
  const openHabitsToday = useMemo(() => dueHabitsToday.filter((habit) => !(habitProgressById.get(habit.id)?.isComplete ?? false)), [dueHabitsToday, habitProgressById]);
  const completedHabitsToday = dueHabitsToday.length - openHabitsToday.length;

  const weeklySessions = useMemo(() => sessions.filter((session) => session.started_at.slice(0, 10) >= weekStart && session.started_at.slice(0, 10) <= today), [sessions, today, weekStart]);
  const weeklyFocusMinutes = weeklySessions.reduce((sum, session) => sum + session.actual_minutes, 0);
  const weeklyDistractions = weeklySessions.reduce((sum, session) => sum + session.distraction_count, 0);
  const recentOverloadLogs = taskFrictionLogs.filter((log) => log.created_at.slice(0, 10) >= weekStart && log.reason === 'overloaded').length;
  const skippedHabitsThisWeek = logs.filter((log) => log.status === 'skipped' && log.completed_date >= weekStart).length;
  const neglectedDomains = domains.filter((domain) => !domain.last_activity_date || domain.last_activity_date < shiftDate(today, -3));
  const burnoutRiskScore = [overdueTasks.length >= 3, focusLoadMinutes > DAILY_CAPACITY_MINUTES, recentOverloadLogs >= 2, skippedHabitsThisWeek >= 3, weeklyDistractions >= 8].filter(Boolean).length;
  const recoveryMode = burnoutRiskScore >= 2;
  const recoveryPrompt = recoveryMode
    ? 'Today is for restoring reliability. Keep the board honest and finish the smallest commitments that rebuild trust.'
    : burnoutRiskScore > 0
      ? 'Your load is rising. Reduce scope before the day turns reactive.'
      : 'The board is manageable. Protect your first focus block.';

  const suggestedFocusTasks = useMemo(
    () => openTasks.filter((task) => taskEstimatedMinutes(task) <= availableFocusMinutes + 20).sort((a, b) => focusSuggestionScore(b, today, preferredEnergy, availableFocusMinutes) - focusSuggestionScore(a, today, preferredEnergy, availableFocusMinutes)).slice(0, 3),
    [availableFocusMinutes, openTasks, preferredEnergy, today],
  );

  useEffect(() => {
    if (briefShown.current || openTasks.length === 0 || mitTask || topThreeTasks.length > 0) return;
    briefShown.current = true;
    setShowPlanning(true);
  }, [mitTask, openTasks.length, topThreeTasks.length]);

  async function handleSetMit(taskId: string): Promise<void> {
    const currentMit = openTasks.find((task) => task.is_mit && task.id !== taskId);
    try {
      if (currentMit) await updateTask({ id: currentMit.id, is_mit: false });
      await updateTask({ id: taskId, is_mit: true });
      await setMitTask(taskId);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleToggleTopThree(task: Task): Promise<void> {
    if (!task.is_top_three && topThreeTasks.length >= 3) return;
    try {
      await updateTask({ id: task.id, is_top_three: !task.is_top_three });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleFocus(task: Task): Promise<void> {
    try {
      if (task.status !== 'in_progress') await updateTask({ id: task.id, status: 'in_progress' });
      await startTimer(task.id, task.time_estimate_minutes ?? availableFocusMinutes);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCompleteTask(task: Task): Promise<void> {
    try {
      await completeTask(task.id);
    } catch (error) {
      console.error(error);
    }
  }

  async function handlePlanTask(task: Task, plannedForDate: string): Promise<void> {
    setFrictionTarget({ task, plannedForDate, actionType: 'deferred' });
    setFrictionReason('overloaded');
    setFrictionDetails('');
  }

  function requestTaskBlocked(task: Task): void {
    setFrictionTarget({ task, actionType: 'blocked' });
    setFrictionReason('blocked');
    setFrictionDetails('');
  }

  async function handleSaveTaskFriction(): Promise<void> {
    if (!frictionTarget) return;
    try {
      await createTaskFrictionLog({ task_id: frictionTarget.task.id, reason: frictionReason, details: frictionDetails.trim() || undefined, action_type: frictionTarget.actionType });
      if (frictionTarget.actionType === 'deferred') {
        await updateTask({ id: frictionTarget.task.id, planned_for_date: frictionTarget.plannedForDate ?? '', status: 'todo', is_mit: false });
      }
      setFrictionTarget(null);
      setFrictionDetails('');
    } catch (error) {
      console.error(error);
    }
  }

  async function handleApplyPlanToday(): Promise<void> {
    try {
      const suggestedMit = mitTask ?? suggestedPlanTasks[0];
      if (suggestedMit) await handleSetMit(suggestedMit.id);
      const recommendedIds = new Set(suggestedPlanTasks.map((task) => task.id).slice(0, 3));
      await Promise.all(openTasks.map((task) => task.is_top_three === recommendedIds.has(task.id) ? Promise.resolve() : updateTask({ id: task.id, is_top_three: recommendedIds.has(task.id) })));
      setShowPlanning(false);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleShrinkToday(): Promise<void> {
    if (shrinkMoveTasks.length === 0) {
      setShowShrinkToday(false);
      return;
    }

    try {
      if (shrinkKeepTask && !shrinkKeepTask.is_mit) {
        await handleSetMit(shrinkKeepTask.id);
      }

      await Promise.all(shrinkMoveTasks.map((task) => updateTask({
        id: task.id,
        planned_for_date: tomorrow,
        is_mit: false,
        is_top_three: false,
        status: task.status === 'in_progress' ? 'todo' : task.status,
      })));

      setShowShrinkToday(false);
    } catch (error) {
      console.error(error);
    }
  }

  async function handlePrepareTomorrow(): Promise<void> {
    try {
      if (tomorrowCarryTaskId) {
        await updateTask({ id: tomorrowCarryTaskId, planned_for_date: tomorrow, is_top_three: false, is_mit: false });
      } else if (tomorrowTaskTitle.trim()) {
        const chosenDomain = (mitTask?.domain_id ?? nextActionTask?.domain_id ?? defaultDomainId) as DomainId;
        await createTask({
          domain_id: chosenDomain,
          title: tomorrowTaskTitle.trim(),
          priority: 'high',
          energy_level: 'medium',
          is_mit: false,
          is_top_three: false,
          planned_for_date: tomorrow,
          time_estimate_minutes: 45,
          tags: JSON.stringify(['shutdown-plan']),
        });
      }
      setTomorrowCarryTaskId(null);
      setTomorrowTaskTitle('');
      setShowTomorrow(false);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleHabitAdd(habit: Habit, amount: number, mode: 'progress' | 'minimum' | 'complete'): Promise<void> {
    const progress = habitProgressById.get(habit.id);
    const current = progress?.current ?? 0;
    try {
      if (mode === 'minimum') {
        await logHabitMinimum(habit.id, today, Math.max(1, amount));
        return;
      }
      if (mode === 'complete') {
        await logHabit(habit.id, today, habitRemainingAmount(habit, current));
        return;
      }
      await logHabit(habit.id, today, Math.max(1, amount));
    } catch (error) {
      console.error(error);
    }
  }

  const dateLabel = formatDateWithWeekday(new Date());

  return (
    <div className="page-content fade-in">
      <PageHeader
        title="TODAY"
        subtitle={dateLabel}
        actions={(
          <>
            <button className="btn btn-primary" onClick={() => setShowPlanning(true)}>PLAN TODAY</button>
            <button className="btn btn-ghost" onClick={() => setShowTomorrow(true)}>PREP TOMORROW</button>
            <button className="btn btn-ghost" onClick={() => setShowNewTask(true)}>+ NEW TASK</button>
          </>
        )}
      />

      <hr className="page-sep" />

      {(recoveryMode || burnoutRiskScore > 0 || neglectedDomains.length > 0) && (
        <div className="card" style={{ marginBottom: 'var(--space-3)', borderColor: recoveryMode ? 'var(--color-warning)' : 'var(--color-border)' }}>
          <PanelHeader title={recoveryMode ? 'RECOVERY MODE' : 'LOAD CHECK'} meta={`RISK ${burnoutRiskScore}/5`} />
          <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: recoveryMode ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>{recoveryPrompt}</div>
            {neglectedDomains.length > 0 && (
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Neglected: {neglectedDomains.map((domain) => getDomainLabel(domain.id, domains)).join(' / ')}
              </div>
            )}
            {(recoveryMode || (burnoutRiskScore > 0 && boardTasks.length > 1)) && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={() => setShowShrinkToday(true)}>SHRINK TODAY</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowPlanning(true)}>REVIEW PLAN</button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="layout-grid-split" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="card">
          <PanelHeader title="START TODAY" meta={recoveryMode ? 'RECOVERY FIRST' : '30 SECOND RESET'} />
          <div className="card-body" style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <div className="panel-note" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)' }}>
              Confirm the day in this order: lock one MIT, keep the Top 3 realistic, then start the first focus block before the board gets noisy.
            </div>

            <div className="layout-grid-three">
              <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', padding: 'var(--space-3) var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>1. Confirm MIT</div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: mitTask ? 'var(--color-text)' : 'var(--color-warning)' }}>
                  {mitTask ? mitTask.title : 'No MIT locked yet.'}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
                  {mitTask ? 'One must-do is protecting the day.' : 'Pick the one task that makes the day feel real if it gets done.'}
                </div>
                {mitTask ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowPlanning(true)}>REVIEW PLAN</button>
                ) : nextActionTask ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => handleSetMit(nextActionTask.id).catch(console.error)}>MAKE NEXT ACTION MIT</button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowPlanning(true)}>PLAN TODAY</button>
                )}
              </div>

              <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', padding: 'var(--space-3) var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>2. Confirm Top 3</div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: topThreeTasks.length > 0 ? 'var(--color-text)' : 'var(--color-warning)' }}>
                  {topThreeTasks.length}/3 locked
                </div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
                  {topThreeTasks.length === 3 ? 'The day is scoped. Avoid adding more unless the board changes.' : 'Keep the success line short enough to trust.'}
                </div>
                {nextActionTask && !nextActionTask.is_top_three && topThreeTasks.length < 3 ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => handleToggleTopThree(nextActionTask).catch(console.error)}>ADD NEXT ACTION</button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowPlanning(true)}>ADJUST TOP 3</button>
                )}
              </div>

              <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', padding: 'var(--space-3) var(--space-3)', display: 'grid', gap: 'var(--space-2)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>3. Start Focus</div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: primaryFocusTask ? 'var(--color-text)' : 'var(--color-warning)' }}>
                  {primaryFocusTask ? formatMinutes(taskEstimatedMinutes(primaryFocusTask)) : 'Not ready yet'}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
                  {primaryFocusTask ? 'Start the first block before tuning the rest of the board.' : 'Choose a task first so focus has a target.'}
                </div>
                {primaryFocusTask ? (
                  <button className="btn btn-primary btn-sm" onClick={() => handleFocus(primaryFocusTask).catch(console.error)}>
                    {mitTask ? 'FOCUS MIT' : 'FOCUS NEXT ACTION'}
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowPlanning(true)}>SET THE BOARD</button>
                )}
              </div>
            </div>

            <div
              data-domain={primaryFocusTask?.domain_id}
              style={{
                border: '1px solid var(--color-border)',
                background: 'rgba(124,108,255,0.03)',
                padding: 'var(--space-3) var(--space-4)',
                display: 'grid',
                gap: 'var(--space-3)',
              }}
            >
              {primaryFocusTask ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>First Focus Block</div>
                      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', marginTop: 'var(--space-1)' }}>{primaryFocusTask.title}</div>
                    </div>
                    <CompletionButton done={false} onComplete={async () => { await handleCompleteTask(primaryFocusTask); }} size={16} />
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {taskReasons(primaryFocusTask, today).map((reason) => (
                      <span key={`${primaryFocusTask.id}-${reason.label}`} style={chipStyle(reason.tone)}>{reason.label}</span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {!primaryFocusTask.is_mit && <button className="btn btn-ghost btn-sm" onClick={() => handleSetMit(primaryFocusTask.id).catch(console.error)}>MAKE MIT</button>}
                    {!primaryFocusTask.is_top_three && topThreeTasks.length < 3 && <button className="btn btn-ghost btn-sm" onClick={() => handleToggleTopThree(primaryFocusTask).catch(console.error)}>ADD TOP 3</button>}
                    <button className="btn btn-primary btn-sm" onClick={() => handleFocus(primaryFocusTask).catch(console.error)}>START FOCUS</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handlePlanTask(primaryFocusTask, tomorrow).catch(console.error)}>TOMORROW</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => requestTaskBlocked(primaryFocusTask)}>BLOCKED</button>
                  </div>
                </>
              ) : (
                <div className="empty-state" style={{ padding: 'var(--space-2) 0' }}>
                  <div className="empty-state-title">SET THE DAY FIRST</div>
                  <div>Run Plan Today or create one task so the first move is obvious.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div className="card">
            <PanelHeader title="TODAY LOAD" meta={`${boardTasks.length} ACTIVE`} />
            <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-accent)' }}>
                <span>Done today</span>
                <span>{doneTodayCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-accent)' }}>
                <span>Top 3 locked</span>
                <span>{topThreeTasks.length}/3</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-accent)' }}>
                <span>Habits still open</span>
                <span>{openHabitsToday.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-accent)' }}>
                <span>Focus this week</span>
                <span>{formatMinutes(weeklyFocusMinutes)}</span>
              </div>
              <div className="progress-track" style={{ height: 8 }}>
                <div className="progress-fill" style={{ width: `${capacityPct}%`, background: recoveryMode ? 'var(--color-warning)' : isOverCapacity ? 'var(--color-danger)' : 'var(--color-accent)' }} />
              </div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: recoveryMode ? 'var(--color-warning)' : isOverCapacity ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                {recoveryMode
                  ? 'Recovery mode is active. A smaller honest board beats an ambitious fake one.'
                  : isOverCapacity
                    ? `This board carries ${formatMinutes(focusLoadMinutes - DAILY_CAPACITY_MINUTES)} too much for one day.`
                    : 'This board still fits a realistic day.'}
              </div>
            </div>
          </div>

          <div className="card">
            <PanelHeader title="SIGNALS" meta={`${overdueTasks.length + inProgressTasks.length + neglectedTasks.length} ACTIVE`} />
            <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
              {overdueTasks.length === 0 && inProgressTasks.length === 0 && neglectedTasks.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-2) 0' }}>
                  <div className="empty-state-title">NO SHARP DRAG</div>
                  <div>The day looks stable enough to stay in execution mode.</div>
                </div>
              ) : (
                [
                  { title: 'Overdue', items: overdueTasks.slice(0, 3), color: 'var(--color-danger)', detail: (task: Task) => `Due ${taskDueDay(task) ?? '--'}` },
                  { title: 'In Progress', items: inProgressTasks.slice(0, 3), color: 'var(--color-text)', detail: () => 'Already moving' },
                  { title: 'Neglected', items: neglectedTasks.slice(0, 3), color: 'var(--color-warning)', detail: (task: Task) => `Quiet ${taskAgeDays(task, today)}d` },
                ].filter((section) => section.items.length > 0).map((section) => (
                  <div key={section.title} style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', padding: 'var(--space-2) var(--space-3)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: section.color, textTransform: 'uppercase', letterSpacing: 1 }}>{section.title}</span>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>{section.items.length}</span>
                    </div>
                    <div style={{ display: 'grid', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                      {section.items.map((task) => (
                        <div key={task.id}>
                          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-accent)' }}>{task.title}</div>
                          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{section.detail(task)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="layout-grid-split">
        <div className="card">
            <PanelHeader title="FOCUS BOARD" meta={`${boardTasks.length} ACTIVE`} />
            <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)', padding: 0 }}>
              <div style={{ padding: 'var(--space-3) var(--space-4) 0', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
                Keep this list small. If something does not belong in today, move it out or mark the friction honestly.
              </div>
              {boardTasks.length === 0 ? (
                <div className="empty-state" style={{ margin: '0 var(--space-4) var(--space-4)' }}>
                  <div className="empty-state-title">NO FOCUS BOARD YET</div>
                  <div>Stage up to three tasks that matter now, then start the first one quickly.</div>
                </div>
              ) : (
                <div className="stagger-in">
                  {boardTasks.map((task) => {
                const goal = task.goal_id ? goals.find((item) => item.id === task.goal_id) : null;
                const topThreeLimitReached = !task.is_top_three && topThreeTasks.length >= 3;
                return (
                  <div key={task.id} data-domain={task.domain_id} className="task-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-3)', borderTop: '1px solid var(--color-surface-hover)', minHeight: 56 }}>
                    <CompletionButton done={false} onComplete={async () => { await handleCompleteTask(task); }} size={15} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-accent)' }}>{task.title}</div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                        <span className={`priority-badge-${task.priority}`}>{task.priority}</span>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: task.energy_level === 'deep' ? 'var(--color-warning)' : task.energy_level === 'light' ? 'var(--color-info)' : 'var(--color-text-muted)', border: '1px solid var(--color-border)', padding: '1px var(--space-1)', letterSpacing: 1, textTransform: 'uppercase' }}>{task.energy_level}</span>
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{formatMinutes(taskEstimatedMinutes(task))}</span>
                        {getTaskRecurrenceLabel(task) && <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: 1 }}>{getTaskRecurrenceLabel(task)}</span>}
                        {goal && <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>GOAL: {goal.title}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                        {taskReasons(task, today).map((reason) => (
                          <span key={`${task.id}-${reason.label}`} style={chipStyle(reason.tone)}>{reason.label}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleFocus(task).catch(console.error)}>FOCUS</button>
                        {!task.is_mit && <button className="btn btn-ghost btn-sm" onClick={() => handleSetMit(task.id).catch(console.error)}>MAKE MIT</button>}
                        <button className="btn btn-ghost btn-sm" disabled={topThreeLimitReached} style={task.is_top_three ? { color: 'var(--color-warning)', borderColor: 'var(--color-warning)' } : undefined} onClick={() => handleToggleTopThree(task).catch(console.error)}>{task.is_top_three ? 'REMOVE TOP 3' : 'ADD TOP 3'}</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handlePlanTask(task, tomorrow).catch(console.error)}>TOMORROW</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => requestTaskBlocked(task)}>BLOCKED</button>
                      </div>
                    </div>
                  </div>
                );
              })}
                </div>
              )}
            </div>
          </div>

        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <div className="card" style={{ order: 2 }}>
            <PanelHeader title="QUICK FOCUS FITS" meta={`${formatMinutes(availableFocusMinutes)} / ${preferredEnergy.toUpperCase()}`} />
            <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
                Use this when the board feels too heavy and you need a realistic next block that fits your current energy.
              </div>
              <div className="layout-grid-controls">
                <Select value={String(availableFocusMinutes)} onChange={(event) => setAvailableFocusMinutes(parseInt(event.target.value, 10) || 60)}>
                  <option value="15">15 MIN WINDOW</option>
                  <option value="30">30 MIN WINDOW</option>
                  <option value="45">45 MIN WINDOW</option>
                  <option value="60">60 MIN WINDOW</option>
                  <option value="90">90 MIN WINDOW</option>
                  <option value="120">120 MIN WINDOW</option>
                </Select>
                <Select value={preferredEnergy} onChange={(event) => setPreferredEnergy(event.target.value as EnergyLevel)}>
                  <option value="deep">DEEP ENERGY</option>
                  <option value="medium">MEDIUM ENERGY</option>
                  <option value="light">LIGHT ENERGY</option>
                </Select>
              </div>
              {suggestedFocusTasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-title">NO GOOD FIT</div>
                  <div>Try a larger time window or a lighter energy mode.</div>
                </div>
              ) : suggestedFocusTasks.map((task) => (
                <div key={`focus-${task.id}`} data-domain={task.domain_id} style={{ border: '1px solid var(--color-surface-hover)', padding: 'var(--space-2) var(--space-3)', background: 'rgba(124,108,255,0.03)' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)' }}>{task.title}</div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: 1 }}>{task.energy_level} / {formatMinutes(taskEstimatedMinutes(task))}</div>
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-2)' }} onClick={() => handleFocus(task).catch(console.error)}>FOCUS</button>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ order: 1 }}>
            <PanelHeader title="DAILY HABITS" meta={`${completedHabitsToday}/${dueHabitsToday.length} LOGGED`} />
            <div className="card-body" style={{ display: 'grid', gap: 'var(--space-3)', padding: 0 }}>
              <div style={{ padding: 'var(--space-3) var(--space-4) 0', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
                Log what is real. Minimum counts, skips stay honest, and undo is always available.
              </div>
              {dueHabitsToday.length === 0 ? (
                <div className="empty-state" style={{ margin: '0 var(--space-4) var(--space-4)' }}>
                  <div className="empty-state-title">NO HABITS DUE</div>
                  <div>The habit board is clear for today.</div>
                </div>
              ) : dueHabitsToday.map((habit) => {
                const progress = habitProgressById.get(habit.id);
                if (!progress) return null;
                const latestLog = progress.latestLog;
                const increment = habitIncrementAmount(habit, progress.current);
                const minimumAmount = habitMinimumAmount(habit, progress.current);
                return (
                  <div key={habit.id} data-domain={habit.domain_id} className="habit-row" style={{ padding: 'var(--space-3) var(--space-3)', borderTop: '1px solid var(--color-surface-hover)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-accent)' }}>{habit.title}</div>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: 1 }}>{getHabitCadenceLabel(habit)} / {getHabitTargetLabel(habit)} / STREAK {habit.streak_current}D</div>
                        {habit.minimum_version && <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-warning)', marginTop: 'var(--space-1)' }}>Minimum: {habit.minimum_version}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-bold)', color: progress.isComplete ? 'var(--color-text)' : 'var(--color-accent)' }}>{progress.current}/{progress.target}</div>
                        {latestLog && <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: latestLog.status === 'skipped' ? 'var(--color-danger)' : latestLog.status === 'minimum' ? 'var(--color-warning)' : 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{latestLog.status}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                      {latestLog ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => undoHabitLog(habit.id, today).catch(console.error)}>UNDO</button>
                      ) : (
                        <>
                          {habit.target_type === 'checkbox' ? (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => handleHabitAdd(habit, 1, 'progress').catch(console.error)}>COMPLETE</button>
                              {habit.minimum_version && <button className="btn btn-ghost btn-sm" onClick={() => handleHabitAdd(habit, 1, 'minimum').catch(console.error)}>MINIMUM</button>}
                            </>
                          ) : (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => handleHabitAdd(habit, increment, 'progress').catch(console.error)}>+{increment}</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleHabitAdd(habit, minimumAmount, 'minimum').catch(console.error)}>MINIMUM</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleHabitAdd(habit, habitRemainingAmount(habit, progress.current), 'complete').catch(console.error)}>COMPLETE</button>
                            </>
                          )}
                          <button className="btn btn-ghost btn-sm" onClick={() => { setSkipTarget({ habit, date: today }); setSkipReason(''); }}>SKIP</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Modal open={showShrinkToday} onClose={() => setShowShrinkToday(false)} title="Shrink Today">
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
            This keeps one real focus task and moves the rest of the board to tomorrow. It is for overload recovery, not for hiding work.
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Keep In Play</span>
            </div>
            <div className="card-body">
              {shrinkKeepTask ? (
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>{shrinkKeepTask.title}</div>
              ) : (
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>No clear primary task yet.</div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Move To Tomorrow</span>
              <span className="card-meta">{shrinkMoveTasks.length}</span>
            </div>
            <div className="card-body" style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {shrinkMoveTasks.length === 0 ? (
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>The board is already lean.</div>
              ) : shrinkMoveTasks.map((task) => (
                <div key={task.id} style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-accent)' }}>{task.title}</div>
              ))}
            </div>
          </div>
          <div className="layout-actions-end">
            <button className="btn btn-ghost" onClick={() => setShowShrinkToday(false)}>CANCEL</button>
            <button className="btn btn-primary" onClick={() => handleShrinkToday().catch(console.error)} disabled={shrinkMoveTasks.length === 0}>KEEP ONE / MOVE REST</button>
          </div>
        </div>
      </Modal>

      <Modal open={showPlanning} onClose={() => setShowPlanning(false)} title="Plan Today">
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Suggestions never apply silently. Review them, then lock the board if they make sense.
          </div>
          <div className="layout-grid-two">
            <div className="card">
              <div className="card-header"><span className="card-title">Suggested MIT</span></div>
              <div className="card-body">
                {nextActionTask ? (
                  <>
                    <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)' }}>{nextActionTask.title}</div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                      {taskReasons(nextActionTask, today).map((reason) => <span key={`mit-${reason.label}`} style={chipStyle(reason.tone)}>{reason.label}</span>)}
                    </div>
                  </>
                ) : <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>No candidate yet.</div>}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">Capacity Check</span></div>
              <div className="card-body">
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: isOverCapacity ? 'var(--color-danger)' : 'var(--color-text)' }}>{formatMinutes(focusLoadMinutes)} / {formatMinutes(DAILY_CAPACITY_MINUTES)}</div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: isOverCapacity ? 'var(--color-danger)' : 'var(--color-text-muted)', marginTop: 'var(--space-2)' }}>{isOverCapacity ? 'This is too much for one day.' : 'This fits a realistic day.'}</div>
              </div>
            </div>
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header"><span className="card-title">Suggested Top 3</span></div>
              <div className="card-body" style={{ display: 'grid', gap: 'var(--space-2)' }}>
                {suggestedPlanTasks.length === 0 ? <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>No open tasks to plan yet.</div> : suggestedPlanTasks.map((task, index) => (
                  <div key={task.id} data-domain={task.domain_id} style={{ border: '1px solid var(--color-border)', padding: 'var(--space-2) var(--space-3)', background: 'var(--color-surface-hover)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Slot {index + 1}</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text)', marginTop: 3 }}>{task.title}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="layout-actions-end">
            <button className="btn btn-ghost" onClick={() => setShowPlanning(false)}>REVIEW MANUALLY</button>
            <button className="btn btn-primary" onClick={() => handleApplyPlanToday().catch(console.error)}>APPLY SUGGESTED PLAN</button>
          </div>
        </div>
      </Modal>

      <Modal open={showTomorrow} onClose={() => setShowTomorrow(false)} title="Prep Tomorrow">
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Stage one carry-forward task or create one fresh task for tomorrow. It will start tomorrow without hijacking today&apos;s board.
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">Carry Forward</span></div>
            <div className="card-body" style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {boardTasks.length === 0 ? <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>No active tasks to carry forward.</div> : boardTasks.slice(0, 5).map((task) => (
                <button key={task.id} className="btn btn-ghost" style={tomorrowCarryTaskId === task.id ? { color: 'var(--color-warning)', borderColor: 'var(--color-warning)' } : undefined} onClick={() => { setTomorrowCarryTaskId((current) => current === task.id ? null : task.id); setTomorrowTaskTitle(''); }}>
                  {task.title}
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">New Tomorrow Task</span></div>
            <div className="card-body">
              <TextInput value={tomorrowTaskTitle} onChange={(event) => { setTomorrowTaskTitle(event.target.value); if (event.target.value.trim()) setTomorrowCarryTaskId(null); }} placeholder="What must happen tomorrow?" />
            </div>
          </div>
          <div className="layout-actions-end">
            <button className="btn btn-ghost" onClick={() => setShowTomorrow(false)}>CANCEL</button>
            <button className="btn btn-primary" disabled={!tomorrowCarryTaskId && !tomorrowTaskTitle.trim()} onClick={() => handlePrepareTomorrow().catch(console.error)}>SAVE TOMORROW PLAN</button>
          </div>
        </div>
      </Modal>

      <Modal open={showNewTask} onClose={() => setShowNewTask(false)} title="New Task">
        <TaskForm onClose={() => setShowNewTask(false)} />
      </Modal>

      <Modal open={Boolean(frictionTarget)} onClose={() => setFrictionTarget(null)} title={frictionTarget?.actionType === 'blocked' ? 'Task Blocked' : 'Set Start Date'}>
        {frictionTarget && (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{frictionTarget.task.title}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {TASK_FRICTION_OPTIONS.map((option) => (
                <button key={option.value} className="btn btn-ghost btn-sm" style={frictionReason === option.value ? { color: 'var(--color-warning)', borderColor: 'var(--color-warning)' } : undefined} onClick={() => setFrictionReason(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
            <Textarea rows={3} value={frictionDetails} onChange={(event) => setFrictionDetails(event.target.value)} placeholder="What got in the way?" style={{ resize: 'none' }} />
            <div className="layout-actions-end">
              <button className="btn btn-ghost" onClick={() => setFrictionTarget(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={() => handleSaveTaskFriction().catch(console.error)}>{frictionTarget.actionType === 'blocked' ? 'SAVE BLOCK' : 'SAVE START DATE'}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(skipTarget)} onClose={() => setSkipTarget(null)} title="Skip Habit">
        {skipTarget && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await skipHabit(skipTarget.habit.id, skipTarget.date, skipReason);
                setSkipTarget(null);
                setSkipReason('');
              } catch (error) {
                console.error(error);
              }
            }}
            style={{ display: 'grid', gap: 'var(--space-3)' }}
          >
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Why are you skipping "{skipTarget.habit.title}" for {skipTarget.date}?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {HABIT_SKIP_SUGGESTIONS.map((reason) => (
                <button key={reason} type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipReason(reason)} style={skipReason === reason ? { color: 'var(--color-warning)', borderColor: 'var(--color-warning)' } : undefined}>
                  {reason}
                </button>
              ))}
            </div>
            <Textarea value={skipReason} onChange={(event) => setSkipReason(event.target.value)} rows={3} placeholder="Low energy, travel, sick, overloaded..." style={{ resize: 'none' }} />
            <div className="layout-actions-end">
              <button type="button" className="btn btn-ghost" onClick={() => setSkipTarget(null)}>CANCEL</button>
              <button type="submit" className="btn btn-primary" disabled={!skipReason.trim()}>SAVE SKIP</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
