import React, { useEffect, useRef } from 'react';
import { useTaskStore } from '../../store/useTaskStore';
import { useTimerStore } from '../../store/useTimerStore';
import { Modal } from './Modal';

function formatDuration(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return hrs > 0
    ? `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
    : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function currentElapsedSeconds(
  elapsedSeconds: number,
  isRunning: boolean,
  lastStartedAt: string | null,
): number {
  if (!isRunning || !lastStartedAt) return elapsedSeconds;
  const startedAt = new Date(lastStartedAt).getTime();
  if (Number.isNaN(startedAt)) return elapsedSeconds;
  return elapsedSeconds + Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

export const FocusTimer: React.FC = () => {
  const tasks = useTaskStore((state) => state.tasks);
  const {
    activeTaskId,
    showSummary,
    pauseTimer,
    resumeTimer,
    openSummary,
    closeSummary,
    setPlannedMinutes,
    addDistraction,
    setInterruptionNotes,
    setReflection,
    stopTimerAndSave,
    stopTimer,
  } = useTimerStore();
  const tickKey = useTimerStore((state) => state.tickKey);
  const activeDraft = useTimerStore((state) => (state.activeTaskId ? state.drafts[state.activeTaskId] ?? null : null));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (activeDraft?.is_running) {
      intervalRef.current = setInterval(() => {
        useTimerStore.getState().tick();
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeDraft?.is_running]);

  if (!activeTaskId || !activeDraft) return null;

  const task = tasks.find((item) => item.id === activeTaskId);
  const totalSeconds = currentElapsedSeconds(activeDraft.elapsed_seconds, activeDraft.is_running, activeDraft.last_started_at) + (tickKey >= 0 ? 0 : 0);
  const actualMinutes = Math.max(1, Math.floor(totalSeconds / 60));
  const plannedDelta = actualMinutes - activeDraft.planned_minutes;
  const display = formatDuration(totalSeconds);
  const trayLabel = task?.title ?? 'FOCUS DRAFT';

  return (
    <>
      <div
        className="focus-tray"
        style={{
          position: 'fixed',
          left: 'calc(var(--sidebar-width) + 18px)',
          right: '18px',
          bottom: 'calc(var(--footer-height) + 10px)',
          zIndex: 200,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 12,
          padding: '10px 14px',
          border: '1px solid var(--color-border)',
          background: 'linear-gradient(180deg, rgba(10,26,10,0.98), rgba(7,17,7,0.98))',
          boxShadow: '0 0 18px rgba(124,108,255,0.14)',
          backdropFilter: 'blur(3px)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Focus Draft
          </div>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 24, lineHeight: 1, color: 'var(--color-text)', letterSpacing: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {trayLabel}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, fontSize: 13, color: 'var(--color-text)', letterSpacing: 1.1, textTransform: 'uppercase' }}>
            <span>{display}</span>
            <span>Plan {activeDraft.planned_minutes}m</span>
            <span>{plannedDelta === 0 ? 'On Plan' : plannedDelta > 0 ? `+${plannedDelta}m` : `${plannedDelta}m`}</span>
            <span>{task?.energy_level ?? 'medium'} energy</span>
            <span>{activeDraft.distraction_count} distractions</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { void addDistraction(); }}>
            DISTRACT
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { void (activeDraft.is_running ? pauseTimer() : resumeTimer()); }}>
            {activeDraft.is_running ? 'PAUSE' : 'RESUME'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { void openSummary(); }}>
            REVIEW
          </button>
        </div>
      </div>

      <Modal open={showSummary} onClose={closeSummary} title="FOCUS SESSION">
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              {[
                { label: 'Task', value: trayLabel },
                { label: 'Elapsed', value: display },
                { label: 'Planned', value: `${activeDraft.planned_minutes}m` },
                { label: 'Distractions', value: String(activeDraft.distraction_count) },
              ].map((stat) => (
                <div key={stat.label} className="stat-card">
                  <div className="stat-value" style={{ fontSize: 18 }}>{stat.value}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--color-text)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Planned Minutes</label>
              <input
                className="input"
                type="number"
                min={5}
                step={5}
                value={activeDraft.planned_minutes}
                onChange={(event) => { void setPlannedMinutes(parseInt(event.target.value, 10) || 25); }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--color-text)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Interruption Notes</label>
              <input
                className="input"
                value={activeDraft.interruption_notes ?? ''}
                onChange={(event) => { void setInterruptionNotes(event.target.value); }}
                placeholder="What pulled you away?"
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--color-text)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Reflection</label>
            <textarea
              className="input"
              rows={4}
              value={activeDraft.reflection ?? ''}
              onChange={(event) => { void setReflection(event.target.value); }}
              placeholder="What moved forward, and what should change next time?"
              style={{ resize: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-danger" onClick={() => { void stopTimer(); }}>
              DISCARD
            </button>
            <button className="btn btn-ghost" onClick={closeSummary}>
              BACK
            </button>
            <button className="btn btn-primary" onClick={() => { void stopTimerAndSave(); }}>
              SAVE SESSION
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
