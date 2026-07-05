import React from 'react';
import { useDebugStore } from '../../store/useDebugStore';

function levelColor(level: 'info' | 'warn' | 'error'): string {
  if (level === 'error') return 'var(--color-danger)';
  if (level === 'warn') return 'var(--color-warning)';
  return 'var(--color-accent)';
}

export const DebugConsole: React.FC = () => {
  const entries = useDebugStore((state) => state.entries);
  const open = useDebugStore((state) => state.open);
  const setOpen = useDebugStore((state) => state.setOpen);
  const clear = useDebugStore((state) => state.clear);

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 350,
          minWidth: 120,
        }}
      >
        DEBUG {entries.length > 0 ? `(${entries.length})` : ''}
      </button>
    );
  }

  return (
    <div
      className="card fade-in"
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        width: 520,
        maxWidth: 'calc(100% - 24px)',
        maxHeight: 360,
        zIndex: 360,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="card-title">DEBUG CONSOLE</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => clear()}>CLEAR</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>HIDE</button>
        </div>
      </div>
      <div
        className="card-body"
        style={{
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: 11,
        }}
      >
        {entries.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)' }}>No debug events captured yet.</div>
        ) : (
          [...entries].reverse().map((entry) => (
            <div
              key={entry.id}
              style={{
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-hover)',
                padding: '8px 10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: levelColor(entry.level), textTransform: 'uppercase', letterSpacing: 1 }}>
                  {entry.level} :: {entry.scope}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>{entry.created_at.slice(11, 19)}</span>
              </div>
              <div style={{ marginTop: 4, color: 'var(--color-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {entry.message}
              </div>
              {entry.detail ? (
                <div style={{ marginTop: 4, color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {entry.detail}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

