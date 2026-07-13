import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import { useHabitStore } from '../store/useHabitStore';
import { useDomainStore } from '../store/useDomainStore';
import { HabitCard } from '../components/habits/HabitCard';
import { HabitHistoryEditor } from '../components/habits/HabitHistoryEditor';
import { Modal } from '../components/shared/Modal';
import { PageHeader } from '../components/shared/PageHeader';
import { PanelHeader } from '../components/shared/PanelHeader';
import { containsArabic } from '../lib/text-utils';
import {
  getHabitMissedDates,
  getHabitProgressForDate,
  isHabitDueOnDate,
  parseTargetDays,
} from '../lib/habit-schedule';
import { getHabitActivationDate } from '../lib/habit-log-utils';
import type {
  CreateHabitPayload,
  DomainId,
  Habit,
  HabitCadenceType,
  HabitTargetType,
  UpdateHabitPayload,
} from '../lib/types';
import { getDefaultDomainId, getDomainLabel, getDomainThemeStyle } from '../lib/domain-utils';

const HABIT_SKIP_SUGGESTIONS = ['LOW ENERGY', 'OVERBOOKED', 'SICK', 'TRAVEL', 'DISRUPTED ROUTINE', 'FORGOT'];
const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function legacyFrequency(cadenceType: HabitCadenceType): 'daily' | 'weekdays' | 'weekly' {
  if (cadenceType === 'daily') return 'daily';
  if (cadenceType === 'weekdays' || cadenceType === 'selected_days') return 'weekdays';
  return 'weekly';
}

