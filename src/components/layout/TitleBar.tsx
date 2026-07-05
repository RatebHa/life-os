import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const TitleBar: React.FC = () => {
  const [maximized, setMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  useEffect(() => {
    appWindow.isMaximized().then(setMaximized).catch(() => {});
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized).catch(() => {});
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 22,
    background: 'none',
    border: '1px solid transparent',
    fontFamily: 'var(--font-body)',
    fontSize: 10,
    letterSpacing: 1,
    color: 'var(--pip-muted)',
    cursor: 'crosshair',
    transition: 'color var(--t-fast), border-color var(--t-fast), background var(--t-fast)',
  };

  return (
    <div className="app-titlebar">
      {/* Brand label */}
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 13,
        letterSpacing: 3,
        color: 'var(--pip-dim)',
        lineHeight: 1,
        pointerEvents: 'none',
      }}>
        LIFE OS
      </span>

      {/* Drag region fills remaining space */}
      <div className="app-titlebar-drag-region" />

      {/* Minimize */}
      <button
        onClick={() => appWindow.minimize()}
        style={btnBase}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--pip)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--pip-border)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--pip-muted)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
        }}
        title="Minimize"
      >
        —
      </button>

      {/* Maximize / Restore */}
      <button
        onClick={() => maximized ? appWindow.unmaximize() : appWindow.maximize()}
        style={btnBase}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--pip)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--pip-border)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--pip-muted)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
        }}
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? '❐' : '□'}
      </button>

      {/* Close */}
      <button
        onClick={() => appWindow.close()}
        style={btnBase}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--pip-red)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--pip-red)';
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,64,64,0.1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--pip-muted)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.background = 'none';
        }}
        title="Close"
      >
        ✕
      </button>
    </div>
  );
};
