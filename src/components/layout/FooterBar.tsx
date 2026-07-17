import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTimerStore } from '../../store/useTimerStore';
import { useUpdaterStore } from '../../store/useUpdaterStore';
import { formatDateDisplay } from '../../lib/date-format';

export const FooterBar: React.FC = () => {
  const { appState } = useAppStore();
  const activeTaskId = useTimerStore((state) => state.activeTaskId);
  const { status: updateStatus, version: updateVersion, download, restart } = useUpdaterStore();
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
        {updateStatus === 'available' && (
          <button className="btn btn-ghost btn-sm" onClick={() => void download()}>
            UPDATE {updateVersion} AVAILABLE
          </button>
        )}
        {updateStatus === 'downloading' && <span>DOWNLOADING UPDATE...</span>}
        {updateStatus === 'ready' && (
          <button className="btn btn-primary btn-sm" onClick={() => void restart()}>
            RESTART TO UPDATE
          </button>
        )}
      </div>
      <span>{activeTaskId ? 'FOCUS SESSION ACTIVE' : backupStatus}</span>
      <div>[ALT+1:TODAY] [ALT+7:REVIEW] [ALT+8:OVERVIEW] [CTRL+K:SEARCH]</div>
    </div>
  );
};
