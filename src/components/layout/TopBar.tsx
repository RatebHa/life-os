import React, { useEffect, useMemo, useState } from 'react';
import { useDomainStore } from '../../store/useDomainStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useTimerStore } from '../../store/useTimerStore';
import { QuickAddTask } from '../tasks/QuickAddTask';
import { formatDateWithWeekday } from '../../lib/date-format';

export const TopBar: React.FC = () => {
  const domains = useDomainStore((state) => state.domains);
  const tasks = useTaskStore((state) => state.tasks);
  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const activeDraft = useTimerStore((state) => (state.activeTaskId ? state.drafts[state.activeTaskId] ?? null : null));
  const tickKey = useTimerStore((state) => state.tickKey);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const dateStr = formatDateWithWeekday(new Date(), 'short');
  const today = new Date().toISOString().slice(0, 10);
  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'done' && task.status !== 'archived' && task.task_kind !== 'recurring_template'),
    [tasks],
  );
  const mitTask = openTasks.find((task) => task.is_mit);
  const topThreeCount = openTasks.filter((task) => task.is_top_three).length;
  const overdueCount = openTasks.filter((task) => task.due_date && task.due_date.slice(0, 10) < today).length;
  const focusTask = activeTaskId ? tasks.find((task) => task.id === activeTaskId) ?? null : null;
  const elapsedMinutes = useMemo(() => {
    if (!activeDraft) return 0;
    const runningSeconds = activeDraft.is_running && activeDraft.last_started_at
      ? Math.max(0, Math.floor((Date.now() - new Date(activeDraft.last_started_at).getTime()) / 1000))
      : 0;
    return Math.max(0, Math.floor((activeDraft.elapsed_seconds + runningSeconds) / 60));
  }, [activeDraft, tickKey]);

  return (
    <>
      <header className="app-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                style={{
                  width: 4,
                  height: 12 + index * 4,
                  background: 'var(--color-accent)',
                  opacity: 0.35 + index * 0.2,
                  boxShadow: 'var(--shadow-focus-ring)',
                  display: 'inline-block',
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 28,
              color: 'var(--color-text)',
              letterSpacing: 3,
              lineHeight: 1,
            }}
          >
            LIFE OS
          </span>
        </div>

        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--color-border), transparent)', opacity: 0.65 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
            padding: 'var(--space-1) var(--space-3)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-hover)',
          }}
        >
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: mitTask ? 'var(--color-text)' : 'var(--color-warning)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            MIT: {mitTask ? 'SET' : 'MISSING'}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: topThreeCount > 0 ? 'var(--color-text)' : 'var(--color-text-muted)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            TOP 3: {topThreeCount}/3
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: overdueCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            OVERDUE: {overdueCount}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 10,
              color: focusTask ? 'var(--color-text)' : 'var(--color-text-muted)',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              maxWidth: 280,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {focusTask ? `FOCUS: ${focusTask.title} · ${elapsedMinutes}M` : 'FOCUS: IDLE'}
          </span>
        </div>

        <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--color-border), transparent)', opacity: 0.65 }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
            {dateStr}
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 16, color: 'var(--color-text)', letterSpacing: 2, lineHeight: 1 }}>
            {clock}
          </span>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowQuickAdd(true)}
          style={{ minHeight: 30, padding: 'var(--space-1) var(--space-4)' }}
          disabled={domains.length === 0}
        >
          <span style={{ fontSize: 14, letterSpacing: 2 }}>{domains.length === 0 ? 'SET UP DOMAINS' : '+ NEW TASK'}</span>
        </button>
      </header>

      {showQuickAdd && domains.length > 0 && <QuickAddTask onClose={() => setShowQuickAdd(false)} />}
    </>
  );
};
