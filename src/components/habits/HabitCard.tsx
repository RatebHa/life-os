import React from 'react';
import { containsArabic } from '../../lib/text-utils';
import {
  getHabitCadenceLabel,
  getHabitMissedDates,
  getHabitProgressForDate,
  getHabitTargetLabel,
  getHabitWeekdayInsights,
  isHabitDueOnDate,
} from '../../lib/habit-schedule';
import { getHabitIncrementAmount, getHabitMinimumAmount, getHabitRemainingAmount } from '../../lib/habit-log-utils';
import type { Habit, HabitLog, HabitLogStatus } from '../../lib/types';

type HabitActionMode = 'progress' | 'minimum' | 'complete';
type HabitChipTone = 'good' | 'warning' | 'danger' | 'info' | 'muted';

export const HABIT_STATUS_LABELS: Record<HabitLogStatus, string> = {
  completed: 'DONE TODAY',
  minimum: 'MINIMUM SAVED',
  partial: 'STARTED TODAY',
  skipped: 'SKIPPED TODAY',
};

function getLatestRecoverableMiss(habit: Habit, logs: HabitLog[], today: string): string | null {
  const missedDates = getHabitMissedDates(habit, logs, today, Math.max(7, habit.recovery_grace_days + 7));
  return [...missedDates].reverse().find((date) => {
    const delta = Math.floor((new Date(`${today}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86_400_000);
    return delta <= habit.recovery_grace_days;
  }) ?? null;
}

function getStatePresentation(
  todayLog: HabitLog | null,
  dueToday: boolean,
  latestRecoverableMiss: string | null,
  progressComplete: boolean,
): { label: string; tone: HabitChipTone; note: string } {
  if (todayLog) {
    if (todayLog.status === 'completed') {
      return { label: HABIT_STATUS_LABELS.completed, tone: 'good', note: 'This habit is already locked in for today.' };
    }
    if (todayLog.status === 'minimum') {
      return { label: HABIT_STATUS_LABELS.minimum, tone: 'warning', note: 'Minimum version logged. You can still leave it here and count the save honestly.' };
    }
    if (todayLog.status === 'partial') {
      return { label: HABIT_STATUS_LABELS.partial, tone: 'info', note: 'Progress is logged, but this habit is not fully complete yet.' };
    }
    return {
      label: HABIT_STATUS_LABELS.skipped,
      tone: 'danger',
      note: todayLog.skip_reason ? `Skip reason: ${todayLog.skip_reason}` : 'Skipped for today. The log stays honest and visible.',
    };
  }

  if (dueToday) {
    return { label: 'DUE TODAY', tone: 'info', note: 'This habit still needs a real decision today: complete it, save the minimum, or skip it honestly.' };
  }

  if (latestRecoverableMiss) {
    return { label: 'RECOVERY OPEN', tone: 'warning', note: `You can still recover ${latestRecoverableMiss} before the grace window closes.` };
  }

  if (progressComplete) {
    return { label: 'ON TRACK', tone: 'good', note: 'Target already met for the current window.' };
  }

  return { label: 'NOT DUE NOW', tone: 'muted', note: 'This habit is waiting for its next scheduled window.' };
}

function getProgressLabel(habit: Habit): string {
  if (habit.cadence_type === 'weekly_count' || habit.cadence_type === 'times_per_week') return 'THIS WEEK';
  return 'TODAY';
}

function getWindowLabel(periodStart: string, periodEnd: string): string {
  if (periodStart === periodEnd) return periodStart;
  return `${periodStart} -> ${periodEnd}`;
}

const HabitHeatmap: React.FC<{ habitId: string; logs: HabitLog[] }> = ({ habitId, logs }) => {
  const today = new Date();
  const logMap = new Map(logs.filter((log) => log.habit_id === habitId).map((log) => [log.completed_date, log.status]));
  const days: Array<{ date: string; status?: HabitLogStatus }> = [];

  for (let index = 89; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - index);
    const dateStr = date.toISOString().slice(0, 10);
    days.push({ date: dateStr, status: logMap.get(dateStr) });
  }

  const weeks: typeof days[] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return (
    <div className="habit-heatmap" aria-label="Habit activity heatmap">
      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="habit-heatmap-week">
          {week.map((day) => (
            <div
              key={day.date}
              className={`habit-heatmap-cell status-${day.status ?? 'empty'}`}
              title={day.date}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface HabitCardProps {
  habit: Habit;
  logs: HabitLog[];
  today: string;
  highlighted: boolean;
  onUndoToday: (habitId: string, date: string) => void | Promise<void>;
  onLog: (habit: Habit, date: string, amount: number, mode: HabitActionMode) => void | Promise<void>;
  onOpenSkip: (habit: Habit, date: string) => void;
  onOpenManage: (habit: Habit) => void;
  onOpenHistory: (habit: Habit) => void;
}

const HabitCardComponent: React.FC<HabitCardProps> = ({
  habit,
  logs,
  today,
  highlighted,
  onUndoToday,
  onLog,
  onOpenSkip,
  onOpenManage,
  onOpenHistory,
}) => {
  const progress = getHabitProgressForDate(habit, logs, today);
  const todayLog = progress.latestLog;
  const dueToday = isHabitDueOnDate(habit, today, logs);
  const latestRecoverableMiss = getLatestRecoverableMiss(habit, logs, today);
  const missedDates = getHabitMissedDates(habit, logs, today, 21);
  const insights = getHabitWeekdayInsights(habit, logs, 60);
  const increment = getHabitIncrementAmount(habit, progress.current);
  const minimumAmount = getHabitMinimumAmount(habit, progress.current);
  const progressPercent = progress.current <= 0 ? 0 : Math.max(6, Math.min(100, Math.round((progress.current / Math.max(1, progress.target)) * 100)));
  const state = getStatePresentation(todayLog, dueToday, latestRecoverableMiss, progress.isComplete);
  const progressLabel = getProgressLabel(habit);
  const titleArabic = containsArabic(habit.title);
  const descriptionArabic = containsArabic(habit.description ?? '');
  const minimumArabic = containsArabic(habit.minimum_version ?? '');

  return (
    <article data-domain={habit.domain_id} className={`habit-card${highlighted ? ' is-highlighted' : ''}`}>
      <div className="habit-card-main">
        <div className="habit-card-header">
          <div className="habit-card-heading">
            <div dir="auto" className="habit-card-title" style={{ fontFamily: titleArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
              {habit.title}
            </div>
            <div className="habit-chip-row">
              <span className="habit-chip habit-chip-muted">{getHabitCadenceLabel(habit)}</span>
              <span className="habit-chip habit-chip-muted">{getHabitTargetLabel(habit)}</span>
              <span className={`habit-chip habit-chip-${state.tone}`}>{state.label}</span>
            </div>
          </div>

          <div className="habit-card-window">
            <span className="habit-card-window-label">{progressLabel}</span>
            <span className="habit-card-window-value">{progress.current}/{progress.target}</span>
            <span className="habit-card-window-meta">{getWindowLabel(progress.periodStart, progress.periodEnd)}</span>
          </div>
        </div>

        {(habit.description || habit.minimum_version || state.note) && (
          <div className="habit-card-summary">
            {habit.description ? (
              <div dir="auto" className="habit-card-description" style={{ fontFamily: descriptionArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
                {habit.description}
              </div>
            ) : null}

            {habit.minimum_version ? (
              <div dir="auto" className="habit-card-minimum" style={{ fontFamily: minimumArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
                <span className="habit-card-minimum-label">MINIMUM VERSION</span>
                <span>{habit.minimum_version}</span>
              </div>
            ) : null}

            <div className={`habit-card-guidance tone-${state.tone}`}>{state.note}</div>
          </div>
        )}

        <section className="habit-card-progress">
          <div className="habit-card-section-head">
            <span className="habit-card-section-label">{progressLabel} PROGRESS</span>
            <span className="habit-card-section-note">
              {progress.isComplete ? 'TARGET MET' : `${Math.max(0, progress.target - progress.current)} LEFT`}
            </span>
          </div>
          <div className="habit-progress-track">
            <div className="habit-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </section>

        <section className="habit-card-diagnostics">
          <div className="habit-card-activity">
            <div className="habit-card-section-head">
              <span className="habit-card-section-label">ACTIVITY</span>
              <span className="habit-card-section-note">LAST 90 DAYS</span>
            </div>
            <HabitHeatmap habitId={habit.id} logs={logs} />
          </div>

          <div className="habit-card-insights">
            <div className="habit-insight-tile">
              <span className="habit-insight-label">STRONGEST</span>
              <span className="habit-insight-value">{insights.strongest ?? '--'}</span>
            </div>
            <div className="habit-insight-tile">
              <span className="habit-insight-label">NEEDS HELP</span>
              <span className="habit-insight-value">{insights.weakest ?? '--'}</span>
            </div>
            <div className="habit-insight-tile">
              <span className="habit-insight-label">MISSES 21D</span>
              <span className="habit-insight-value">{missedDates.length}</span>
            </div>
          </div>
        </section>

        <div className="habit-card-actions">
          <div className="habit-card-action-group">
            {todayLog ? (
              <button className="btn btn-ghost btn-sm" onClick={() => { void onUndoToday(habit.id, today); }}>
                UNDO TODAY
              </button>
            ) : dueToday ? (
              <>
                {habit.target_type === 'checkbox' ? (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => { void onLog(habit, today, 1, 'progress'); }}>
                      COMPLETE
                    </button>
                    {habit.minimum_version ? (
                      <button className="btn btn-ghost btn-sm" onClick={() => { void onLog(habit, today, 1, 'minimum'); }}>
                        SAVE MINIMUM
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <button className="btn btn-primary btn-sm" onClick={() => { void onLog(habit, today, increment, 'progress'); }}>
                      LOG +{increment}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { void onLog(habit, today, minimumAmount, 'minimum'); }}>
                      SAVE MINIMUM
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { void onLog(habit, today, getHabitRemainingAmount(habit, progress.current), 'complete'); }}>
                      COMPLETE TARGET
                    </button>
                  </>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => onOpenSkip(habit, today)}>
                  SKIP
                </button>
              </>
            ) : (
              <div className="habit-card-action-note">No action needed right now.</div>
            )}
          </div>

          {latestRecoverableMiss ? (
            <div className="habit-card-action-group habit-card-action-group-recovery">
              <span className="habit-card-action-label">RECOVER {latestRecoverableMiss}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { void onLog(habit, latestRecoverableMiss, minimumAmount, 'minimum'); }}>
                MINIMUM
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  const recoveryProgress = getHabitProgressForDate(habit, logs, latestRecoverableMiss);
                  void onLog(habit, latestRecoverableMiss, getHabitRemainingAmount(habit, recoveryProgress.current), 'complete');
                }}
              >
                FULL
              </button>
            </div>
          ) : null}

          <div className="habit-card-action-group habit-card-action-group-secondary">
            <button className="btn btn-ghost btn-sm" onClick={() => onOpenHistory(habit)}>
              PAST DAY
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => onOpenManage(habit)}>
              MANAGE
            </button>
          </div>
        </div>
      </div>

      <aside className="habit-card-sidebar">
        <div className="habit-card-metric">
          <span className="habit-card-metric-label">STREAK</span>
          <span className="habit-card-metric-value">{habit.streak_current}D</span>
        </div>
        <div className="habit-card-metric">
          <span className="habit-card-metric-label">BEST</span>
          <span className="habit-card-metric-value">{habit.streak_longest}D</span>
        </div>
        <div className="habit-card-metric">
          <span className="habit-card-metric-label">GRACE</span>
          <span className="habit-card-metric-value">{habit.recovery_grace_days}D</span>
        </div>
        <div className="habit-card-metric">
          <span className="habit-card-metric-label">MISSES</span>
          <span className="habit-card-metric-value">{missedDates.length}</span>
        </div>
      </aside>
    </article>
  );
};

export const HabitCard = React.memo(HabitCardComponent);
