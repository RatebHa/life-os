import React, { useState } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { useGoalStore } from '../../store/useGoalStore';
import { useDomainStore } from '../../store/useDomainStore';
import { containsArabic } from '../../lib/text-utils';
import type { DomainId, EnergyLevel, Priority, RecurrenceType, Task, TaskKind } from '../../lib/types';
import { clsx } from 'clsx';
import { getDefaultDomainId, getDomainLabel, getDomainThemeStyle } from '../../lib/domain-utils';

interface TaskFormProps {
  onClose: () => void;
  defaultDomain?: DomainId;
  parentTaskId?: string;
  initialTask?: Task;
}

function defaultRecurrenceType(task?: Task): RecurrenceType | 'none' {
  if (task?.recurrence_type) return task.recurrence_type;
  if (task?.recurrence_rule === 'daily') return 'daily';
  if (task?.recurrence_rule === 'weekly') return 'weekly';
  if (task?.recurrence_rule === 'monthly') return 'monthly';
  return 'none';
}

export const TaskForm: React.FC<TaskFormProps> = ({ onClose, defaultDomain, parentTaskId, initialTask }) => {
  const { createTask, updateTask } = useTaskStore();
  const { goals } = useGoalStore();
  const domains = useDomainStore((state) => state.domains);

  const isEditing = Boolean(initialTask);
  const isRecurringInstance = initialTask?.task_kind === 'recurring_instance';
  const [domain, setDomain] = useState<DomainId>(initialTask?.domain_id ?? defaultDomain ?? getDefaultDomainId(domains));
  const [title, setTitle] = useState(initialTask?.title ?? '');
  const [description, setDescription] = useState(initialTask?.description ?? '');
  const [priority, setPriority] = useState<Priority>(initialTask?.priority ?? 'medium');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(initialTask?.energy_level ?? 'medium');
  const [isMit, setIsMit] = useState(initialTask?.is_mit ?? false);
  const [isTopThree, setIsTopThree] = useState(initialTask?.is_top_three ?? false);
  const [timeEst, setTimeEst] = useState(initialTask?.time_estimate_minutes?.toString() ?? '');
  const [dueDate, setDueDate] = useState(initialTask?.due_date?.slice(0, 10) ?? '');
  const [plannedForDate, setPlannedForDate] = useState(initialTask?.planned_for_date?.slice(0, 10) ?? '');
  const [goalId, setGoalId] = useState(initialTask?.goal_id ?? '');
  const [tags, setTags] = useState(() => {
    try {
      return JSON.parse(initialTask?.tags ?? '[]').join(', ');
    } catch {
      return '';
    }
  });
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType | 'none'>(defaultRecurrenceType(initialTask));
  const [recurrenceInterval, setRecurrenceInterval] = useState(String(initialTask?.recurrence_interval ?? 2));
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(Boolean(
    initialTask?.goal_id
    || (initialTask?.tags && initialTask.tags !== '[]')
    || defaultRecurrenceType(initialTask) !== 'none'
    || initialTask?.is_mit
    || initialTask?.is_top_three,
  ));

  const domainGoals = goals.filter((goal) => goal.domain_id === domain && goal.status === 'active');
  const titleArabic = containsArabic(title);
  const descriptionArabic = containsArabic(description);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const tagsJson = tags.trim()
      ? JSON.stringify(tags.split(',').map((tag: string) => tag.trim()).filter(Boolean))
      : '[]';
    const hasRecurrence = recurrenceType !== 'none' && !isRecurringInstance;
    const recurrenceAnchorDate = dueDate || plannedForDate || new Date().toISOString().slice(0, 10);
    const taskKind: TaskKind = hasRecurrence ? 'recurring_template' : (initialTask?.task_kind ?? 'standard');

    try {
      if (isEditing && initialTask) {
        await updateTask({
          id: initialTask.id,
          domain_id: domain,
          title: title.trim(),
          description: description.trim(),
          priority,
          energy_level: energyLevel,
          is_mit: isMit,
          is_top_three: isTopThree,
          goal_id: goalId || '',
          tags: tagsJson,
          time_estimate_minutes: timeEst ? parseInt(timeEst, 10) : undefined,
          due_date: dueDate || '',
          planned_for_date: plannedForDate || '',
          task_kind: taskKind,
          recurrence_type: hasRecurrence ? recurrenceType : '',
          recurrence_interval: hasRecurrence && recurrenceType === 'interval' ? Math.max(1, parseInt(recurrenceInterval, 10) || 1) : undefined,
          recurrence_days: '[]',
          recurrence_anchor_date: hasRecurrence ? recurrenceAnchorDate : '',
          recurrence_rule: hasRecurrence ? recurrenceType : '',
        });
      } else {
        await createTask({
          domain_id: domain,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          energy_level: energyLevel,
          is_mit: isMit,
          is_top_three: isTopThree,
          parent_task_id: parentTaskId,
          goal_id: goalId || undefined,
          tags: tagsJson,
          time_estimate_minutes: timeEst ? parseInt(timeEst, 10) : undefined,
          due_date: dueDate || undefined,
          planned_for_date: plannedForDate || undefined,
          task_kind: taskKind,
          recurrence_type: hasRecurrence ? recurrenceType : undefined,
          recurrence_interval: hasRecurrence && recurrenceType === 'interval' ? Math.max(1, parseInt(recurrenceInterval, 10) || 1) : undefined,
          recurrence_days: hasRecurrence ? '[]' : undefined,
          recurrence_anchor_date: hasRecurrence ? recurrenceAnchorDate : undefined,
          recurrence_rule: hasRecurrence ? recurrenceType : undefined,
        });
      }
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEditing && (
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Domain</label>
          <div className="grid grid-cols-3 gap-2">
            {domains.map((entry) => (
              <button
                key={entry.id}
                type="button"
                data-domain={entry.id}
                onClick={() => setDomain(entry.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 border text-sm font-semibold transition-all',
                  domain === entry.id
                    ? 'border-[var(--domain-primary)] bg-[var(--domain-bg)] text-[var(--text-primary)]'
                    : 'border-[var(--border-base)] text-[var(--text-muted)] hover:border-[var(--border-bright)]',
                )}
                style={{ ...getDomainThemeStyle(entry), clipPath: 'polygon(6px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 6px)' }}
              >
                <span>{entry.icon}</span>
                {getDomainLabel(entry.id, domains)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Title *</label>
        <input
          className="input"
          dir="auto"
          placeholder="What needs to move forward?"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          autoFocus
          required
          style={{ fontFamily: titleArabic ? 'var(--font-arabic)' : 'var(--font-body)' }}
        />
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Description</label>
        <textarea
          className="input min-h-[88px] resize-none"
          dir="auto"
          placeholder="Why does this matter, or what is the next step?"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          style={{ fontFamily: descriptionArabic ? 'var(--font-arabic)' : 'var(--font-body)' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Priority</label>
          <select className="input" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Energy</label>
          <select className="input" value={energyLevel} onChange={(event) => setEnergyLevel(event.target.value as EnergyLevel)}>
            <option value="deep">Deep</option>
            <option value="medium">Medium</option>
            <option value="light">Light</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Time Estimate (min)</label>
        <input className="input" type="number" min={0} placeholder="e.g. 45" value={timeEst} onChange={(event) => setTimeEst(event.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Due Date</label>
          <input className="input" type="date" lang="en-GB" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Start Date</label>
          <input className="input" type="date" lang="en-GB" value={plannedForDate} onChange={(event) => setPlannedForDate(event.target.value)} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--pip-muted)' }}>
        Start date means the task will begin showing up in Today on that date and stay active there until it is done.
      </div>

      <div className="border border-[var(--border-base)] bg-[var(--bg-base)] p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Advanced Planning</div>
            <div className="text-[12px] text-[var(--text-muted)]">Goal links, repeat rules, and day-shaping flags live here.</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? 'HIDE' : 'SHOW'}
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Goal Link</label>
              <select className="input" value={goalId} onChange={(event) => setGoalId(event.target.value)}>
                <option value="">No goal</option>
                {domainGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.title}</option>
                ))}
              </select>
            </div>

            {!isRecurringInstance && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Recurrence</label>
                  <select className="input" value={recurrenceType} onChange={(event) => setRecurrenceType(event.target.value as RecurrenceType | 'none')}>
                    <option value="none">No repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekdays">Weekdays</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="interval">Every N days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Tags</label>
                  <input className="input" dir="auto" placeholder="planning, admin" value={tags} onChange={(event) => setTags(event.target.value)} />
                </div>
              </div>
            )}

            {recurrenceType === 'interval' && !isRecurringInstance && (
              <div>
                <label className="block text-xs text-[var(--color-text-muted)] mb-1.5 tracking-wide uppercase">Repeat Every N Days</label>
                <input className="input" type="number" min={1} value={recurrenceInterval} onChange={(event) => setRecurrenceInterval(event.target.value)} />
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--pip-muted)' }}>
              MIT and Top 3 usually belong to Today. Set them here only if this task should already land in the daily plan.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsMit((value) => !value)}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 border text-sm font-semibold tracking-wider transition-all w-full',
                  isMit
                    ? 'border-yellow-500 bg-[rgba(234,179,8,0.08)] text-yellow-400'
                    : 'border-[var(--border-base)] text-[var(--text-muted)] hover:border-[var(--border-bright)]',
                )}
                style={{ clipPath: 'polygon(6px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 6px)' }}
              >
                <span>{isMit ? '*' : 'o'}</span>
                <span>Most Important Task</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTopThree((value) => !value)}
                className={clsx(
                  'flex items-center gap-2.5 px-3 py-2 border text-sm font-semibold tracking-wider transition-all w-full',
                  isTopThree
                    ? 'border-[var(--pip)] bg-[rgba(74,250,74,0.08)] text-[var(--pip-bright)]'
                    : 'border-[var(--border-base)] text-[var(--text-muted)] hover:border-[var(--border-bright)]',
                )}
                style={{ clipPath: 'polygon(6px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 6px)' }}
              >
                <span>{isTopThree ? '[x]' : '[ ]'}</span>
                <span>Top 3</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-dim)]">
        <div className="text-[12px] text-[var(--text-muted)]">
          {recurrenceType !== 'none' && !isRecurringInstance ? 'This will save as a recurring template and generate dated instances automatically.' : 'This task will appear wherever its due date, start date, or status makes it relevant.'}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim() || saving}>
            {saving ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save Changes' : 'Create Task')}
          </button>
        </div>
      </div>
    </form>
  );
};