function legacyTargetDays(cadenceType: HabitCadenceType, selectedDays: number[]): number[] {
  if (cadenceType === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  if (cadenceType === 'weekdays') return [1, 2, 3, 4, 5];
  if (cadenceType === 'selected_days') return selectedDays;
  return [1];
}

interface HabitFormProps {
  onClose: () => void;
  initialHabit?: Habit;
}

const HabitForm: React.FC<HabitFormProps> = ({ onClose, initialHabit }) => {
  const { createHabit, updateHabit } = useHabitStore();
  const domains = useDomainStore((state) => state.domains);
  const isEditing = Boolean(initialHabit);
  const initialDays = parseTargetDays(initialHabit?.cadence_days || initialHabit?.target_days || '[]');

  const [domain, setDomain] = useState<DomainId>(initialHabit?.domain_id ?? getDefaultDomainId(domains));
  const [title, setTitle] = useState(initialHabit?.title ?? '');
  const [description, setDescription] = useState(initialHabit?.description ?? '');
  const [cadenceType, setCadenceType] = useState<HabitCadenceType>(initialHabit?.cadence_type ?? 'daily');
  const [selectedDays, setSelectedDays] = useState<number[]>(initialDays.length > 0 ? initialDays : [1, 2, 3, 4, 5]);
  const [cadenceIntervalDays, setCadenceIntervalDays] = useState(initialHabit?.cadence_interval_days ?? 2);
  const [cadenceWeeklyTarget, setCadenceWeeklyTarget] = useState(initialHabit?.cadence_weekly_target ?? 3);
  const [cadenceAnchorDate, setCadenceAnchorDate] = useState(initialHabit?.cadence_anchor_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [targetType, setTargetType] = useState<HabitTargetType>(initialHabit?.target_type ?? 'checkbox');
  const [targetValue, setTargetValue] = useState(initialHabit?.target_value ?? 1);
  const [minimumValue, setMinimumValue] = useState(initialHabit?.minimum_value ?? 1);
  const [unitLabel, setUnitLabel] = useState(initialHabit?.unit_label ?? '');
  const [minimumVersion, setMinimumVersion] = useState(initialHabit?.minimum_version ?? '');
  const [recoveryGraceDays, setRecoveryGraceDays] = useState(initialHabit?.recovery_grace_days ?? 1);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(Boolean(
    initialHabit?.description
    || initialHabit?.recovery_grace_days
    || initialHabit?.cadence_anchor_date,
  ));

  const titleArabic = containsArabic(title);
  const descriptionArabic = containsArabic(description);
  const minimumArabic = containsArabic(minimumVersion);

  function toggleWeekday(day: number): void {
    setSelectedDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => a - b));
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);

    const cadenceDays = cadenceType === 'selected_days' ? selectedDays : legacyTargetDays(cadenceType, selectedDays);
    const payload: CreateHabitPayload = {
      domain_id: domain,
      title: title.trim(),
      description: description.trim() || undefined,
      frequency: legacyFrequency(cadenceType),
      target_days: JSON.stringify(legacyTargetDays(cadenceType, selectedDays)),
      cadence_type: cadenceType,
      cadence_days: JSON.stringify(cadenceDays),
      cadence_interval_days: cadenceIntervalDays,
      cadence_weekly_target: cadenceWeeklyTarget,
      cadence_anchor_date: cadenceAnchorDate || undefined,
      target_type: targetType,
      target_value: targetType === 'checkbox' ? 1 : Math.max(1, targetValue),
      minimum_value: targetType === 'checkbox' ? undefined : Math.max(1, minimumValue),
      unit_label: targetType === 'count' ? (unitLabel.trim() || 'reps') : targetType === 'minutes' ? 'min' : undefined,
      minimum_version: minimumVersion.trim() || undefined,
      recovery_grace_days: recoveryGraceDays,
    };

    try {
      if (isEditing && initialHabit) {
        const updates: UpdateHabitPayload = {
          id: initialHabit.id,
          domain_id: domain,
          title: payload.title,
          description: payload.description ?? '',
          frequency: payload.frequency,
          target_days: payload.target_days,
          cadence_type: payload.cadence_type,
          cadence_days: payload.cadence_days,
          cadence_interval_days: payload.cadence_interval_days,
          cadence_weekly_target: payload.cadence_weekly_target,
          cadence_anchor_date: payload.cadence_anchor_date,
          target_type: payload.target_type,
          target_value: payload.target_value,
          minimum_value: payload.minimum_value,
          unit_label: payload.unit_label,
          minimum_version: payload.minimum_version,
          recovery_grace_days: payload.recovery_grace_days,
        };
        await updateHabit(updates);
      } else {
        await createHabit(payload);
      }
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 'var(--space-4)' }}>
      <div>
        <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Domain</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 'var(--space-2)' }}>
          {domains.map((entry) => (
            <button key={entry.id} type="button" data-domain={entry.id} onClick={() => setDomain(entry.id)} className={clsx('btn', domain === entry.id ? 'btn-primary' : 'btn-ghost')} style={{ ...getDomainThemeStyle(entry), padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)' }}>
              {getDomainLabel(entry.id, domains).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Habit Name *</label>
        <input className="input" dir="auto" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus required placeholder="Read 20 minutes / Train / Write" style={{ fontFamily: titleArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }} />
      </div>

      <div className="layout-grid-two">
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Cadence</label>
          <select className="input" value={cadenceType} onChange={(event) => setCadenceType(event.target.value as HabitCadenceType)}>
            <option value="daily">DAILY</option>
            <option value="weekdays">WEEKDAYS</option>
            <option value="selected_days">SELECTED DAYS</option>
            <option value="interval">EVERY N DAYS</option>
            <option value="times_per_week">N TIMES / WEEK</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Target Type</label>
          <select className="input" value={targetType} onChange={(event) => setTargetType(event.target.value as HabitTargetType)}>
            <option value="checkbox">CHECKBOX</option>
            <option value="count">COUNT</option>
            <option value="minutes">MINUTES</option>
          </select>
        </div>
      </div>

      {cadenceType === 'selected_days' && (
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Selected Days</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(68px, 1fr))', gap: 'var(--space-2)' }}>
            {WEEKDAY_NAMES.map((name, index) => (
              <button key={name} type="button" className={clsx('btn', selectedDays.includes(index) ? 'btn-primary' : 'btn-ghost')} onClick={() => toggleWeekday(index)} style={{ padding: 'var(--space-1) 0' }}>
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {cadenceType === 'interval' && (
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Every N Days</label>
          <input className="input" type="number" min={1} value={cadenceIntervalDays} onChange={(event) => setCadenceIntervalDays(parseInt(event.target.value, 10) || 1)} />
        </div>
      )}

      {cadenceType === 'times_per_week' && (
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Times Per Week</label>
          <input className="input" type="number" min={1} max={14} value={cadenceWeeklyTarget} onChange={(event) => setCadenceWeeklyTarget(parseInt(event.target.value, 10) || 1)} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: targetType === 'checkbox' ? '1fr' : 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
        {targetType !== 'checkbox' && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Target Value</label>
              <input className="input" type="number" min={1} value={targetValue} onChange={(event) => setTargetValue(parseInt(event.target.value, 10) || 1)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Minimum Value</label>
              <input className="input" type="number" min={1} value={minimumValue} onChange={(event) => setMinimumValue(parseInt(event.target.value, 10) || 1)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Unit</label>
              <input className="input" value={targetType === 'minutes' ? 'min' : unitLabel} onChange={(event) => setUnitLabel(event.target.value)} disabled={targetType === 'minutes'} />
            </div>
          </>
        )}
        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Minimum Version</label>
          <input className="input" dir="auto" value={minimumVersion} onChange={(event) => setMinimumVersion(event.target.value)} placeholder="Smallest valid version" style={{ fontFamily: minimumArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }} />
        </div>
      </div>

      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
        Minimum version is the honest fallback version of the habit, not the ideal one.
      </div>

      <div style={{ border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)', padding: 'var(--space-3)', display: 'grid', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase' }}>Advanced Setup</div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>Use this for notes, interval anchors, and recovery behavior.</div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? 'HIDE' : 'SHOW'}
          </button>
        </div>

        {showAdvanced && (
          <>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Description</label>
              <textarea className="input" dir="auto" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} style={{ resize: 'none', fontFamily: descriptionArabic ? 'var(--font-arabic)' : 'var(--font-sans)' }} placeholder="Why this matters" />
            </div>

            {cadenceType === 'interval' && (
              <div>
                <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Anchor Date</label>
                <input className="input" type="date" lang="en-GB" value={cadenceAnchorDate} onChange={(event) => setCadenceAnchorDate(event.target.value)} />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>Recovery Days</label>
              <input className="input" type="number" min={0} max={7} value={recoveryGraceDays} onChange={(event) => setRecoveryGraceDays(parseInt(event.target.value, 10) || 0)} />
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-2)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>CANCEL</button>
        <button type="submit" className="btn btn-primary" disabled={!title.trim() || saving}>{saving ? (isEditing ? 'SAVING...' : 'CREATING...') : (isEditing ? 'SAVE CHANGES' : 'CREATE HABIT')}</button>
      </div>
    </form>
  );
};

export const HabitsPage: React.FC = () => {
  const { habits, logs, logHabit, logHabitMinimum, skipHabit, undoHabitLog, restartHabit, deleteHabit, loadLogsRange } = useHabitStore();
  const domains = useDomainStore((state) => state.domains);
  const [showNewHabit, setShowNewHabit] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [actionHabit, setActionHabit] = useState<Habit | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ habit: Habit; date: string } | null>(null);
  const [skipTarget, setSkipTarget] = useState<{ habit: Habit; date: string } | null>(null);
  const [skipReason, setSkipReason] = useState('');
  const [searchParams] = useSearchParams();
  const highlightedHabitId = searchParams.get('habit');

  const today = new Date().toISOString().slice(0, 10);
  const activeHabits = useMemo(() => habits.filter((habit) => habit.is_active), [habits]);
  const dueToday = useMemo(() => activeHabits.filter((habit) => isHabitDueOnDate(habit, today, logs)), [activeHabits, logs, today]);
  const loggedToday = useMemo(
    () => activeHabits.filter((habit) => getHabitProgressForDate(habit, logs, today).latestLog),
    [activeHabits, logs, today],
  );
  const keptOrSavedToday = loggedToday.filter((habit) => {
    const log = getHabitProgressForDate(habit, logs, today).latestLog;
    return log && log.status !== 'skipped';
  }).length;
  const bestStreak = Math.max(0, ...activeHabits.map((habit) => habit.streak_longest));

  async function handleDelete(id: string): Promise<void> {
    try {
      const habit = habits.find((entry) => entry.id === id);
      if (habit && !window.confirm(`ARCHIVE "${habit.title}"?\n\nHistory stays in the log, but the habit will stop showing up.`)) return;
      await deleteHabit(id);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleRestart(habit: Habit): Promise<void> {
    if (!window.confirm(`RESTART "${habit.title}" CLEAN FROM TODAY?\n\nThis keeps history but resets the active streak.`)) return;
    try {
      await restartHabit(habit.id);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleHabitAdd(habit: Habit, date: string, amount: number, mode: 'progress' | 'minimum' | 'complete'): Promise<void> {
    try {
      if (mode === 'minimum') {
        await logHabitMinimum(habit.id, date, Math.max(1, amount));
        return;
      }
      if (mode === 'complete') {
        await logHabit(habit.id, date, Math.max(1, amount));
        return;
      }
      await logHabit(habit.id, date, Math.max(1, amount));
    } catch (error) {
      console.error(error);
    }
  }

  async function openHistoryEditor(habit: Habit): Promise<void> {
    const activationDate = getHabitActivationDate(habit);
    try {
      await loadLogsRange(activationDate, today);
      const refreshedLogs = useHabitStore.getState().logs;
      const recentMisses = getHabitMissedDates(habit, refreshedLogs, today, 45);
      const defaultDate = recentMisses.length > 0 ? recentMisses[recentMisses.length - 1] : today;
      setHistoryTarget({ habit, date: defaultDate < activationDate ? activationDate : defaultDate });
      setActionHabit(null);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="page-content fade-in">
      <PageHeader
        title="HABITS"
        subtitle={`${keptOrSavedToday} LOGGED TODAY | ${dueToday.length} STILL OPEN`}
        actions={<button className="btn btn-primary" onClick={() => setShowNewHabit(true)}>+ NEW HABIT</button>}
      />

      <hr className="page-sep" />

      <div className="layout-grid-stats" style={{ marginBottom: 'var(--space-3)' }}>
        {[
          { label: 'TOTAL HABITS', value: activeHabits.length },
          { label: 'DUE TODAY', value: dueToday.length },
          { label: 'BEST STREAK', value: bestStreak },
          { label: 'MISSED LAST 21D', value: activeHabits.reduce((sum, habit) => sum + getHabitMissedDates(habit, logs, today, 21).length, 0) },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-value">{stat.value}</div>
            <div className="stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {activeHabits.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-title">NO HABITS YET</div>
            <div>Start with one habit you can actually keep, then give it a cadence and a minimum version you trust.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          {domains.map((domain) => {
            const domainHabits = activeHabits.filter((habit) => habit.domain_id === domain.id);
            if (domainHabits.length === 0) return null;

            return (
              <div key={domain.id} data-domain={domain.id} className="card">
                <PanelHeader
                  title={<span style={{ color: 'var(--domain-primary)' }}>{getDomainLabel(domain.id, domains).toUpperCase()}</span>}
                  meta={`${domainHabits.length} ACTIVE | ${domainHabits.filter((habit) => isHabitDueOnDate(habit, today, logs)).length} DUE`}
                />
                <div className="card-body habit-domain-list stagger-in">
                  {domainHabits.map((habit) => (
                    <HabitCard
                      key={habit.id}
                      habit={habit}
                      logs={logs}
                      today={today}
                      highlighted={habit.id === highlightedHabitId}
                      onUndoToday={(habitId, date) => undoHabitLog(habitId, date)}
                      onLog={handleHabitAdd}
                      onOpenSkip={(habitToSkip, date) => {
                        setSkipTarget({ habit: habitToSkip, date });
                        setSkipReason('');
                      }}
                      onOpenManage={(habitToManage) => setActionHabit(habitToManage)}
                      onOpenHistory={(habitToReview) => { void openHistoryEditor(habitToReview); }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showNewHabit} onClose={() => setShowNewHabit(false)} title="New Habit">
        <HabitForm onClose={() => setShowNewHabit(false)} />
      </Modal>

      <Modal open={Boolean(editingHabit)} onClose={() => setEditingHabit(null)} title="Edit Habit">
        {editingHabit && <HabitForm initialHabit={editingHabit} onClose={() => setEditingHabit(null)} />}
      </Modal>

      <Modal open={Boolean(actionHabit)} onClose={() => setActionHabit(null)} title="Manage Habit">
        {actionHabit && (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {actionHabit.title}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)' }}>
              Keep completion actions on the row. Use this panel for maintenance or structural changes.
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setActionHabit(null); setEditingHabit(actionHabit); }}>EDIT</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { void openHistoryEditor(actionHabit); }}>PAST DAY</button>
              <button className="btn btn-ghost btn-sm" onClick={async () => { await handleRestart(actionHabit); setActionHabit(null); }}>RESTART CLEAN</button>
              <button className="btn btn-danger btn-sm" onClick={async () => { await handleDelete(actionHabit.id); setActionHabit(null); }}>ARCHIVE</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        title="Adjust Past Day"
        className="habit-history-modal"
      >
        {historyTarget && (
          <HabitHistoryEditor
            habit={historyTarget.habit}
            logs={logs}
            today={today}
            selectedDate={historyTarget.date}
            onSelectDate={(date) => setHistoryTarget((current) => current ? { ...current, date } : current)}
            onLog={handleHabitAdd}
            onUndo={(habitId, date) => undoHabitLog(habitId, date)}
            onOpenSkip={(habitToSkip, date) => {
              setHistoryTarget(null);
              setSkipTarget({ habit: habitToSkip, date });
              setSkipReason('');
            }}
          />
        )}
      </Modal>

      <Modal open={Boolean(skipTarget)} onClose={() => setSkipTarget(null)} title="Skip Habit">
        {skipTarget && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await skipHabit(skipTarget.habit.id, skipTarget.date, skipReason);
                setSkipTarget(null);
                setSkipReason('');
              } catch (error) {
                console.error(error);
              }
            }}
            style={{ display: 'grid', gap: 'var(--space-3)' }}
          >
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Why are you skipping "{skipTarget.habit.title}" for {skipTarget.date}?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {HABIT_SKIP_SUGGESTIONS.map((reason) => (
                <button key={reason} type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipReason(reason)} style={skipReason === reason ? { color: 'var(--color-warning)', borderColor: 'var(--color-warning)' } : undefined}>
                  {reason}
                </button>
              ))}
            </div>
            <textarea className="input" value={skipReason} onChange={(event) => setSkipReason(event.target.value)} rows={3} placeholder="Low energy, travel, sick, overloaded..." style={{ resize: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setSkipTarget(null)}>CANCEL</button>
              <button type="submit" className="btn btn-primary" disabled={!skipReason.trim()}>SAVE SKIP</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
