import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTaskStore } from '../store/useTaskStore';
import { useGoalStore } from '../store/useGoalStore';
import { useTimerStore } from '../store/useTimerStore';
import { useTemplateStore } from '../store/useTemplateStore';
import { useFrictionStore } from '../store/useFrictionStore';
import { useDomainStore } from '../store/useDomainStore';
import { TaskForm } from '../components/tasks/TaskForm';
import { Modal } from '../components/shared/Modal';
import { CompletionButton } from '../components/shared/CompletionButton';
import { PageHeader } from '../components/shared/PageHeader';
import { PanelHeader } from '../components/shared/PanelHeader';
import { containsArabic } from '../lib/text-utils';
import type { DomainId, Priority, Task, TaskFrictionReason, TaskStatus } from '../lib/types';
import { getDomainLabel } from '../lib/domain-utils';
import { formatDateDisplay } from '../lib/date-format';
import {
  formatMinutes,
  getTaskRecurrenceLabel,
  hasTaskReachedStartDate,
  isTaskOpen,
  isTaskOverdue,
  isTaskStartingOn,
  isoDate,
  parseStringArray,
  shiftDate,
  taskDueDay,
  taskEstimatedMinutes,
  taskPlannedDay,
  taskScheduledDay,
} from '../lib/task-planning';

type FilterDomain = DomainId | 'all';
type FilterStatus = 'open' | Exclude<TaskStatus, 'done' | 'archived'>;
type FilterPriority = Priority | 'all';
type SortBy = 'priority' | 'due_date' | 'planned' | 'created';

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

const PRIORITY_ORDER: Record<Priority, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function taskSortScore(task: Task, today: string): number {
  let score = 0;
  if (task.is_mit) score += 100;
  if (task.is_top_three) score += 80;
  if (task.status === 'in_progress') score += 70;
  if (isTaskOverdue(task, today)) score += 60;
  if (taskDueDay(task) === today) score += 50;
  if (isTaskStartingOn(task, today)) score += 40;
  else if (hasTaskReachedStartDate(task, today)) score += 30;
  if (taskScheduledDay(task) === today) score += 35;
  score += Math.max(0, 4 - PRIORITY_ORDER[task.priority]) * 4;
  return score;
}

function compareOpenTasks(left: Task, right: Task, sortBy: SortBy, today: string): number {
  if (sortBy === 'priority') {
    const scoreDelta = taskSortScore(right, today) - taskSortScore(left, today);
    if (scoreDelta !== 0) return scoreDelta;
    return PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
  }
  if (sortBy === 'due_date') {
    const leftDue = taskDueDay(left) ?? '9999-12-31';
    const rightDue = taskDueDay(right) ?? '9999-12-31';
    return leftDue.localeCompare(rightDue);
  }
  if (sortBy === 'planned') {
    const leftStart = taskPlannedDay(left) ?? taskScheduledDay(left) ?? '9999-12-31';
    const rightStart = taskPlannedDay(right) ?? taskScheduledDay(right) ?? '9999-12-31';
    return leftStart.localeCompare(rightStart);
  }
  return right.created_at.localeCompare(left.created_at);
}

function compareDoneTasks(left: Task, right: Task): number {
  const leftDone = left.completed_at ?? left.updated_at;
  const rightDone = right.completed_at ?? right.updated_at;
  return rightDone.localeCompare(leftDone);
}

