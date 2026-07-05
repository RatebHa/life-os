import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, Legend,
} from 'recharts';
import { db } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { useDomainStore } from '../store/useDomainStore';
import { useTaskStore } from '../store/useTaskStore';
import { useHabitStore } from '../store/useHabitStore';
import { useGoalStore } from '../store/useGoalStore';
import { useFrictionStore } from '../store/useFrictionStore';
import type { DomainId, TaskStats } from '../lib/types';
import { getDomainLabel } from '../lib/domain-utils';
import { getAchievementDisplay } from '../lib/achievement-display';
import { formatDateDisplay } from '../lib/date-format';

// ── Domain palette (Pip-Boy themed) ────────────────────────────────────────
const FALLBACK_DOMAIN_COLOR = '#4afa4a';

// ── Custom tooltip ──────────────────────────────────────────────────────────
interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

const ChartTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--pip-panel)',
      border: '1px solid var(--pip-border)',
      padding: '6px 10px',
      fontFamily: 'var(--font-body)',
      fontSize: 10,
      minWidth: 100,
    }}>
      {label && <div style={{ color: 'var(--pip-muted)', marginBottom: 4 }}>{label}</div>}
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, background: p.color }} />
          <span style={{ color: p.color }}>{p.value} ACTIONS</span>
        </div>
      ))}
    </div>
  );
};

// ── Achievement tile ─────────────────────────────────────────────────────────
const AchievementTile: React.FC<{
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
}> = React.memo(({ icon, title, description, unlocked, unlockedAt }) => (
  <div
    className="pip-panel"
    style={{
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      opacity: unlocked ? 1 : 0.35,
      borderColor: unlocked ? 'var(--pip-border)' : 'var(--pip-faint)',
    }}
  >
    <div style={{
      flexShrink: 0,
      width: 32,
      height: 32,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body)',
      fontSize: 10,
      letterSpacing: 0.5,
      color: unlocked ? 'var(--pip-bright)' : 'var(--pip-muted)',
      background: unlocked ? 'var(--pip-faint)' : 'var(--pip-dark)',
      border: `1px solid ${unlocked ? 'var(--pip-border)' : 'var(--pip-faint)'}`,
    }}>
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: unlocked ? 'var(--pip-amber)' : 'var(--pip-muted)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {title}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--pip-muted)', marginTop: 2 }}>
        {description}
      </div>
      {unlocked && unlockedAt && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--pip-muted)', marginTop: 2 }}>
          {formatDateDisplay(unlockedAt)}
        </div>
      )}
    </div>
    {unlocked && (
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--pip-amber)', flexShrink: 0, marginTop: 2 }}>★</span>
    )}
  </div>
));

AchievementTile.displayName = 'AchievementTile';

function reasonLabel(value: string): string {
  return value.replace(/_/g, ' ').toUpperCase();
}

