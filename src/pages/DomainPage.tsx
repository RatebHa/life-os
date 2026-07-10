import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDomainStore } from '../store/useDomainStore';
import { useTaskStore } from '../store/useTaskStore';
import { useGoalStore } from '../store/useGoalStore';
import { useHabitStore } from '../store/useHabitStore';
import { useFocusStore } from '../store/useFocusStore';
import { StreakFlame } from '../components/gamification/StreakFlame';
import { getDomainMeta, getDomainThemeStyle } from '../lib/domain-utils';
import { formatMinutes, isTaskOpen, isTaskOverdue } from '../lib/task-planning';
import { getHabitProgressForDate, isHabitDueOnDate } from '../lib/habit-schedule';

export const DomainPage: React.FC = () => {
  const { domainId } = useParams<{ domainId: string }>();
  const navigate = useNavigate();
  const { getDomain, domains } = useDomainStore();
  const { tasksByDomain } = useTaskStore();
  const { goalsByDomain } = useGoalStore();
  const { habits, logs } = useHabitStore();
  const { sessions } = useFocusStore();

  const domain = getDomain(domainId ?? '');
  if (!domain) {
    return (
      <div className="page-content fade-in">
        <div className="empty-state">
          <div className="empty-state-title">DOMAIN NOT FOUND</div>
        </div>
      </div>
    );
  }

  const meta = getDomainMeta(domain.id, domains);
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const tasks = tasksByDomain(domain.id);
  const goals = goalsByDomain(domain.id);
  const domainHabits = habits.filter((habit) => habit.domain_id === domain.id && habit.is_active);
  const openTasks = tasks.filter((task) => isTaskOpen(task));
  const doneThisWeek = tasks.filter((task) => {
    const completedDay = task.completed_at?.slice(0, 10);
    return task.status === 'done' && Boolean(completedDay && completedDay >= weekStart);
  }).length;
  const overdueCount = openTasks.filter((task) => isTaskOverdue(task, today)).length;
  const focusMinutes = sessions.filter((session) => session.domain_id === domain.id && session.started_at.slice(0, 10) >= weekStart).reduce((sum, session) => sum + session.actual_minutes, 0);
  const dueHabits = domainHabits.filter((habit) => isHabitDueOnDate(habit, today, logs));
  const doneHabits = dueHabits.filter((habit) => getHabitProgressForDate(habit, logs, today).isComplete).length;

  return (
    <div data-domain={domain.id} className="page-content fade-in" style={getDomainThemeStyle(domain)}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-muted)', cursor: 'crosshair', letterSpacing: 1.5, textTransform: 'uppercase', padding: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
        {'<'} BACK
      </button>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 26, color: 'var(--domain-primary)', letterSpacing: 3 }}>
              {meta.label}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
              COMMITMENT SNAPSHOT
            </div>
          </div>
          <StreakFlame count={domain.streak_current} size="lg" />
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 'var(--space-3)' }}>
            {[
              { label: 'OPEN', value: openTasks.length },
              { label: 'DONE THIS WEEK', value: doneThisWeek },
              { label: 'OVERDUE', value: overdueCount },
              { label: 'FOCUS', value: formatMinutes(focusMinutes) },
              { label: 'STREAK', value: `${domain.streak_current}D` },
            ].map((stat) => (
              <div key={stat.label} className="stat-card">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ color: 'var(--domain-primary)' }}>GOALS ({goals.length})</span>
        </div>
        <div className="card-body">
          {goals.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-4) 0' }}>
              <div className="empty-state-title">NO GOALS YET</div>
              <div>Add one from the Goals page.</div>
            </div>
          ) : goals.slice(0, 5).map((goal) => (
            <div key={goal.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-accent)' }}>{goal.title}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-muted)' }}>{goal.progress_percent}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ color: 'var(--domain-primary)' }}>HABITS ({domainHabits.length})</span>
          <span className="card-meta">{doneHabits}/{dueHabits.length} TODAY</span>
        </div>
        <div className="card-body">
          {domainHabits.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-4) 0' }}>
              <div className="empty-state-title">NO HABITS YET</div>
              <div>Add one from the Habits page.</div>
            </div>
          ) : domainHabits.map((habit) => {
            const progress = getHabitProgressForDate(habit, logs, today);
            return (
              <div key={habit.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)', opacity: progress.isComplete ? 0.65 : 1 }}>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: progress.isComplete ? 'var(--color-text-muted)' : 'var(--color-accent)' }}>{habit.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 15, color: 'var(--color-text)' }}>{progress.current}/{progress.target}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-muted)' }}>{habit.streak_current}D</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ color: 'var(--domain-primary)' }}>ACTIVE TASKS ({openTasks.length})</span>
        </div>
        <div>
          {openTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-4) 0' }}>
              <div className="empty-state-title">NO ACTIVE TASKS</div>
              <div>Add one with the New Task button.</div>
            </div>
          ) : openTasks.slice(0, 8).map((task) => (
            <div key={task.id} className="task-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--color-surface-hover)', minHeight: 36 }}>
              <div style={{ width: 8, height: 8, border: '1px solid var(--domain-primary)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
              {task.is_mit && <span style={{ fontSize: 11, color: 'var(--color-warning)', textTransform: 'uppercase', letterSpacing: 1 }}>MIT</span>}
              {task.is_top_three && <span style={{ fontSize: 11, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: 1 }}>TOP 3</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
