import React, { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

type AppWindow = ReturnType<typeof getCurrentWindow>;

// getCurrentWindow() throws synchronously if window.__TAURI_INTERNALS__ isn't
// injected (e.g. a plain browser preview) — guard so render can't crash.
function getAppWindow(): AppWindow | null {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

export const TitleBar: React.FC = () => {
  const [maximized, setMaximized] = useState(false);
  const [appWindow] = useState<AppWindow | null>(() => getAppWindow());

  useEffect(() => {
    if (!appWindow) return;
    appWindow.isMaximized().then(setMaximized).catch(() => {});
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized).catch(() => {});
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [appWindow]);

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
    height: 22,
    background: 'none',
    border: '1px solid transparent',
    fontFamily: 'var(--font-sans)',
    fontSize: 10,
    letterSpacing: 1,
    color: 'var(--color-text-muted)',
    cursor: 'crosshair',
    transition: 'color var(--motion-fast), border-color var(--motion-fast), background var(--motion-fast)',
  };

  return (
    <div className="app-titlebar">
      {/* Brand label */}
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
        letterSpacing: 3,
        color: 'var(--color-text-faint)',
        lineHeight: 1,
        pointerEvents: 'none',
      }}>
        LIFE OS
      </span>

      {/* Drag region fills remaining space */}
      <div className="app-titlebar-drag-region" />

      {/* Minimize */}
      <button
        onClick={() => appWindow?.minimize()}
        style={btnBase}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
        }}
        title="Minimize"
      >
        —
      </button>

      {/* Maximize / Restore */}
      <button
        onClick={() => maximized ? appWindow?.unmaximize() : appWindow?.maximize()}
        style={btnBase}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
        }}
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? '❐' : '□'}
      </button>

      {/* Close */}
      <button
        onClick={() => appWindow?.close()}
        style={btnBase}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)';
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-danger)';
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,64,64,0.1)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
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
