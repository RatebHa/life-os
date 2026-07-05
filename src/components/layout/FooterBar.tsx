import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTimerStore } from '../../store/useTimerStore';
import { formatDateDisplay } from '../../lib/date-format';

export const FooterBar: React.FC = () => {
  const { appState } = useAppStore();
  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const crtLabel = (appState?.crt_intensity ?? 'medium').toUpperCase();
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
    <div className="pip-footer">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 5,
              height: 5,
              background: 'var(--pip)',
              boxShadow: 'var(--pip-glow)',
              display: 'inline-block',
            }}
          />
          SYSTEM ONLINE
        </span>
        <span>|</span>
        <span>DB: LOCAL</span>
        <span>|</span>
        <span>CRT: {crtLabel}</span>
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
