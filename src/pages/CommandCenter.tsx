import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDomainStore } from '../store/useDomainStore';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import { useGoalStore } from '../store/useGoalStore';
import { useFocusStore } from '../store/useFocusStore';
import { PageHeader } from '../components/shared/PageHeader';
import { PanelHeader } from '../components/shared/PanelHeader';
import { ROUTINE_PRESETS, buildTaskPayloadFromPreset } from '../lib/template-presets';
import { getHabitProgressForDate, isHabitDueOnDate } from '../lib/habit-schedule';
import { getDefaultDomainId, getDomainLabel } from '../lib/domain-utils';
import { formatDateDisplay, formatDateWithWeekday } from '../lib/date-format';

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDate(base: string, days: number): string {
  const next = new Date(`${base}T12:00:00`);
  next.setDate(next.getDate() + days);
  return isoDate(next);
}

function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0M';
  if (minutes < 60) return `${minutes}M`;
  return `${Math.floor(minutes / 60)}H ${minutes % 60}M`;
}

function taskFallsInWindow(date: string | null | undefined, start: string, end: string): boolean {
  if (!date) return false;
  const day = date.slice(0, 10);
  return day >= start && day <= end;
}

export const CommandCenter: React.FC = () => {
  const navigate = useNavigate();
  const { domains } = useDomainStore();
  const { tasks, createTask } = useTaskStore();
  const { habits, logs, createHabit } = useHabitStore();
  const { goals } = useGoalStore();
  const { sessions } = useFocusStore();
  const [launchingPresetId, setLaunchingPresetId] = useState<string | null>(null);
  const [standupDismissed, setStandupDismissed] = useState(false);

  const today = isoDate(new Date());
  const weekStart = shiftDate(today, -6);
  const openTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'archived' && task.task_kind !== 'recurring_template');
  const mitTask = openTasks.find((task) => task.is_mit);
  const topThreeOpen = openTasks.filter((task) => task.is_top_three);
  const overdueTasks = openTasks.filter((task) => task.due_date && task.due_date.slice(0, 10) < today);
  const todayBoard = openTasks.filter((task) => (
    task.status === 'in_progress'
    || task.is_mit
    || task.is_top_three
    || task.due_date?.slice(0, 10) === today
    || Boolean(task.planned_for_date?.slice(0, 10) && task.planned_for_date.slice(0, 10) <= today)
    || task.scheduled_for?.slice(0, 10) === today
  ));
  const doneToday = tasks.filter((task) => task.status === 'done' && task.completed_at?.slice(0, 10) === today).length;
  const dueTodayAll = tasks.filter((task) => task.status !== 'archived' && task.task_kind !== 'recurring_template' && task.due_date?.slice(0, 10) === today);
  const dueTodayDone = dueTodayAll.filter((task) => task.status === 'done').length;
  const weekRelevantTasks = tasks.filter((task) => task.status !== 'archived' && task.task_kind !== 'recurring_template' && (
    taskFallsInWindow(task.completed_at, weekStart, today)
    || taskFallsInWindow(task.due_date, weekStart, today)
    || taskFallsInWindow(task.planned_for_date, weekStart, today)
    || taskFallsInWindow(task.created_at, weekStart, today)
  ));
  const weekCommittedTasks = weekRelevantTasks.filter((task) => task.due_date || task.planned_for_date || task.is_top_three || task.is_mit);
  const weekCommittedDone = weekCommittedTasks.filter((task) => task.status === 'done').length;
  const weekMitTasks = weekRelevantTasks.filter((task) => task.is_mit);
  const weekMitDone = weekMitTasks.filter((task) => task.status === 'done').length;
  const weekTopThreeTasks = weekRelevantTasks.filter((task) => task.is_top_three);
  const weekTopThreeDone = weekTopThreeTasks.filter((task) => task.status === 'done').length;
  const weeklySessions = sessions.filter((session) => session.started_at.slice(0, 10) >= weekStart && session.started_at.slice(0, 10) <= today);
  const focusMinutes = weeklySessions.reduce((sum, session) => sum + session.actual_minutes, 0);
  const distractionCount = weeklySessions.reduce((sum, session) => sum + session.distraction_count, 0);
  const distractionRate = weeklySessions.length > 0 ? Math.round((distractionCount / weeklySessions.length) * 10) / 10 : 0;
  const stalledGoals = goals.filter((goal) => goal.status === 'active' && (!goal.next_action || goal.health === 'stalled' || goal.blocked_by));
  const dueHabits = habits.filter((habit) => habit.is_active && isHabitDueOnDate(habit, today, logs));
  const openHabits = dueHabits.filter((habit) => !getHabitProgressForDate(habit, logs, today).isComplete);
  const weeklyReliability = weekCommittedTasks.length > 0 ? `${Math.round((weekCommittedDone / weekCommittedTasks.length) * 100)}%` : '--';
  const mitHitRate = weekMitTasks.length > 0 ? `${Math.round((weekMitDone / weekMitTasks.length) * 100)}%` : '--';
  const topThreeHitRate = weekTopThreeTasks.length > 0 ? `${Math.round((weekTopThreeDone / weekTopThreeTasks.length) * 100)}%` : '--';
  const todayReadyState = mitTask && topThreeOpen.length > 0 ? 'SCOPED' : mitTask ? 'PARTIAL' : 'OPEN';
  const overviewRiskCount = [overdueTasks.length > 0, stalledGoals.length > 0, openHabits.length > 0, distractionRate >= 2].filter(Boolean).length;

  const showStandup = !standupDismissed && (overdueTasks.length > 0 || !mitTask || openHabits.length > 0);
  const quickPresets = ROUTINE_PRESETS.filter((preset) => preset.id === 'morning-reset' || preset.id === 'shutdown' || preset.id === 'deep-work-block');
  const presetDomainId = domains.length > 0 ? (mitTask?.domain_id ?? topThreeOpen[0]?.domain_id ?? getDefaultDomainId(domains)) : null;

  async function handleLaunchPreset(presetId: string) {
    const preset = ROUTINE_PRESETS.find((item) => item.id === presetId);
    if (!preset || !presetDomainId) return;
    setLaunchingPresetId(presetId);
    try {
      if (preset.tasks) {
        for (const presetTask of preset.tasks) {
          const dueDate = preset.kind === 'planning' ? shiftDate(today, 7) : today;
          await createTask({
            ...buildTaskPayloadFromPreset(presetDomainId, presetTask, dueDate),
          });
        }
      }
      if (preset.habits) {
        for (const presetHabit of preset.habits) {
          const exists = habits.some((habit) => habit.title.trim().toLowerCase() === presetHabit.title.trim().toLowerCase());
          if (!exists) {
            await createHabit({ ...presetHabit, domain_id: presetDomainId });
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLaunchingPresetId(null);
    }
  }

  const nextAction = mitTask
    ?? openTasks.find((task) => task.status === 'in_progress')
    ?? topThreeOpen[0]
    ?? overdueTasks[0]
    ?? todayBoard[0]
    ?? openTasks[0];

  return (
    <div className="page-content fade-in">
      {showStandup && (
        <div className="pip-panel" style={{ marginBottom: 12 }}>
          <PanelHeader
            title="SYSTEM NOTE"
            right={<button className="btn btn-ghost btn-sm" onClick={() => setStandupDismissed(true)}>DISMISS</button>}
          />
          <div className="pip-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="panel-note" style={{ color: overviewRiskCount >= 2 ? 'var(--pip-amber)' : 'var(--pip-muted)' }}>
              Overview is for orientation. Do the real planning and execution work in Today.
            </div>
            {!mitTask && <div style={{ fontSize: 13, color: 'var(--pip-amber)' }}>No MIT is set yet, so the day still needs a center of gravity.</div>}
            {overdueTasks.length > 0 && <div style={{ fontSize: 13, color: 'var(--pip-red)' }}>{overdueTasks.length} task{overdueTasks.length !== 1 ? 's are' : ' is'} slipping past the due date.</div>}
            {openHabits.length > 0 && <div style={{ fontSize: 13, color: 'var(--pip-muted)' }}>{openHabits.length} habit{openHabits.length !== 1 ? 's' : ''} still need honest logging today.</div>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/today')}>OPEN TODAY</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/weekly-review')}>WEEKLY REVIEW</button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="OVERVIEW"
        subtitle={`RELIABILITY SNAPSHOT // ${formatDateWithWeekday(new Date())}`}
        actions={(
          <>
            <button className="btn btn-primary" onClick={() => navigate('/today')}>OPEN TODAY</button>
            <button className="btn btn-ghost" onClick={() => navigate('/weekly-review')}>WEEKLY REVIEW</button>
          </>
        )}
      />

      <hr className="page-sep" />

      <div className="layout-grid-stats" style={{ marginBottom: 12 }}>
        {[
          { label: 'TODAY READY', value: `${todayReadyState} / ${topThreeOpen.length} TOP 3` },
          { label: 'WEEKLY RELIABILITY', value: weeklyReliability },
          { label: 'OVERDUE', value: overdueTasks.length },
          { label: 'FOCUS RHYTHM', value: `${formatMinutes(focusMinutes)} / ${distractionRate}` },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="layout-grid-two" style={{ marginBottom: 12 }}>
        <div className="pip-panel">
          <PanelHeader title="TODAY READINESS" meta={todayReadyState} />
          <div className="pip-panel-body" style={{ display: 'grid', gap: 10 }}>
            {nextAction ? (
              <div data-domain={nextAction.domain_id} style={{ display: 'grid', gap: 10 }}>
                <div className="panel-note">
                  Today is where you commit and start. Overview only tells you what needs your judgment.
                </div>
                <div style={{ border: '1px solid var(--pip-border)', background: 'var(--pip-faint)', padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: 'var(--pip-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Next task likely to matter</div>
                  <div style={{ fontSize: 18, color: 'var(--pip-bright)', marginTop: 4 }}>{nextAction.title}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {nextAction.is_mit && <span className="priority-badge-high">MIT</span>}
                    {nextAction.is_top_three && <span className="priority-badge-medium">TOP 3</span>}
                    <span className={`priority-badge-${nextAction.priority}`}>{nextAction.priority}</span>
                    {nextAction.time_estimate_minutes && <span style={{ fontSize: 12, color: 'var(--pip-muted)' }}>{formatMinutes(nextAction.time_estimate_minutes)}</span>}
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--pip)' }}>
                    <span>MIT</span>
                    <span>{mitTask ? 'SET' : 'OPEN'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--pip)' }}>
                    <span>Top 3 locked</span>
                    <span>{topThreeOpen.length}/3</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--pip)' }}>
                    <span>Due today complete</span>
                    <span>{dueTodayDone}/{dueTodayAll.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: openHabits.length > 0 ? 'var(--pip-amber)' : 'var(--pip)' }}>
                    <span>Habits still open</span>
                    <span>{openHabits.length}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/today')}>OPEN TODAY</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>OPEN TASKS</button>
                </div>
              </div>
            ) : (
              <div className="pip-empty">
                <div className="pip-empty-title">NO ACTIVE BOARD</div>
                <div>Open Today to set an MIT and scope the board before the day drifts.</div>
              </div>
            )}
          </div>
        </div>

        <div className="pip-panel">
          <PanelHeader title="SYSTEM HEALTH" />
          <div className="pip-panel-body" style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--pip)' }}>
              <span>Weekly reliability</span>
              <span>{weeklyReliability}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--pip)' }}>
              <span>MIT hit rate</span>
              <span>{mitHitRate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--pip)' }}>
              <span>Top 3 hit rate</span>
              <span>{topThreeHitRate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--pip)' }}>
              <span>Done today</span>
              <span>{doneToday}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: distractionCount > 0 ? 'var(--pip-amber)' : 'var(--pip)' }}>
              <span>Distraction rate</span>
              <span>{distractionRate}/session</span>
            </div>
            <div style={{ fontSize: 12, color: overviewRiskCount >= 2 ? 'var(--pip-amber)' : 'var(--pip-muted)' }}>
              {overviewRiskCount >= 2
                ? 'Several systems are drifting. Review the watchlist and reset scope before adding more.'
                : 'Nothing major is slipping. Keep the system quiet and protect consistency.'}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/weekly-review')}>OPEN REVIEW</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/calendar')}>OPEN CALENDAR</button>
            </div>
          </div>
        </div>
      </div>

      <div className="layout-grid-three" style={{ marginBottom: 12 }}>
        {domains.map((domain) => {
          const domainOpen = openTasks.filter((task) => task.domain_id === domain.id).length;
          const domainDone = tasks.filter((task) => {
            const completedDay = task.completed_at?.slice(0, 10);
            return task.domain_id === domain.id && task.status === 'done' && Boolean(completedDay && completedDay >= weekStart);
          }).length;
          const domainOverdue = overdueTasks.filter((task) => task.domain_id === domain.id).length;
          const domainFocus = weeklySessions.filter((session) => session.domain_id === domain.id).reduce((sum, session) => sum + session.actual_minutes, 0);

          return (
            <button
              key={domain.id}
              data-domain={domain.id}
              className="pip-panel"
              onClick={() => navigate(`/domain/${domain.id}`)}
              style={{ textAlign: 'left', padding: 14 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--domain-primary)', letterSpacing: 2 }}>
                  {getDomainLabel(domain.id, domains).toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--pip-bright)' }}>
                  {domain.streak_current}D
                </div>
              </div>
              <div className="layout-grid-pairs" style={{ gap: 6, fontSize: 12, color: 'var(--pip-muted)' }}>
                <span>Open: {domainOpen}</span>
                <span>Done: {domainDone}</span>
                <span>Overdue: {domainOverdue}</span>
                <span>Focus: {formatMinutes(domainFocus)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="layout-grid-two">
        <div className="pip-panel">
          <PanelHeader title="WATCHLIST" />
          <div className="pip-panel-body" style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--pip-muted)' }}>
              These are the places where the system needs review, not more ambition.
            </div>
            {overdueTasks.slice(0, 4).map((task) => (
              <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--pip-red)' }}>{task.title}</span>
                <span style={{ color: 'var(--pip-muted)' }}>{formatDateDisplay(task.due_date)}</span>
              </div>
            ))}
            {stalledGoals.slice(0, 3).map((goal) => (
              <div key={goal.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--pip-amber)' }}>{goal.title}</span>
                <span style={{ color: 'var(--pip-muted)' }}>{getDomainLabel(goal.domain_id, domains)}</span>
              </div>
            ))}
            {overdueTasks.length === 0 && stalledGoals.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--pip-muted)' }}>Nothing urgent is slipping right now.</div>
            )}
            {openHabits.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--pip)' }}>Open habits today</span>
                <span style={{ color: 'var(--pip-muted)' }}>{openHabits.length}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/tasks')}>TASKS</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/goals')}>GOALS</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/habits')}>HABITS</button>
            </div>
          </div>
        </div>

        <div className="pip-panel">
          <PanelHeader title="SUPPORT TOOLS" />
          <div className="pip-panel-body" style={{ display: 'grid', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--pip-muted)' }}>
              Helpful utilities live here so the main navigation can stay focused on execution and review.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {quickPresets.map((preset) => (
                <button key={preset.id} className="btn btn-ghost btn-sm" disabled={!presetDomainId || launchingPresetId === preset.id} onClick={() => handleLaunchPreset(preset.id).catch(console.error)}>
                  {launchingPresetId === preset.id ? 'LAUNCHING...' : preset.title.toUpperCase()}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/calendar')}>OPEN CALENDAR</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/analytics')}>OPEN ANALYTICS</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/settings')}>OPEN SETTINGS</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
