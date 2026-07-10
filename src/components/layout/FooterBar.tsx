import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTimerStore } from '../../store/useTimerStore';
import { formatDateDisplay } from '../../lib/date-format';

export const FooterBar: React.FC = () => {
  const { appState } = useAppStore();
  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const scaleLabel = (appState?.text_scale ?? 'normal').toUpperCase();
  const densityLabel = (appState?.ui_density ?? 'comfortable').toUpperCase();
  const backupLabel = appState?.last_backup_at ? formatDateDisplay(appState.last_backup_at) : 'NONE';
  const backupDay = appState?.last_backup_at?.slice(0, 10) ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const backupStatus = !backupDay
    ? 'BACKUP NOT RUN'
    : backupDay === today
      ? 'BACKUP READY'
      : `LAST BACKUP: ${backupLabel}`;

  return (
    <div className="footer">
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--color-success)',
              display: 'inline-block',
            }}
          />
          SYSTEM ONLINE
        </span>
        <span>|</span>
        <span>DB: LOCAL</span>
        <span>|</span>
        <span>TEXT: {scaleLabel}</span>
        <span>|</span>
        <span>DENSITY: {densityLabel}</span>
      </div>
      <span>{activeTaskId ? 'FOCUS SESSION ACTIVE' : backupStatus}</span>
      <div>[ALT+1:TODAY] [ALT+7:REVIEW] [ALT+8:OVERVIEW] [CTRL+K:SEARCH]</div>
    </div>
  );
};