export const TasksPage: React.FC = () => {
  const { tasks, completeTask, undoTaskCompletion, deleteTask, updateTask } = useTaskStore();
  const { goals } = useGoalStore();
  const { startTimer, activeTaskId } = useTimerStore();
  const { createTaskTemplate } = useTemplateStore();
  const { createTaskFrictionLog } = useFrictionStore();
  const domains = useDomainStore((state) => state.domains);
  const [searchParams, setSearchParams] = useSearchParams();

  const [showNewTask, setShowNewTask] = useState(false);
  const [newSubTaskParent, setNewSubTaskParent] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [actionTaskId, setActionTaskId] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [filterDomain, setFilterDomain] = useState<FilterDomain>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('open');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('priority');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [frictionTask, setFrictionTask] = useState<Task | null>(null);
  const [frictionReason, setFrictionReason] = useState<TaskFrictionReason>('blocked');
  const [frictionDetails, setFrictionDetails] = useState('');
  const [customStartDate, setCustomStartDate] = useState('');

  const today = isoDate(new Date());
  const tomorrow = shiftDate(today, 1);
  const nextWeek = shiftDate(today, 7);
  const highlightedTaskId = searchParams.get('task');
  const activeActionTask = useMemo(
    () => (actionTaskId ? tasks.find((task) => task.id === actionTaskId) ?? null : null),
    [actionTaskId, tasks],
  );

  const filteredRootTasks = useMemo(() => tasks
    .filter((task) => !task.parent_task_id)
    .filter((task) => task.status !== 'archived')
    .filter((task) => filterDomain === 'all' || task.domain_id === filterDomain)
    .filter((task) => filterPriority === 'all' || task.priority === filterPriority)
    .filter((task) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return task.title.toLowerCase().includes(query) || task.description?.toLowerCase().includes(query);
    }),
  [tasks, filterDomain, filterPriority, search]);

  const openRootTasks = useMemo(() => filteredRootTasks
    .filter((task) => task.status !== 'done')
    .filter((task) => (filterStatus === 'open' ? true : task.status === filterStatus))
    .sort((left, right) => compareOpenTasks(left, right, sortBy, today)),
  [filteredRootTasks, filterStatus, sortBy, today]);

  const completedRootTasks = useMemo(() => filteredRootTasks
    .filter((task) => task.status === 'done')
    .sort(compareDoneTasks),
  [filteredRootTasks]);

  const openTopThreeCount = useMemo(
    () => tasks.filter((task) => isTaskOpen(task) && task.is_top_three).length,
    [tasks],
  );

  function getSubTasks(parentId: string): { open: Task[]; done: Task[] } {
    const matching = tasks
      .filter((task) => task.parent_task_id === parentId)
      .filter((task) => task.status !== 'archived');
    return {
      open: matching
        .filter((task) => task.status !== 'done')
        .sort((left, right) => compareOpenTasks(left, right, sortBy, today)),
      done: matching
        .filter((task) => task.status === 'done')
        .sort(compareDoneTasks),
    };
  }

  function toggleExpand(id: string): void {
    setExpandedTasks((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleToggleMIT(task: Task): Promise<void> {
    try {
      if (!task.is_mit) {
        const currentMit = tasks.find((item) => item.id !== task.id && isTaskOpen(item) && item.is_mit);
        if (currentMit) {
          await updateTask({ id: currentMit.id, is_mit: false });
        }
      }
      await updateTask({ id: task.id, is_mit: !task.is_mit });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleToggleTopThree(task: Task): Promise<void> {
    if (!task.is_top_three && openTopThreeCount >= 3) return;
    try {
      await updateTask({ id: task.id, is_top_three: !task.is_top_three });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleFocus(task: Task): Promise<void> {
    try {
      if (task.status !== 'in_progress') {
        await updateTask({ id: task.id, status: 'in_progress' });
      }
      await startTimer(task.id, task.time_estimate_minutes ?? 25);
    } catch (error) {
      console.error(error);
    }
  }

  function openTaskActions(task: Task): void {
    setActionTaskId(task.id);
    setCustomStartDate(taskPlannedDay(task) ?? '');
  }

  async function handleSetStartDate(task: Task, startDate: string | null): Promise<void> {
    const startDateValue = startDate ?? '';
    const movesOutOfToday = Boolean(startDateValue && startDateValue > today);
    try {
      await updateTask({
        id: task.id,
        planned_for_date: startDateValue,
        is_mit: movesOutOfToday ? false : task.is_mit,
        is_top_three: movesOutOfToday ? false : task.is_top_three,
        status: movesOutOfToday && task.status === 'in_progress' ? 'todo' : task.status,
      });
      setActionTaskId(null);
      setCustomStartDate('');
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSaveTemplate(task: Task): Promise<void> {
    try {
      await createTaskTemplate({
        title: task.title,
        description: task.description ?? undefined,
        domain_id: task.domain_id,
        priority: task.priority,
        energy_level: task.energy_level,
        is_mit: task.is_mit,
        tags: task.tags,
        time_estimate_minutes: task.time_estimate_minutes ?? undefined,
        recurrence_rule: task.recurrence_rule ?? undefined,
        source_task_id: task.id,
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleSaveFriction(): Promise<void> {
    if (!frictionTask) return;
    try {
      await createTaskFrictionLog({
        task_id: frictionTask.id,
        reason: frictionReason,
        details: frictionDetails.trim() || undefined,
        action_type: 'logged',
      });
      setFrictionTask(null);
      setFrictionDetails('');
    } catch (error) {
      console.error(error);
    }
  }

  React.useEffect(() => {
    const query = searchParams.get('q');
    if (query && query !== search) setSearch(query);
  }, [searchParams, search]);

  const stats = {
    active: tasks.filter((task) => isTaskOpen(task)).length,
    done: tasks.filter((task) => task.status === 'done').length,
    topThree: tasks.filter((task) => isTaskOpen(task) && task.is_top_three).length,
    recurringToday: tasks.filter((task) => isTaskOpen(task) && taskScheduledDay(task) === today).length,
  };

  function renderTaskRow(task: Task, depth = 0): React.ReactNode {
    const subTasks = getSubTasks(task.id);
    const hasSubTasks = subTasks.open.length > 0 || (showCompleted && subTasks.done.length > 0);
    const isExpanded = expandedTasks.has(task.id);
    const isDone = task.status === 'done';
    const isTemplate = task.task_kind === 'recurring_template';
    const goal = task.goal_id ? goals.find((item) => item.id === task.goal_id) : null;
    const tags = parseStringArray(task.tags);
    const isHighlighted = task.id === highlightedTaskId;
    const topThreeLimitReached = !task.is_top_three && openTopThreeCount >= 3;

    return (
      <div key={task.id} data-domain={task.domain_id}>
        <div
          className="task-row"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 12px',
            paddingLeft: 12 + (depth * 26),
            borderBottom: '1px solid var(--color-surface-hover)',
            borderLeft: isHighlighted ? '2px solid var(--color-text)' : undefined,
            opacity: isDone ? 0.55 : 1,
            background: depth > 0 ? 'rgba(124,108,255,0.03)' : undefined,
          }}
        >
          <button
            onClick={() => hasSubTasks && toggleExpand(task.id)}
            style={{
              width: 14,
              height: 14,
              marginTop: 2,
              fontFamily: 'var(--font-sans)',
              fontSize: 14,
              color: 'var(--color-text-muted)',
              background: 'none',
              border: 'none',
              cursor: hasSubTasks ? 'crosshair' : 'default',
              opacity: hasSubTasks ? 1 : 0,
              padding: 0,
            }}
          >
            {isExpanded ? 'v' : '>'}
          </button>
          {isTemplate ? (
            <div style={{ width: 16, height: 16, marginTop: 1, border: '1px solid var(--color-info)' }} />
          ) : (
            <CompletionButton
              done={isDone}
              onComplete={async () => { await completeTask(task.id); }}
              onUndo={isDone ? async () => { await undoTaskCompletion(task.id); } : undefined}
              size={depth > 0 ? 14 : 16}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                dir="auto"
                style={{
                  fontFamily: containsArabic(task.title) ? 'var(--font-arabic)' : 'var(--font-sans)',
                  fontSize: depth > 0 ? 14 : 15,
                  color: isDone ? 'var(--color-text-muted)' : 'var(--color-accent)',
                  textDecoration: isDone ? 'line-through' : 'none',
                }}
              >
                {task.title}
              </span>
              {task.is_mit && <span className="priority-badge-high">MIT</span>}
              {task.is_top_three && <span className="priority-badge-medium">TOP 3</span>}
              {isTemplate && <span style={{ fontSize: 11, color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: 1 }}>TEMPLATE</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
              <span className={`priority-badge-${task.priority}`}>{task.priority}</span>
              <span style={{ fontSize: 11, color: task.energy_level === 'deep' ? 'var(--color-warning)' : task.energy_level === 'light' ? 'var(--color-info)' : 'var(--color-text-muted)', border: '1px solid var(--color-border)', padding: '1px 5px', textTransform: 'uppercase', letterSpacing: 1 }}>{task.energy_level}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{formatMinutes(taskEstimatedMinutes(task))}</span>
              {taskDueDay(task) && <span style={{ fontSize: 11, color: isTaskOverdue(task, today) && !isDone ? 'var(--color-danger)' : 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>DUE {formatDateDisplay(taskDueDay(task))}</span>}
              {taskPlannedDay(task) && (
                <span
                  style={{
                    fontSize: 11,
                    color: isTaskStartingOn(task, today)
                      ? 'var(--color-text)'
                      : hasTaskReachedStartDate(task, today)
                        ? 'var(--color-warning)'
                        : 'var(--color-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  START {formatDateDisplay(taskPlannedDay(task))}
                </span>
              )}
              {taskScheduledDay(task) && <span style={{ fontSize: 11, color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: 1 }}>RUN {formatDateDisplay(taskScheduledDay(task))}</span>}
              {getTaskRecurrenceLabel(task) && <span style={{ fontSize: 11, color: 'var(--color-info)', textTransform: 'uppercase', letterSpacing: 1 }}>{getTaskRecurrenceLabel(task)}</span>}
              {goal && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>GOAL: {goal.title}</span>}
              {tags.slice(0, 2).map((tag) => (
                <span key={tag} style={{ fontSize: 11, color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', padding: '1px 5px' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 340 }}>
            {!isDone && !isTemplate && (
              <button className="btn btn-sm btn-primary" onClick={() => handleFocus(task).catch(console.error)} style={activeTaskId === task.id ? { color: 'var(--color-text)', borderColor: 'var(--color-text)' } : undefined}>
                FOCUS
              </button>
            )}
            <button className="btn btn-sm btn-ghost" onClick={() => openTaskActions(task)}>
              MORE
            </button>
          </div>
        </div>

        {isExpanded && hasSubTasks && (
          <div style={{ background: 'var(--color-bg)' }}>
            {subTasks.open.map((subTask) => renderTaskRow(subTask, depth + 1))}
            {showCompleted && subTasks.done.length > 0 && (
              <div style={{ padding: '6px 12px', paddingLeft: 38 + (depth * 26), fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                Completed Subtasks
              </div>
            )}
            {showCompleted && subTasks.done.map((subTask) => renderTaskRow(subTask, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-content fade-in">
      <PageHeader
        title="TASKS"
        subtitle="ACTIVE WORK, START DATES, AND RECURRING INSTANCES IN ONE BOARD"
        actions={<button className="btn btn-primary" onClick={() => setShowNewTask(true)}>+ NEW TASK</button>}
      />

      <hr className="page-sep" />

      <div className="layout-grid-stats" style={{ marginBottom: 12 }}>
        {[
          { label: 'ACTIVE', value: stats.active },
          { label: 'DONE', value: stats.done },
          { label: 'TOP 3', value: stats.topThree },
          { label: 'RECURRING TODAY', value: stats.recurringToday },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '10px 12px', display: 'grid', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="SEARCH TASKS..."
            value={search}
            onChange={(event) => {
              const value = event.target.value;
              setSearch(value);
              setSearchParams((params) => {
                const next = new URLSearchParams(params);
                if (value.trim()) next.set('q', value);
                else next.delete('q');
                return next;
              });
            }}
          />
          <select className="input" style={{ width: 'auto' }} value={filterDomain} onChange={(event) => setFilterDomain(event.target.value as FilterDomain)}>
            <option value="all">ALL DOMAINS</option>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>
                {getDomainLabel(domain.id, domains).toUpperCase()}
              </option>
            ))}
          </select>
          <select className="input" style={{ width: 'auto' }} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value as FilterStatus)}>
            <option value="open">OPEN WORK</option>
            <option value="todo">TODO</option>
            <option value="in_progress">IN PROGRESS</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAdvancedFilters((value) => !value)}>
            {showAdvancedFilters ? 'HIDE FILTERS' : 'MORE FILTERS'}
          </button>
        </div>

        {showAdvancedFilters && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <select className="input" style={{ width: 'auto' }} value={filterPriority} onChange={(event) => setFilterPriority(event.target.value as FilterPriority)}>
              <option value="all">ALL PRIORITY</option>
              <option value="critical">CRITICAL</option>
              <option value="high">HIGH</option>
              <option value="medium">MEDIUM</option>
              <option value="low">LOW</option>
            </select>
            <select className="input" style={{ width: 'auto' }} value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
              <option value="priority">SORT: PRIORITY</option>
              <option value="due_date">SORT: DUE</option>
              <option value="planned">SORT: START DATE</option>
              <option value="created">SORT: NEWEST</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px', fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />
              Show Done ({completedRootTasks.length})
            </label>
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          Keep the list sorted by what deserves attention. MIT and Top 3 are better set in Today unless you are intentionally reshaping the day here.
        </div>
      </div>

      <div className="card">
        {openRootTasks.length === 0 && (!showCompleted || completedRootTasks.length === 0) ? (
          <div className="empty-state">
            <div className="empty-state-title">NO ENTRIES FOUND</div>
            <div>Create a task or adjust the filters.</div>
          </div>
        ) : (
          <div className="stagger-in">
            {openRootTasks.map((task) => renderTaskRow(task))}
            {showCompleted && completedRootTasks.length > 0 && (
              <div>
                <div style={{ padding: '10px 12px 6px', fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Completed Tasks
                </div>
                <div className="stagger-in">
                  {completedRootTasks.map((task) => renderTaskRow(task))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={showNewTask} onClose={() => { setShowNewTask(false); setNewSubTaskParent(null); }} title={newSubTaskParent ? 'New Sub-Task' : 'New Task'}>
        <TaskForm onClose={() => { setShowNewTask(false); setNewSubTaskParent(null); }} parentTaskId={newSubTaskParent ?? undefined} defaultDomain={filterDomain !== 'all' ? filterDomain : undefined} />
      </Modal>

      <Modal open={Boolean(editingTask)} onClose={() => setEditingTask(null)} title={editingTask?.parent_task_id ? 'Edit Sub-Task' : 'Edit Task'}>
        {editingTask && <TaskForm initialTask={editingTask} onClose={() => setEditingTask(null)} />}
      </Modal>

      <Modal open={Boolean(activeActionTask)} onClose={() => { setActionTaskId(null); setCustomStartDate(''); }} title="Task Actions">
        {activeActionTask && (
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {activeActionTask.title}
            </div>

            {!activeActionTask.task_kind.includes('template') && activeActionTask.status !== 'done' && (
              <div className="card">
                <PanelHeader title="DAILY COMMITMENT" />
                <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    MIT is the one task that makes the day real. Top 3 is the short list for Today. Set them here only when you mean to reshape the day.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleToggleMIT(activeActionTask).catch(console.error)}>
                      {activeActionTask.is_mit ? 'CLEAR MIT' : 'MAKE MIT'}
                    </button>
                    <button className="btn btn-ghost btn-sm" disabled={!activeActionTask.is_top_three && openTopThreeCount >= 3} onClick={() => handleToggleTopThree(activeActionTask).catch(console.error)}>
                      {activeActionTask.is_top_three ? 'REMOVE TOP 3' : 'ADD TOP 3'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!activeActionTask.task_kind.includes('template') && activeActionTask.status !== 'done' && (
              <div className="card">
                <PanelHeader title="START DATE" />
                <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    A start date makes the task appear in Today from that date onward until you finish it.
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleSetStartDate(activeActionTask, today).catch(console.error)}>START TODAY</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleSetStartDate(activeActionTask, tomorrow).catch(console.error)}>START TOMORROW</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleSetStartDate(activeActionTask, nextWeek).catch(console.error)}>START NEXT WEEK</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleSetStartDate(activeActionTask, null).catch(console.error)}>CLEAR START DATE</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" type="date" lang="en-GB" value={customStartDate} onChange={(event) => setCustomStartDate(event.target.value)} />
                    <button className="btn btn-primary" disabled={!customStartDate} onClick={() => handleSetStartDate(activeActionTask, customStartDate).catch(console.error)}>
                      APPLY
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <PanelHeader title="MANAGE TASK" />
              <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {activeActionTask.status !== 'done' && activeActionTask.task_kind !== 'recurring_template' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => handleFocus(activeActionTask).catch(console.error)}>FOCUS</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => { setActionTaskId(null); setEditingTask(activeActionTask); }}>EDIT</button>
                {activeActionTask.status !== 'done' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setActionTaskId(null); setNewSubTaskParent(activeActionTask.id); setShowNewTask(true); }}>+ SUBTASK</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={async () => { await handleSaveTemplate(activeActionTask); setActionTaskId(null); }}>SAVE TEMPLATE</button>
                {activeActionTask.status !== 'done' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => { setActionTaskId(null); setFrictionTask(activeActionTask); setFrictionDetails(''); }}>
                    LOG FRICTION
                  </button>
                )}
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    if (!window.confirm(`DELETE "${activeActionTask.title}"?\n\nThis removes the task immediately.`)) return;
                    await deleteTask(activeActionTask.id);
                    setActionTaskId(null);
                  }}
                >
                  DELETE
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={Boolean(frictionTask)} onClose={() => setFrictionTask(null)} title="Log Task Friction">
        {frictionTask && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{frictionTask.title}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TASK_FRICTION_OPTIONS.map((option) => (
                <button key={option.value} className="btn btn-ghost btn-sm" style={frictionReason === option.value ? { color: 'var(--color-warning)', borderColor: 'var(--color-warning)' } : undefined} onClick={() => setFrictionReason(option.value)}>
                  {option.label}
                </button>
              ))}
            </div>
            <textarea className="input" rows={3} value={frictionDetails} onChange={(event) => setFrictionDetails(event.target.value)} placeholder="What got in the way?" style={{ resize: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setFrictionTask(null)}>CANCEL</button>
              <button className="btn btn-primary" onClick={() => handleSaveFriction().catch(console.error)}>SAVE</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
