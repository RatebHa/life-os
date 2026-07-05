import type { Task } from './types';
import { formatDateDisplay } from './date-format';

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function shiftDate(base: string, days: number): string {
  const next = new Date(`${base}T12:00:00`);
  next.setDate(next.getDate() + days);
  return isoDate(next);
}

export function parseStringArray(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || '[]') as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

export function formatMinutes(total: number): string {
  if (total <= 0) return '0M';
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours <= 0) return `${minutes}M`;
  return `${hours}H ${minutes}M`;
}

export function taskEstimatedMinutes(task: Task): number {
  return task.time_estimate_minutes ?? 30;
}

export function isTaskTemplate(task: Task): boolean {
  return task.task_kind === 'recurring_template';
}

export function isTaskActionable(task: Task): boolean {
  return task.status !== 'archived' && !isTaskTemplate(task);
}

export function isTaskOpen(task: Task): boolean {
  return isTaskActionable(task) && task.status !== 'done';
}

export function taskCompletedDay(task: Task): string | null {
  return task.completed_at?.slice(0, 10) ?? null;
}

export function taskDueDay(task: Task): string | null {
  return task.due_date?.slice(0, 10) ?? null;
}

export function taskPlannedDay(task: Task): string | null {
  return task.planned_for_date?.slice(0, 10) ?? null;
}

export function taskScheduledDay(task: Task): string | null {
  return task.scheduled_for?.slice(0, 10) ?? null;
}

export function taskCreatedDay(task: Task): string {
  return task.created_at.slice(0, 10);
}

export function isTaskDueOn(task: Task, date: string): boolean {
  return taskDueDay(task) === date;
}

export function isTaskPlannedFor(task: Task, date: string): boolean {
  return taskPlannedDay(task) === date;
}

export function isTaskStartingOn(task: Task, date: string): boolean {
  return taskPlannedDay(task) === date;
}

export function hasTaskReachedStartDate(task: Task, date: string): boolean {
  const plannedDay = taskPlannedDay(task);
  return Boolean(plannedDay && plannedDay <= date);
}

export function isTaskScheduledFor(task: Task, date: string): boolean {
  return taskScheduledDay(task) === date;
}

export function isTaskOverdue(task: Task, today: string): boolean {
  const dueDay = taskDueDay(task);
  return Boolean(dueDay && dueDay < today && task.status !== 'done' && task.status !== 'archived');
}

export function taskAgeDays(task: Task, today: string): number {
  const todayMs = new Date(`${today}T12:00:00`).getTime();
  const createdMs = new Date(`${taskCreatedDay(task)}T12:00:00`).getTime();
  return Math.max(0, Math.floor((todayMs - createdMs) / 86_400_000));
}

export function isTaskNeglected(task: Task, today: string): boolean {
  return isTaskOpen(task)
    && !task.is_mit
    && !task.is_top_three
    && !taskDueDay(task)
    && !taskPlannedDay(task)
    && !task.goal_id
    && task.status === 'todo'
    && taskAgeDays(task, today) >= 3;
}

export function getTaskRecurrenceLabel(task: Task): string | null {
  if (task.task_kind === 'recurring_instance') {
    return `INSTANCE ${formatDateDisplay(taskScheduledDay(task))}`.trim();
  }
  switch (task.recurrence_type) {
    case 'daily':
      return 'REPEATS DAILY';
    case 'weekdays':
      return 'REPEATS WEEKDAYS';
    case 'weekly':
      return 'REPEATS WEEKLY';
    case 'monthly':
      return 'REPEATS MONTHLY';
    case 'interval':
      return `EVERY ${Math.max(1, task.recurrence_interval ?? 1)} DAYS`;
    case 'selected_days':
      return 'SELECTED DAYS';
    default:
      return null;
  }
}
