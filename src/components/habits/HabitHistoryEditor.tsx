import React, { useMemo } from 'react';
import { containsArabic } from '../../lib/text-utils';
import { getHabitMissedDates, getHabitProgressForDate, isHabitDueOnDate } from '../../lib/habit-schedule';
import { getHabitActivationDate, getHabitMinimumAmount, getHabitRemainingAmount } from '../../lib/habit-log-utils';
import { HABIT_STATUS_LABELS } from './HabitCard';
import { FormField, TextInput } from '../shared/form';
import type { Habit, HabitLog } from '../../lib/types';

type HabitActionMode = 'progress' | 'minimum' | 'complete';

interface HabitHistoryEditorProps {
  habit: Habit;
  logs: HabitLog[];
  today: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onLog: (habit: Habit, date: string, amount: number, mode: HabitActionMode) => void | Promise<void>;
  onUndo: (habitId: string, date: string) => void | Promise<void>;
  onOpenSkip: (habit: Habit, date: string) => void;
}

function getHistoryStatusLabel(habit: Habit, date: string, logs: HabitLog[]): string {
  const progress = getHabitProgressForDate(habit, logs, date);
  if (progress.latestLog) {
    return HABIT_STATUS_LABELS[progress.latestLog.status];
  }
  if (isHabitDueOnDate(habit, date, logs)) {
    return date === new Date().toISOString().slice(0, 10) ? 'OPEN TODAY' : 'MISSED / UNLOGGED';
  }
  return 'NOT SCHEDULED';
}

export const HabitHistoryEditor: React.FC<HabitHistoryEditorProps> = ({
  habit,
  logs,
  today,
  selectedDate,
  onSelectDate,
  onLog,
  onUndo,
  onOpenSkip,
}) => {
  const activationDate = getHabitActivationDate(habit);
  const progress = getHabitProgressForDate(habit, logs, selectedDate);
  const currentLog = progress.latestLog;
  const currentStatus = getHistoryStatusLabel(habit, selectedDate, logs);
  const canActOnSelectedDate = Boolean(currentLog) || isHabitDueOnDate(habit, selectedDate, logs);
  const canSaveMinimum = habit.target_type !== 'checkbox' || Boolean(habit.minimum_version);
  const remainingAmount = getHabitRemainingAmount(habit, progress.current);
  const minimumAmount = getHabitMinimumAmount(habit, progress.current);
  const titleArabic = containsArabic(habit.title);

  const quickMisses = useMemo(
    () => getHabitMissedDates(habit, logs, today, 45).reverse().slice(0, 12),
    [habit, logs, today],
  );

  return (
    <div className="habit-history-shell">
      <div className="habit-history-copy">
        <div className="habit-history-title" dir="auto" style={{ fontFamily: titleArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }}>
          {habit.title}
        </div>
        <div className="habit-history-note">
          Use this when you actually did the habit but forgot to log it. Pick a past scheduled day, then mark it honestly.
        </div>
      </div>

      <div className="habit-history-grid">
        <div className="habit-history-panel">
          <FormField label="Date To Adjust">
            <TextInput
              id="habit-history-date"
              type="date"
              lang="en-GB"
              min={activationDate}
              max={today}
              value={selectedDate}
              onChange={(event) => onSelectDate(event.target.value)}
            />
          </FormField>

          <div className="habit-history-state">
            <div className="habit-history-state-row">
              <span className="habit-history-state-label">STATUS</span>
              <span className="habit-history-state-value">{currentStatus}</span>
            </div>
            <div className="habit-history-state-row">
              <span className="habit-history-state-label">WINDOW</span>
              <span className="habit-history-state-value">
                {progress.periodStart === progress.periodEnd ? progress.periodStart : `${progress.periodStart} -> ${progress.periodEnd}`}
              </span>
            </div>
            <div className="habit-history-state-row">
              <span className="habit-history-state-label">PROGRESS</span>
              <span className="habit-history-state-value">{progress.current}/{progress.target}</span>
            </div>
            {currentLog?.skip_reason ? (
              <div className="habit-history-state-detail">SKIP REASON: {currentLog.skip_reason}</div>
            ) : null}
          </div>

          <div className="habit-history-actions">
            {canActOnSelectedDate ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => { void onLog(habit, selectedDate, remainingAmount, 'complete'); }}
                >
                  {habit.target_type === 'checkbox' ? 'COMPLETE' : 'COMPLETE TARGET'}
                </button>
                {canSaveMinimum ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { void onLog(habit, selectedDate, minimumAmount, 'minimum'); }}
                  >
                    SAVE MINIMUM
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => onOpenSkip(habit, selectedDate)}
                >
                  SKIP
                </button>
                {currentLog ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { void onUndo(habit.id, selectedDate); }}
                  >
                    UNDO LOG
                  </button>
                ) : null}
              </>
            ) : (
              <div className="habit-history-disabled">
                This date was not part of the habit schedule, so the app won’t create a log there.
              </div>
            )}
          </div>
        </div>

        <div className="habit-history-panel">
          <div className="habit-history-panel-head">
            <span className="meta-label">Quick Misses</span>
            <span className="habit-history-panel-meta">LAST 45 DAYS</span>
          </div>

          {quickMisses.length === 0 ? (
            <div className="habit-history-empty">
              No missed scheduled days in the recent window.
            </div>
          ) : (
            <div className="habit-history-chip-grid">
              {quickMisses.map((date) => (
                <button
                  key={date}
                  type="button"
                  className={`habit-date-chip${selectedDate === date ? ' is-active' : ''}`}
                  onClick={() => onSelectDate(date)}
                >
                  {date}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