// ── Main page ────────────────────────────────────────────────────────────────
export const AnalyticsPage: React.FC = () => {
  const [activityRange, setActivityRange] = useState<30 | 90>(30);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  const { achievements } = useAppStore();
  const { domains } = useDomainStore();
  const { tasks } = useTaskStore();
  const { habits, logs } = useHabitStore();
  const { goals } = useGoalStore();
  const { taskFrictionLogs } = useFrictionStore();

  useEffect(() => {
    setLoading(true);
    Promise.all([db.getTaskStats()])
      .then(([stats]) => {
        setTaskStats(stats);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Activity chart data ────────────────────────────────────────────────────
  const activityChartData = useMemo(() => {
    type ActivityRow = { date: string } & Record<string, string | number>;
    const domainIds = domains.map((domain) => domain.id);
    const habitDomainById = new Map(habits.map((habit) => [habit.id, habit.domain_id as DomainId]));
    const buildEmptyRow = (date: string): ActivityRow => {
      const row: ActivityRow = { date };
      domainIds.forEach((domainId) => {
        row[domainId] = 0;
      });
      return row;
    };

    const byDate = new Map<string, ActivityRow>();

    for (const task of tasks) {
      const date = task.completed_at?.slice(0, 10);
      if (!date) continue;
      if (!byDate.has(date)) byDate.set(date, buildEmptyRow(date));
      const entry = byDate.get(date)!;
      entry[task.domain_id] = Number(entry[task.domain_id] ?? 0) + 1;
    }

    for (const log of logs) {
      if (log.status === 'skipped') continue;
      const domainId = habitDomainById.get(log.habit_id);
      if (!domainId) continue;
      if (!byDate.has(log.completed_date)) byDate.set(log.completed_date, buildEmptyRow(log.completed_date));
      const entry = byDate.get(log.completed_date)!;
      entry[domainId] = Number(entry[domainId] ?? 0) + 1;
    }

    const result: ActivityRow[] = [];
    const today = new Date();
    for (let i = activityRange - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = formatDateDisplay(dateStr);
      const entry = byDate.get(dateStr) ?? buildEmptyRow(dateStr);
      const chartRow: ActivityRow = { date: label };
      domainIds.forEach((domainId) => {
        chartRow[domainId] = Number(entry[domainId] ?? 0);
      });
      result.push(chartRow);
    }
    return result;
  }, [activityRange, domains, habits, logs, tasks]);

  // ── Radar chart data ──────────────────────────────────────────────────────
  const radarData = useMemo(() => {
    const recentStart = new Date(Date.now() - (activityRange - 1) * 86400000).toISOString().slice(0, 10);
    const habitDomainById = new Map(habits.map((habit) => [habit.id, habit.domain_id as DomainId]));
    const totalActivity = domains.reduce((sum, domain) => {
      const completedTasks = tasks.filter((task) => (task.completed_at?.slice(0, 10) ?? '') >= recentStart && task.domain_id === domain.id).length;
      const habitActions = logs.filter((log) => log.status !== 'skipped' && log.completed_date >= recentStart && habitDomainById.get(log.habit_id) === domain.id).length;
      return sum + completedTasks + habitActions;
    }, 0) || 1;
    return domains.map((domain) => ({
      domain: getDomainLabel(domain.id, domains),
      value: Math.round(((
        tasks.filter((task) => (task.completed_at?.slice(0, 10) ?? '') >= recentStart && task.domain_id === domain.id).length
        + logs.filter((log) => log.status !== 'skipped' && log.completed_date >= recentStart && habitDomainById.get(log.habit_id) === domain.id).length
      ) / totalActivity) * 100),
    }));
  }, [activityRange, domains, habits, logs, tasks]);

  // ── Task completion line chart ────────────────────────────────────────────
  const completionData = useMemo(() => {
    const result: { date: string; rate: number }[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = formatDateDisplay(dateStr);
      const created = tasks.filter((t) => t.created_at?.slice(0, 10) === dateStr).length;
      const done = tasks.filter((t) => t.completed_at?.slice(0, 10) === dateStr).length;
      const rate = created > 0 ? Math.round(done / created * 100) : done > 0 ? 100 : 0;
      result.push({ date: label, rate });
    }
    return result;
  }, [tasks]);

  // ── Weekly summary ────────────────────────────────────────────────────────
  const weeklySummary = useMemo(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 6);
    const startStr = weekStart.toISOString().slice(0, 10);
    const todayStr = today.toISOString().slice(0, 10);

    const weekTasks = tasks.filter(
      (t) => t.completed_at && t.completed_at.slice(0, 10) >= startStr && t.completed_at.slice(0, 10) <= todayStr
    ).length;
    const weekHabitActions = logs.filter(
      (log) => log.status !== 'skipped' && log.completed_date >= startStr && log.completed_date <= todayStr,
    ).length;
    const bestStreak = Math.max(...domains.map((d) => d.streak_longest), 0);
    const longestHabitStreak = Math.max(...habits.map((h) => h.streak_longest), 0);

    return { weekActions: weekTasks + weekHabitActions, weekTasks, bestStreak: Math.max(bestStreak, longestHabitStreak) };
  }, [tasks, domains, habits, logs]);

  // ── Habit health (30-day completion rate per habit) ───────────────────────
  const habitHealth = useMemo(() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    return habits
      .filter((h) => h.is_active)
      .map((h) => {
        const recentLogs = logs.filter((l) => l.habit_id === h.id && l.completed_date >= thirtyDaysAgo);
        return {
          id: h.id,
          title: h.title,
          domain_id: h.domain_id,
          rate: Math.round((recentLogs.length / 30) * 100),
          streak: h.streak_current,
          longest: h.streak_longest,
        };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [habits, logs]);

  // ── Domain neglect (no activity in 5+ days) ───────────────────────────────
  const neglectedDomains = useMemo(() => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    return domains.filter((d) => !d.last_activity_date || d.last_activity_date < fiveDaysAgo);
  }, [domains]);

  // ── Goal forecast (weeks to complete at current pace) ─────────────────────
  const goalForecasts = useMemo(() => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return goals
      .filter((g) => g.status === 'active' && g.progress_percent < 100)
      .map((g) => {
        const linked = tasks.filter((t) => t.goal_id === g.id && t.status !== 'archived');
        const remaining = linked.filter((t) => t.status !== 'done').length;
        const recentDone = linked.filter(
          (t) => t.status === 'done' && (t.completed_at?.slice(0, 10) ?? '') >= sevenDaysAgo
        ).length;
        const weeksRemaining = remaining === 0
          ? 0
          : recentDone === 0
            ? null  // stalled
            : Math.ceil(remaining / recentDone);
        return { goal: g, remaining, recentDone, weeksRemaining };
      })
      .filter((f) => f.remaining > 0 || f.weeksRemaining === null);
  }, [goals, tasks]);

  // ── Weekly momentum trend (last 4 weeks) ─────────────────────────────────
  const weeklyTrend = useMemo(() => {
    return [3, 2, 1, 0].map((weeksAgo) => {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - weeksAgo * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      const endStr = weekEnd.toISOString().slice(0, 10);
      const startStr = weekStart.toISOString().slice(0, 10);

      const tasksW = tasks.filter((t) => {
        const d = t.completed_at?.slice(0, 10) ?? '';
        return t.status === 'done' && d >= startStr && d <= endStr;
      }).length;
      const habitsW = logs.filter((l) => l.completed_date >= startStr && l.completed_date <= endStr).length;
      const mitW = tasks.some((t) => t.is_mit && t.status === 'done' && (t.completed_at?.slice(0, 10) ?? '') >= startStr && (t.completed_at?.slice(0, 10) ?? '') <= endStr);

      // Simplified week score (max ~100)
      const score = Math.min(100, Math.round(Math.min(tasksW * 10, 50) + Math.min(habitsW * 8, 32) + (mitW ? 18 : 0)));
      const label = weeksAgo === 0 ? 'THIS WK' : weeksAgo === 1 ? 'LAST WK' : `${weeksAgo}W AGO`;
      return { label, score };
    });
  }, [tasks, logs]);

  const frictionAnalytics = useMemo(() => {
    const today = new Date();
    const last30 = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    const last14 = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
    const recentTaskFriction = taskFrictionLogs.filter((log) => log.created_at.slice(0, 10) >= last30);
    const recentSkippedHabits = logs.filter((log) => log.status === 'skipped' && log.completed_date >= last30);

    const frictionByReason = Array.from(recentTaskFriction.reduce((map, log) => {
      map.set(log.reason, (map.get(log.reason) ?? 0) + 1);
      return map;
    }, new Map<string, number>()).entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const habitSkipByReason = Array.from(recentSkippedHabits.reduce((map, log) => {
      const key = (log.skip_reason ?? 'unspecified').trim().toLowerCase() || 'unspecified';
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()).entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    const slippingTasks = tasks
      .filter((task) => task.status !== 'done' && task.status !== 'archived')
      .map((task) => {
        const frictionCount = recentTaskFriction.filter((log) => log.task_id === task.id).length;
        const overdueDays = task.due_date && task.due_date.slice(0, 10) < today.toISOString().slice(0, 10)
          ? Math.floor((today.getTime() - new Date(task.due_date).getTime()) / 86400000)
          : 0;
        return { task, frictionCount, overdueDays };
      })
      .filter((item) => item.frictionCount > 0 || item.overdueDays > 0)
      .sort((a, b) => (b.frictionCount + b.overdueDays) - (a.frictionCount + a.overdueDays))
      .slice(0, 5);

    const stalledTasks = tasks
      .filter((task) => task.status !== 'done' && task.status !== 'archived')
      .filter((task) => task.updated_at.slice(0, 10) < last14)
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
      .slice(0, 5);

    const tasksDueSoon = tasks.filter((task) => {
      if (task.status === 'done' || task.status === 'archived' || !task.due_date) return false;
      const date = task.due_date.slice(0, 10);
      return date >= today.toISOString().slice(0, 10) && date <= new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    });
    const activeHighLoadMinutes = tasks
      .filter((task) => task.status !== 'done' && task.status !== 'archived')
      .reduce((sum, task) => sum + (task.time_estimate_minutes ?? 45), 0);
    const overloadWarnings = [
      tasks.filter((task) => task.status !== 'done' && task.status !== 'archived' && task.due_date && task.due_date.slice(0, 10) < today.toISOString().slice(0, 10)).length >= 3
        ? 'You have 3 or more overdue tasks pulling attention backward.'
        : null,
      tasksDueSoon.length >= 6 ? 'The next 48 hours are overcommitted. Too many tasks are due too close together.' : null,
      activeHighLoadMinutes > 720 ? 'Your open workload is larger than two realistic focused days.' : null,
      frictionByReason.find((item) => item.reason === 'overloaded' && item.count >= 2) ? 'Overload is showing up repeatedly in your task friction logs.' : null,
    ].filter((value): value is string => Boolean(value));

    const recommendations = [
      frictionByReason[0]?.reason === 'too_big' ? 'Break the tasks you keep deferring into smaller first moves before they hit Today.' : null,
      frictionByReason[0]?.reason === 'unclear' ? 'Add clearer next-action language to stalled tasks so you can start without rethinking them.' : null,
      frictionByReason[0]?.reason === 'low_energy' || habitSkipByReason[0]?.reason === 'low energy' ? 'Reserve lighter work for low-energy windows and stop assigning deep tasks to tired hours.' : null,
      frictionByReason[0]?.reason === 'blocked' ? 'Surface dependencies earlier. A blocked list should trigger outreach or prerequisite work, not silent waiting.' : null,
      overloadWarnings.length > 0 ? 'Reduce active commitments before adding new work. The system is telling you capacity is the issue.' : null,
      slippingTasks.length > 0 ? `Choose one slipping task to either recommit to or delete. Right now "${slippingTasks[0].task.title}" is absorbing drag.` : null,
    ].filter((value): value is string => Boolean(value)).slice(0, 4);

    return {
      recentTaskFriction,
      recentSkippedHabits,
      frictionByReason,
      habitSkipByReason,
      slippingTasks,
      stalledTasks,
      overloadWarnings,
      recommendations,
    };
  }, [taskFrictionLogs, logs, tasks]);

  const tickFormatter = (val: string, index: number) => {
    if (activityRange === 30) return index % 5 === 0 ? val : '';
    return index % 15 === 0 ? val : '';
  };

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const chartAxisStyle = { fill: 'var(--pip-muted)', fontSize: 9, fontFamily: 'var(--font-body)' };

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <div>
        <div className="page-title">ANALYTICS</div>
        <div className="page-subtitle">PERFORMANCE DATA // STAT OVERVIEW</div>
      </div>

      <hr className="page-sep" />

      {/* Weekly summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'ACTIONS THIS WEEK', value: weeklySummary.weekActions.toLocaleString() },
          { label: 'TASKS COMPLETED', value: taskStats ? `${weeklySummary.weekTasks} / ${taskStats.completed} TOTAL` : weeklySummary.weekTasks },
          { label: 'BEST STREAK', value: `${weeklySummary.bestStreak}D` },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
        {[
          { label: 'TASK FRICTION (30D)', value: frictionAnalytics.recentTaskFriction.length },
          { label: 'HABIT SKIPS (30D)', value: frictionAnalytics.recentSkippedHabits.length },
          { label: 'SLIPPING TASKS', value: frictionAnalytics.slippingTasks.length },
          { label: 'OVERLOAD WARNINGS', value: frictionAnalytics.overloadWarnings.length },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 12, marginTop: 12 }}>
        <div className="pip-panel">
          <div className="pip-panel-header">
            <span className="pip-panel-title">WHAT KEEPS SLIPPING</span>
          </div>
          <div className="pip-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {frictionAnalytics.slippingTasks.length === 0 ? (
              <div className="pip-empty" style={{ padding: '12px 0' }}>
                <div className="pip-empty-title">NO MAJOR DRAG</div>
                <div>Nothing is repeatedly slipping right now.</div>
              </div>
            ) : (
              frictionAnalytics.slippingTasks.map(({ task, frictionCount, overdueDays }) => (
                <div key={task.id} data-domain={task.domain_id} style={{ border: '1px solid var(--pip-border)', padding: '8px 10px', background: 'var(--pip-faint)' }}>
                  <div style={{ fontSize: 14, color: 'var(--pip-bright)' }}>{task.title}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4, fontSize: 10, color: 'var(--pip-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                    <span>{frictionCount} FRICTION LOGS</span>
                    {overdueDays > 0 && <span style={{ color: 'var(--pip-red)' }}>{overdueDays}D OVERDUE</span>}
                    <span>{getDomainLabel(task.domain_id, domains)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pip-panel">
          <div className="pip-panel-header">
            <span className="pip-panel-title">PATTERN SIGNALS</span>
          </div>
          <div className="pip-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--pip-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Top task friction:
              <span style={{ color: 'var(--pip-amber)' }}> {frictionAnalytics.frictionByReason[0] ? `${reasonLabel(frictionAnalytics.frictionByReason[0].reason)} (${frictionAnalytics.frictionByReason[0].count})` : 'NONE'}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--pip-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Top habit skip reason:
              <span style={{ color: 'var(--pip-amber)' }}> {frictionAnalytics.habitSkipByReason[0] ? `${reasonLabel(frictionAnalytics.habitSkipByReason[0].reason)} (${frictionAnalytics.habitSkipByReason[0].count})` : 'NONE'}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--pip-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              Stalled work:
              <span style={{ color: frictionAnalytics.stalledTasks.length > 0 ? 'var(--pip-red)' : 'var(--pip-bright)' }}> {frictionAnalytics.stalledTasks.length} TASKS UNTOUCHED 14+D</span>
            </div>
            {frictionAnalytics.overloadWarnings.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {frictionAnalytics.overloadWarnings.map((warning) => (
                  <div key={warning} style={{ fontSize: 11, color: 'var(--pip-red)', letterSpacing: 1 }}>
                    ALERT: {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity over time */}
      <div className="pip-panel">
        <div className="pip-panel-header">
          <span className="pip-panel-title">ACTIVITY OVER TIME</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {([30, 90] as const).map((r) => (
              <button
                key={r}
                className={r === activityRange ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost'}
                onClick={() => setActivityRange(r)}
              >
                {r}D
              </button>
            ))}
          </div>
        </div>
        <div className="pip-panel-body">
          {loading ? (
            <div className="skeleton" style={{ height: 140 }} />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={activityChartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--pip-faint)" vertical={false} />
                <XAxis dataKey="date" tick={chartAxisStyle} tickLine={false} axisLine={false} tickFormatter={tickFormatter} interval={0} />
                <YAxis tick={chartAxisStyle} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(74,250,74,0.05)' }} />
                {domains.map((domain) => (
                  <Bar
                    key={domain.id}
                    dataKey={domain.id}
                    name={getDomainLabel(domain.id, domains)}
                    stackId="a"
                    fill={domain.color || FALLBACK_DOMAIN_COLOR}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 9, color: 'var(--pip-muted)', fontFamily: 'var(--font-body)', paddingTop: 6 }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Radar + completion side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Balance radar */}
        <div className="pip-panel">
          <div className="pip-panel-header">
            <span className="pip-panel-title">DOMAIN BALANCE</span>
          </div>
          <div className="pip-panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="var(--pip-border)" />
                <PolarAngleAxis dataKey="domain" tick={{ fill: 'var(--pip-muted)', fontSize: 9, fontFamily: 'var(--font-body)' }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: 'var(--pip-muted)', fontSize: 8 }} tickCount={4} />
                <Radar name="Balance" dataKey="value" stroke="var(--pip)" fill="var(--pip)" fillOpacity={0.12} strokeWidth={1} />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div style={{ background: 'var(--pip-panel)', border: '1px solid var(--pip-border)', padding: '4px 8px', fontFamily: 'var(--font-body)', fontSize: 10 }}>
                        <span style={{ color: 'var(--pip)' }}>{payload[0].value}%</span>
                      </div>
                    ) : null
                  }
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Completion rate line */}
        <div className="pip-panel">
          <div className="pip-panel-header">
            <span className="pip-panel-title">COMPLETION RATE (30D)</span>
          </div>
          <div className="pip-panel-body">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={completionData} margin={{ top: 10, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--pip-faint)" vertical={false} />
                <XAxis dataKey="date" tick={chartAxisStyle} tickLine={false} axisLine={false} tickFormatter={(v, i) => i % 7 === 0 ? v : ''} interval={0} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={chartAxisStyle} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <div style={{ background: 'var(--pip-panel)', border: '1px solid var(--pip-border)', padding: '4px 8px', fontFamily: 'var(--font-body)', fontSize: 10 }}>
                        <div style={{ color: 'var(--pip-muted)', marginBottom: 2 }}>{label}</div>
                        <div style={{ color: 'var(--pip-blue)' }}>{payload[0].value}% DONE</div>
                      </div>
                    ) : null
                  }
                />
                <Line type="monotone" dataKey="rate" stroke="var(--pip-blue)" strokeWidth={1} dot={false} activeDot={{ r: 3, fill: 'var(--pip-blue)' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Domain workload breakdown */}
      <div className="pip-panel">
        <div className="pip-panel-header">
          <span className="pip-panel-title">DOMAIN BREAKDOWN</span>
        </div>
        <div className="pip-panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {domains.map((domain) => {
              const color = domain.color || FALLBACK_DOMAIN_COLOR;
              const meta = { label: getDomainLabel(domain.id, domains) };
              const domainTasks = taskStats?.by_domain?.find((d) => d.domain_id === domain.id);
              return (
                <div key={domain.id} className="pip-panel" data-domain={domain.id} style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color, letterSpacing: 2, textTransform: 'uppercase' }}>
                      {meta.label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--pip-muted)' }}>
                      {habits.filter((habit) => habit.domain_id === domain.id && habit.is_active).length} HABITS
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      {
                        label: 'RECENT ACTIONS',
                        value: (
                          tasks.filter((task) => task.domain_id === domain.id && Boolean(task.completed_at)).length
                          + logs.filter((log) => log.status !== 'skipped' && habits.find((habit) => habit.id === log.habit_id)?.domain_id === domain.id).length
                        ).toString(),
                        color,
                      },
                      { label: 'BEST STREAK', value: `${domain.streak_longest}D`, color: 'var(--pip)' },
                      domainTasks ? { label: 'TASKS DONE', value: `${domainTasks.completed}/${domainTasks.total}`, color: 'var(--pip)' } : null,
                    ].filter(Boolean).map((row) => (
                      <div key={row!.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--pip-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                          {row!.label}
                        </span>
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: row!.color }}>
                          {row!.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Domain neglect alert */}
      {neglectedDomains.length > 0 && (
        <div style={{
          border: '1px solid var(--pip-amber)',
          background: 'rgba(200,160,32,0.05)',
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--pip-amber)', letterSpacing: 2 }}>
            ⚠ DOMAIN NEGLECT:
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--pip)', letterSpacing: 1 }}>
            {neglectedDomains.map((d) => getDomainLabel(d.id, domains)).join(', ')} — NO ACTIVITY IN 5+ DAYS
          </span>
        </div>
      )}

      {/* Habit health scores */}
      {habitHealth.length > 0 && (
        <div className="pip-panel">
          <div className="pip-panel-header">
            <span className="pip-panel-title">HABIT HEALTH (30D)</span>
            <span className="pip-panel-meta">% COMPLETION RATE</span>
          </div>
          <div className="pip-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {habitHealth.map((h) => (
              <div key={h.id} data-domain={h.domain_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--pip)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                      {h.title}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {h.streak > 0 && (
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--pip-amber)' }}>{h.streak}D STREAK</span>
                      )}
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 14,
                        color: h.rate >= 80 ? 'var(--pip-bright)' : h.rate >= 50 ? 'var(--pip)' : h.rate >= 20 ? 'var(--pip-amber)' : 'var(--pip-red)',
                      }}>
                        {h.rate}%
                      </span>
                    </div>
                  </div>
                  <div className="progress-track" style={{ height: 4 }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${h.rate}%`,
                        height: '100%',
                        background: h.rate >= 80 ? 'var(--pip-bright)' : h.rate >= 50 ? 'var(--pip)' : h.rate >= 20 ? 'var(--pip-amber)' : 'var(--pip-red)',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goal forecasts */}
      {goalForecasts.length > 0 && (
        <div className="pip-panel">
          <div className="pip-panel-header">
            <span className="pip-panel-title">GOAL FORECAST</span>
            <span className="pip-panel-meta">AT CURRENT PACE</span>
          </div>
          <div>
            {goalForecasts.map(({ goal, remaining, recentDone, weeksRemaining }) => (
              <div key={goal.id} data-domain={goal.domain_id} style={{
                padding: '7px 12px',
                borderBottom: '1px solid var(--pip-faint)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--pip)' }}>
                    {goal.title.length > 40 ? goal.title.slice(0, 40) + '…' : goal.title}
                  </span>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--pip-muted)', marginTop: 1, letterSpacing: 1 }}>
                    {remaining} TASK{remaining !== 1 ? 'S' : ''} REMAINING · {recentDone}/WK PACE
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  color: weeksRemaining === null ? 'var(--pip-red)' : weeksRemaining <= 2 ? 'var(--pip-bright)' : 'var(--pip-amber)',
                  flexShrink: 0,
                }}>
                  {weeksRemaining === null ? 'STALLED' : weeksRemaining === 0 ? 'DONE SOON' : `~${weeksRemaining}W`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly momentum trend */}
      <div className="pip-panel">
        <div className="pip-panel-header">
          <span className="pip-panel-title">WEEKLY TREND (4W)</span>
          <span className="pip-panel-meta">ACTIVITY SCORE</span>
        </div>
        <div className="pip-panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {weeklyTrend.map((w, i) => (
              <div key={w.label} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '8px 0',
                border: `1px solid ${i === 3 ? 'var(--pip-border)' : 'var(--pip-faint)'}`,
                background: i === 3 ? 'var(--pip-faint)' : 'transparent',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 28,
                  color: w.score >= 80 ? 'var(--pip-bright)' : w.score >= 50 ? 'var(--pip)' : w.score >= 25 ? 'var(--pip-amber)' : 'var(--pip-muted)',
                }}>
                  {w.score}
                </div>
                <div className="progress-track" style={{ width: '80%', height: 4 }}>
                  <div className="progress-fill" style={{ width: `${w.score}%`, height: '100%' }} />
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--pip-muted)', letterSpacing: 1 }}>
                  {w.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="pip-panel">
          <div className="pip-panel-header">
            <span className="pip-panel-title">COACHING RECOMMENDATIONS</span>
          </div>
          <div className="pip-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {frictionAnalytics.recommendations.length === 0 ? (
              <div className="pip-empty" style={{ padding: '10px 0' }}>
                <div className="pip-empty-title">NO MAJOR CORRECTION NEEDED</div>
                <div>Your current system is not showing a dominant failure pattern.</div>
              </div>
            ) : (
              frictionAnalytics.recommendations.map((recommendation) => (
                <div key={recommendation} style={{ fontSize: 11, color: 'var(--pip-bright)', border: '1px solid var(--pip-border)', padding: '8px 10px', background: 'var(--pip-faint)' }}>
                  {recommendation}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pip-panel">
          <div className="pip-panel-header">
            <span className="pip-panel-title">STALLED WORK</span>
            <span className="pip-panel-meta">{frictionAnalytics.stalledTasks.length} TASKS</span>
          </div>
          <div className="pip-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {frictionAnalytics.stalledTasks.length === 0 ? (
              <div className="pip-empty" style={{ padding: '10px 0' }}>
                <div className="pip-empty-title">NO LONG STALLS</div>
                <div>Nothing active has been untouched for two weeks.</div>
              </div>
            ) : (
              frictionAnalytics.stalledTasks.map((task) => (
                <div key={task.id} data-domain={task.domain_id} style={{ border: '1px solid var(--pip-border)', padding: '8px 10px', background: 'var(--pip-faint)' }}>
                  <div style={{ fontSize: 13, color: 'var(--pip-bright)' }}>{task.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--pip-muted)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                    LAST TOUCHED {formatDateDisplay(task.updated_at)} · {getDomainLabel(task.domain_id, domains)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Achievement gallery */}
      <div className="pip-panel">
        <div className="pip-panel-header">
          <span className="pip-panel-title">ACHIEVEMENTS</span>
          <span className="pip-panel-meta">
            <span style={{ color: 'var(--pip-amber)' }}>{unlockedCount}</span>/{achievements.length} UNLOCKED
          </span>
        </div>
        <div className="pip-panel-body">
          {achievements.length === 0 ? (
            <div className="pip-empty">
              <div className="pip-empty-title">NO ACHIEVEMENTS LOADED</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {achievements.map((a) => {
                const display = getAchievementDisplay(a, domains);
                return (
                  <AchievementTile
                    key={a.id}
                    icon={a.icon}
                    title={display.title}
                    description={display.description}
                    unlocked={a.unlocked}
                    unlockedAt={a.unlocked_at}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
