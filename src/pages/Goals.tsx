import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { useGoalStore } from '../store/useGoalStore';
import { useTaskStore } from '../store/useTaskStore';
import { useNoteStore } from '../store/useNoteStore';
import { useDomainStore } from '../store/useDomainStore';
import type { CreateGoalPayload, DomainId, Goal, GoalHealth, UpdateGoalPayload } from '../lib/types';
import { Modal } from '../components/shared/Modal';
import { getDefaultDomainId, getDomainLabel, getDomainThemeStyle } from '../lib/domain-utils';
import { formatDateDisplay } from '../lib/date-format';

interface GoalFormProps {
  onClose: () => void;
  parentGoalId?: string;
  defaultDomain?: DomainId;
  initialGoal?: Goal;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function healthColors(health: GoalHealth): { text: string; border: string; background: string } {
  if (health === 'stalled') {
    return { text: 'var(--color-danger)', border: 'var(--color-danger)', background: 'rgba(255,64,64,0.08)' };
  }
  if (health === 'at_risk') {
    return { text: 'var(--color-warning)', border: 'var(--color-warning)', background: 'rgba(200,160,32,0.08)' };
  }
  return { text: 'var(--color-text)', border: 'var(--color-text)', background: 'rgba(124,108,255,0.08)' };
}

function effectiveGoalHealth(goal: Goal): GoalHealth {
  if (goal.status === 'completed') return 'on_track';
  if (goal.health === 'stalled' || goal.blocked_by) return 'stalled';
  const today = todayIso();
  if (!goal.next_action) return 'at_risk';
  if (goal.review_date && goal.review_date.slice(0, 10) < today) return 'at_risk';
  if (goal.target_date && goal.target_date.slice(0, 10) < today && goal.progress_percent < 100) return 'at_risk';
  return goal.health ?? 'on_track';
}

function goalWarnings(goal: Goal): string[] {
  if (goal.status !== 'active') return [];
  const warnings: string[] = [];
  const today = todayIso();
  if (!goal.next_action) warnings.push('NO NEXT ACTION');
  if (goal.review_date && goal.review_date.slice(0, 10) < today) warnings.push('REVIEW OVERDUE');
  if (goal.target_date && goal.target_date.slice(0, 10) < today && goal.progress_percent < 100) warnings.push('TARGET DATE PASSED');
  if (goal.blocked_by) warnings.push('BLOCKED');
  return warnings;
}

const GoalForm: React.FC<GoalFormProps> = ({ onClose, parentGoalId, defaultDomain, initialGoal }) => {
  const { createGoal, updateGoal } = useGoalStore();
  const domains = useDomainStore((state) => state.domains);
  const isEditing = Boolean(initialGoal);
  const [domain, setDomain] = useState<DomainId>(initialGoal?.domain_id ?? defaultDomain ?? getDefaultDomainId(domains));
  const [title, setTitle] = useState(initialGoal?.title ?? '');
  const [description, setDescription] = useState(initialGoal?.description ?? '');
  const [nextAction, setNextAction] = useState(initialGoal?.next_action ?? '');
  const [reviewDate, setReviewDate] = useState(initialGoal?.review_date?.slice(0, 10) ?? '');
  const [blockedBy, setBlockedBy] = useState(initialGoal?.blocked_by ?? '');
  const [health, setHealth] = useState<GoalHealth>(initialGoal?.health ?? 'on_track');
  const [targetDate, setTargetDate] = useState(initialGoal?.target_date?.slice(0, 10) ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    try {
      if (isEditing && initialGoal) {
        const payload: UpdateGoalPayload = {
          id: initialGoal.id,
          title: title.trim(),
          description: description.trim(),
          next_action: nextAction.trim(),
          review_date: reviewDate,
          blocked_by: blockedBy.trim(),
          health,
          target_date: targetDate,
        };
        await updateGoal(payload);
      } else {
        const payload: CreateGoalPayload = {
          domain_id: domain,
          title: title.trim(),
          description: normalizeText(description),
          parent_goal_id: parentGoalId,
          next_action: normalizeText(nextAction),
          review_date: reviewDate || undefined,
          blocked_by: normalizeText(blockedBy),
          health,
          target_date: targetDate || undefined,
        };
        await createGoal(payload);
      }

      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {!parentGoalId && !isEditing && (
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
            Domain
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
            {domains.map((entry) => (
              <button
                key={entry.id}
                type="button"
                data-domain={entry.id}
                onClick={() => setDomain(entry.id)}
                className={clsx('btn', domain === entry.id ? 'btn-primary' : 'btn-ghost')}
                style={{ ...getDomainThemeStyle(entry), padding: 'var(--space-1) var(--space-2)', fontSize: 12 }}
              >
                {getDomainLabel(entry.id, domains).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Goal Title *
        </label>
        <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="WHAT ARE YOU DRIVING TOWARD?" autoFocus required />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Why It Matters
        </label>
        <textarea className="input" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} style={{ resize: 'none' }} placeholder="WHY DOES THIS GOAL MATTER?" />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Next Action
        </label>
        <input className="input" value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="WHAT IS THE VERY NEXT CONCRETE MOVE?" />
      </div>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
            Review Date
          </label>
          <input className="input" type="date" lang="en-GB" value={reviewDate} onChange={(event) => setReviewDate(event.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
            Target Date
          </label>
          <input className="input" type="date" lang="en-GB" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Blocked / Stalled Reason
        </label>
        <textarea className="input" value={blockedBy} onChange={(event) => setBlockedBy(event.target.value)} rows={2} style={{ resize: 'none' }} placeholder="WHAT IS SLOWING THIS GOAL DOWN?" />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Health
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
          {(['on_track', 'at_risk', 'stalled'] as GoalHealth[]).map((value) => (
            <button
              key={value}
              type="button"
              className={clsx('btn', health === value ? 'btn-primary' : 'btn-ghost')}
              onClick={() => setHealth(value)}
              style={{ padding: 'var(--space-1) var(--space-2)', fontSize: 12 }}
            >
              {value.replace('_', ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>CANCEL</button>
        <button type="submit" className="btn btn-primary" disabled={!title.trim() || saving}>
          {saving ? (isEditing ? 'SAVING...' : 'CREATING...') : (isEditing ? 'SAVE GOAL' : 'CREATE GOAL')}
        </button>
      </div>
    </form>
  );
};

interface GoalNodeProps {
  goal: Goal;
  depth: number;
  highlightedGoalId: string | null;
}

const GoalNode: React.FC<GoalNodeProps> = ({ goal, depth, highlightedGoalId }) => {
  const { subGoals, updateGoal, deleteGoal } = useGoalStore();
  const { tasks, createTask } = useTaskStore();
  const { notes } = useNoteStore();
  const [expanded, setExpanded] = useState(true);
  const [showAddSub, setShowAddSub] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);

  const children = subGoals(goal.id);
  const linkedTasks = tasks.filter((task) => task.goal_id === goal.id && task.status !== 'archived');
  const linkedNotes = notes.filter((note) => note.goal_id === goal.id);
  const openLinkedTasks = linkedTasks.filter((task) => task.status !== 'done');
  const doneTasks = linkedTasks.filter((task) => task.status === 'done').length;
  const computedProgress = linkedTasks.length > 0
    ? Math.round((doneTasks / linkedTasks.length) * 100)
    : goal.progress_percent;
  const derivedHealth = effectiveGoalHealth(goal);
  const healthTone = healthColors(derivedHealth);
  const warnings = goalWarnings(goal);
  const isDone = goal.status === 'completed';
  const nextActionAlreadyExists = !!goal.next_action && openLinkedTasks.some(
    (task) => task.title.trim().toLowerCase() === goal.next_action?.trim().toLowerCase()
  );

  async function handleComplete() {
    try {
      await updateGoal({
        id: goal.id,
        status: isDone ? 'active' : 'completed',
        progress_percent: isDone ? 0 : 100,
        health: isDone ? 'on_track' : goal.health,
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDelete() {
    try {
      await deleteGoal(goal.id);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCreateNextActionTask() {
    if (!goal.next_action?.trim()) return;

    try {
      await createTask({
        domain_id: goal.domain_id,
        title: goal.next_action.trim(),
        description: goal.description ?? undefined,
        priority: derivedHealth === 'stalled' ? 'critical' : 'high',
        is_mit: false,
        goal_id: goal.id,
        time_estimate_minutes: 45,
        due_date: goal.review_date || goal.target_date || undefined,
        tags: JSON.stringify(['goal-next-action']),
      });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div style={depth > 0 ? { marginLeft: 'var(--space-6)', borderLeft: '1px solid var(--color-border)' } : undefined}>
      <div
        data-domain={goal.domain_id}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--space-2)',
          padding: 'var(--space-3) var(--space-3) var(--space-3)',
          marginLeft: depth > 0 ? 8 : 0,
          borderLeft: goal.id === highlightedGoalId ? '2px solid var(--color-text)' : undefined,
          borderBottom: '1px solid var(--color-surface-hover)',
        }}
      >
        <button
          onClick={() => children.length > 0 && setExpanded(!expanded)}
          style={{
            flexShrink: 0,
            marginTop: 2,
            fontFamily: 'var(--font-sans)',
            fontSize: 12,
            color: 'var(--color-text-muted)',
            background: 'none',
            border: 'none',
            cursor: children.length > 0 ? 'crosshair' : 'default',
            opacity: children.length > 0 ? 1 : 0,
            padding: 0,
            lineHeight: 1,
          }}
        >
          {expanded ? '▼' : '▶'}
        </button>

        <button
          onClick={handleComplete}
          style={{
            flexShrink: 0,
            marginTop: 2,
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            color: isDone ? 'var(--color-accent)' : 'var(--domain-primary, var(--color-text-muted))',
            background: 'none',
            border: 'none',
            cursor: 'crosshair',
            padding: 0,
            lineHeight: 1,
          }}
        >
          {isDone ? '◆' : '◇'}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, color: isDone ? 'var(--color-text-muted)' : 'var(--color-accent)', textDecoration: isDone ? 'line-through' : 'none' }}>
              {goal.title}
            </span>
            <span style={{ ...healthTone, borderWidth: 1, borderStyle: 'solid', padding: '1px var(--space-1)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>
              {derivedHealth.replace('_', ' ')}
            </span>
            {warnings.map((warning) => (
              <span key={`${goal.id}-${warning}`} style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)', background: 'rgba(200,160,32,0.08)', padding: '1px var(--space-1)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>
                {warning}
              </span>
            ))}
          </div>

          {goal.description && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              {goal.description}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <span className="card-title">NEXT ACTION</span>
              </div>
              <div className="card-body" style={{ paddingTop: 'var(--space-2)' }}>
                <div style={{ fontSize: 13, color: goal.next_action ? 'var(--color-text)' : 'var(--color-danger)' }}>
                  {goal.next_action || 'NO NEXT ACTION DEFINED'}
                </div>
                {goal.blocked_by && (
                  <div style={{ fontSize: 11, color: 'var(--color-warning)', marginTop: 'var(--space-2)' }}>
                    BLOCKED BY: {goal.blocked_by}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingGoal(true)}>
                    EDIT GOAL
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleCreateNextActionTask}
                    disabled={!goal.next_action || nextActionAlreadyExists}
                  >
                    {nextActionAlreadyExists ? 'TASK EXISTS' : 'MAKE TASK'}
                  </button>
                </div>
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <span className="card-title">REVIEW</span>
              </div>
              <div className="card-body" style={{ paddingTop: 'var(--space-2)' }}>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  REVIEW DATE: {goal.review_date ? formatDateDisplay(goal.review_date) : 'NOT SET'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                  TARGET DATE: {goal.target_date ? formatDateDisplay(goal.target_date) : 'OPEN'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <div style={{ flex: 1, maxWidth: 140, height: 4, background: 'var(--color-surface-hover)' }}>
                    <div style={{ height: '100%', width: `${computedProgress}%`, background: isDone ? 'var(--color-accent)' : 'var(--domain-primary, var(--color-accent))' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{computedProgress}%</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <span className="card-title">LINKED TASKS</span>
                <span className="card-meta">{linkedTasks.length}</span>
              </div>
              <div className="card-body" style={{ paddingTop: 'var(--space-2)' }}>
                {linkedTasks.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>NO TASKS LINKED TO THIS GOAL YET.</div>
                ) : (
                  linkedTasks.slice(0, 4).map((task) => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                      <span style={{ fontSize: 12, color: task.status === 'done' ? 'var(--color-text-muted)' : 'var(--color-accent)' }}>
                        {task.title}
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <span className="card-title">LINKED NOTES</span>
                <span className="card-meta">{linkedNotes.length}</span>
              </div>
              <div className="card-body" style={{ paddingTop: 'var(--space-2)' }}>
                {linkedNotes.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>NO NOTES LINKED TO THIS GOAL YET.</div>
                ) : (
                  linkedNotes.slice(0, 4).map((note) => (
                    <div key={note.id} style={{ marginBottom: 'var(--space-2)' }}>
                      <div style={{ fontSize: 12, color: 'var(--color-accent)' }}>{note.title}</div>
                      <div style={{ fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
                        {formatDateDisplay(note.updated_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 'var(--space-1)', flexShrink: 0 }}>
          {depth < 2 && (
            <button className="btn btn-sm btn-ghost" title="Add sub-goal" style={{ padding: '2px var(--space-2)', minHeight: 'auto' }} onClick={() => setShowAddSub(true)}>
              +
            </button>
          )}
          {goal.status === 'active' && (
            <button
              onClick={async () => {
                if (window.confirm(`ABANDON "${goal.title}"?\n\nThis logs the decision and archives the goal.`)) {
                  try {
                    await updateGoal({ id: goal.id, status: 'archived' });
                  } catch (error) {
                    console.error(error);
                  }
                }
              }}
              className="btn btn-sm btn-ghost"
              title="Abandon goal"
              style={{ padding: '2px var(--space-2)', minHeight: 'auto', color: 'var(--color-warning)', fontSize: 9 }}
            >
              ABANDON
            </button>
          )}
          <button className="btn btn-sm btn-danger" title="Delete goal" style={{ padding: '2px var(--space-2)', minHeight: 'auto' }} onClick={handleDelete}>
            ✕
          </button>
        </div>
      </div>

      {expanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <GoalNode key={child.id} goal={child} depth={depth + 1} highlightedGoalId={highlightedGoalId} />
          ))}
        </div>
      )}

      <Modal open={showAddSub} onClose={() => setShowAddSub(false)} title="New Sub-Goal">
        <GoalForm onClose={() => setShowAddSub(false)} parentGoalId={goal.id} defaultDomain={goal.domain_id as DomainId} />
      </Modal>

      <Modal open={editingGoal} onClose={() => setEditingGoal(false)} title="Edit Goal">
        <GoalForm onClose={() => setEditingGoal(false)} initialGoal={goal} />
      </Modal>
    </div>
  );
};

export const GoalsPage: React.FC = () => {
  const { goals, rootGoals } = useGoalStore();
  const domains = useDomainStore((state) => state.domains);
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [filterDomain, setFilterDomain] = useState<DomainId | 'all'>('all');
  const [searchParams] = useSearchParams();
  const highlightedGoalId = searchParams.get('goal');

  const filteredGoals = useMemo(
    () => goals.filter((goal) => filterDomain === 'all' || goal.domain_id === filterDomain),
    [filterDomain, goals]
  );
  const roots = rootGoals().filter((goal) => filterDomain === 'all' || goal.domain_id === filterDomain);
  const activeCount = filteredGoals.filter((goal) => goal.status === 'active').length;
  const doneCount = filteredGoals.filter((goal) => goal.status === 'completed').length;
  const missingNextActionCount = filteredGoals.filter((goal) => goal.status === 'active' && !goal.next_action).length;
  const stalledCount = filteredGoals.filter((goal) => effectiveGoalHealth(goal) === 'stalled' && goal.status === 'active').length;

  return (
    <div className="page-content fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">GOALS</div>
          <div className="page-subtitle">OBJECTIVES THAT CREATE ACTION, REVIEW, AND FOLLOW-THROUGH</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewGoal(true)}>
          + NEW GOAL
        </button>
      </div>

      <hr className="page-sep" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
        {[
          { label: 'ACTIVE', value: activeCount },
          { label: 'COMPLETED', value: doneCount },
          { label: 'NO NEXT ACTION', value: missingNextActionCount },
          { label: 'STALLED', value: stalledCount },
        ].map((item) => (
          <div key={item.label} className="stat-card">
            <div className="stat-value">{item.value}</div>
            <div className="stat-label">{item.label}</div>
          </div>
        ))}
      </div>

      {missingNextActionCount > 0 && (
        <div style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--color-warning)', background: 'rgba(200,160,32,0.06)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-warning)', letterSpacing: 1, textTransform: 'uppercase' }}>
            {missingNextActionCount} active goal{missingNextActionCount !== 1 ? 's have' : ' has'} no next action. Those goals are at risk of becoming passive.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <button onClick={() => setFilterDomain('all')} className={clsx('btn btn-sm', filterDomain === 'all' ? 'btn-primary' : 'btn-ghost')}>
          ALL
        </button>
        {domains.map((domain) => (
          <button
            key={domain.id}
            data-domain={domain.id}
            onClick={() => setFilterDomain(domain.id)}
            className={clsx('btn btn-sm', filterDomain === domain.id ? 'btn-primary' : 'btn-ghost')}
            style={getDomainThemeStyle(domain)}
          >
            {getDomainLabel(domain.id, domains).toUpperCase()}
          </button>
        ))}
      </div>

      {roots.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">NO GOALS FOUND</div>
            <div>SET YOUR FIRST OBJECTIVE AND DEFINE ITS NEXT MOVE<span className="boot-cursor" /></div>
          </div>
        </div>
      ) : (
        <div className="card">
          {roots.map((goal) => (
            <GoalNode key={goal.id} goal={goal} depth={0} highlightedGoalId={highlightedGoalId} />
          ))}
        </div>
      )}

      <Modal open={showNewGoal} onClose={() => setShowNewGoal(false)} title="New Goal">
        <GoalForm onClose={() => setShowNewGoal(false)} defaultDomain={filterDomain !== 'all' ? filterDomain : undefined} />
      </Modal>
    </div>
  );
};
