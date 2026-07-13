import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { TitleBar } from './components/layout/TitleBar';
import { TopBar } from './components/layout/TopBar';
import { TabBar } from './components/layout/TabBar';
import { FooterBar } from './components/layout/FooterBar';
import { CommandCenter } from './pages/CommandCenter';
import { TodayPage } from './pages/Today';
import { TasksPage } from './pages/Tasks';
import { HabitsPage } from './pages/Habits';
import { GoalsPage } from './pages/Goals';
import { AnalyticsPage } from './pages/Analytics';
import { DomainPage } from './pages/DomainPage';
import { SettingsPage } from './pages/Settings';
import { NotesPage } from './pages/Notes';
import { CalendarPage } from './pages/Calendar';
import { WeeklyReviewPage } from './pages/WeeklyReview';
import { InboxPage } from './pages/Inbox';
import { TemplatesPage } from './pages/Templates';
import { ErrorToast } from './components/shared/ErrorToast';
import { DebugConsole } from './components/shared/DebugConsole';
import { UndoToast } from './components/shared/UndoToast';
import { GlobalSearch } from './components/shared/GlobalSearch';
import { FocusTimer } from './components/shared/FocusTimer';
import { QuickCapture } from './components/shared/QuickCapture';
import { Modal } from './components/shared/Modal';
import { RouteErrorBoundary } from './components/shared/RouteErrorBoundary';
import { Onboarding } from './components/Onboarding';
import { useDomainStore } from './store/useDomainStore';
import { useTaskStore } from './store/useTaskStore';
import { useHabitStore } from './store/useHabitStore';
import { useGoalStore } from './store/useGoalStore';
import { useAppStore } from './store/useAppStore';
import { useNoteStore } from './store/useNoteStore';
import { useInboxStore } from './store/useInboxStore';
import { useTemplateStore } from './store/useTemplateStore';
import { useFocusStore } from './store/useFocusStore';
import { useFrictionStore } from './store/useFrictionStore';
import { useTimerStore } from './store/useTimerStore';
import { useDebugStore } from './store/useDebugStore';
import { useUndoStore } from './store/useUndoStore';
import { db } from './lib/db';
import { PAGE_SHORTCUTS, SHORTCUT_ITEMS } from './lib/navigation';
import type { DomainId } from './lib/types';
import { syncService } from './lib/sync/service';
import { LIFE_OS_SYNC_DIRTY_EVENT } from './lib/sync/events';

const BOOT_STEPS = [
  'MOUNTING LOCAL DATABASE',
  'VERIFYING DOMAIN TELEMETRY',
  'LOADING TODAY BOARD',
  'PREPARING INTERFACE',
  'READYING COMMAND GRID',
] as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function resolveShellDomain(pathname: string): DomainId | null {
  const match = pathname.match(/^\/domain\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

function buildDisplayVariables(
  textScale: 'normal' | 'large' | 'xl' | undefined,
  uiDensity: 'compact' | 'comfortable' | undefined,
): React.CSSProperties {
  const scaleMap = {
    normal: { body: '1', panel: '1', display: '1' },
    large: { body: '1.08', panel: '1.1', display: '1.08' },
    xl: { body: '1.16', panel: '1.2', display: '1.14' },
  } as const;
  // comfortable values must match --page-padding/--panel-padding defaults in tokens.css
  const densityMap = {
    compact: { page: '16px 16px', panel: '8px 12px', row: '28px' },
    comfortable: { page: '16px 24px', panel: '12px 12px', row: '34px' },
  } as const;

  const scale = scaleMap[textScale ?? 'normal'];
  const density = densityMap[uiDensity ?? 'comfortable'];

  return {
    ['--body-scale' as string]: scale.body,
    ['--panel-scale' as string]: scale.panel,
    ['--display-scale' as string]: scale.display,
    ['--page-padding' as string]: density.page,
    ['--panel-padding' as string]: density.panel,
    ['--row-height' as string]: density.row,
  };
}

const BootScreen: React.FC = () => {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIndex((current) => Math.min(current + 1, BOOT_STEPS.length - 1));
    }, 240);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="boot-screen fixed inset-0" style={{ background: 'var(--color-bg)' }}>
      <div className="boot-shell">
        <div className="boot-header">
          <div className="boot-brand">LIFE OS</div>
          <div className="boot-subtitle">PREPARING YOUR WORKSPACE</div>
        </div>
        <div className="boot-grid">
          <div className="boot-panel">
            <div className="boot-panel-title">BOOT SEQUENCE</div>
            <div className="boot-log">
              {BOOT_STEPS.map((step, index) => (
                <div key={step} className={'boot-log-line' + (index <= stepIndex ? ' active' : '')}>
                  <span>[{index <= stepIndex ? 'OK' : '..'}]</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="boot-panel">
            <div className="boot-panel-title">SYSTEM LINK</div>
            <div className="boot-stat"><span>DOMAIN GRID</span><span>ONLINE</span></div>
            <div className="boot-stat"><span>PROFILE</span><span>LOCAL-FIRST</span></div>
            <div className="boot-stat"><span>STATUS</span><span>INITIALIZING</span></div>
            <div className="boot-progress">
              <div className="boot-progress-fill" style={{ width: `${((stepIndex + 1) / BOOT_STEPS.length) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="boot-footer">
          <span>SYSTEM INITIALIZING</span>
          <span className="boot-cursor" />
        </div>
      </div>
    </div>
  );
};

const ShortcutsOverlay: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <Modal open={open} onClose={onClose} title="KEYBOARD SHORTCUTS">
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      {SHORTCUT_ITEMS.map((shortcut) => (
        <div key={shortcut.keys} className="card" style={{ margin: 0 }}>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', letterSpacing: 2 }}>
              {shortcut.keys}
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 1 }}>
              {shortcut.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  </Modal>
);

const AppInner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { loadDomains } = useDomainStore();
  const { loadTasks } = useTaskStore();
  const { loadHabits } = useHabitStore();
  const { loadGoals } = useGoalStore();
  const { loadAppState, appState } = useAppStore();
  const { loadNotes } = useNoteStore();
  const { loadInbox } = useInboxStore();
  const { loadTaskTemplates } = useTemplateStore();
  const { loadFocusSessions } = useFocusStore();
  const loadFocusDrafts = useTimerStore((state) => state.loadDrafts);
  const { loadTaskFrictionLogs } = useFrictionStore();
  const addDebugEntry = useDebugStore((state) => state.addEntry);
  const toggleDebugOpen = useDebugStore((state) => state.toggleOpen);
  const undoLatest = useUndoStore((state) => state.undoLatest);
  const [booted, setBooted] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const autoBackupCheckedRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const syncPendingRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const bootSyncedSessionRef = useRef<string | null>(null);
  const appStateRef = useRef(appState);
  const shellDomain = resolveShellDomain(location.pathname);
  const displayVariables = useMemo(
    () => buildDisplayVariables(appState?.text_scale, appState?.ui_density),
    [appState?.text_scale, appState?.ui_density],
  );

  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    const previousLang = document.documentElement.lang;
    document.documentElement.lang = 'en-GB';

    return () => {
      document.documentElement.lang = previousLang;
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((open) => !open);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setCaptureOpen((open) => !open);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z' && !isTypingTarget(e.target)) {
        e.preventDefault();
        undoLatest().catch(console.error);
        return;
      }
      if (e.altKey && PAGE_SHORTCUTS[e.key]) {
        e.preventDefault();
        navigate(PAGE_SHORTCUTS[e.key]);
        return;
      }
      if (!isTypingTarget(e.target) && e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((open) => !open);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        toggleDebugOpen();
        return;
      }
      if (e.key === 'Escape') {
        setShortcutsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, toggleDebugOpen, undoLatest]);

  useEffect(() => {
    addDebugEntry({
      level: 'info',
      scope: 'router',
      message: `Navigated to ${location.pathname}`,
    });
  }, [addDebugEntry, location.pathname]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      addDebugEntry({
        level: 'error',
        scope: 'window.onerror',
        message: event.message || 'Unknown runtime error',
        detail: [event.filename, event.lineno ? `line ${event.lineno}` : null, event.colno ? `col ${event.colno}` : null]
          .filter(Boolean)
          .join(' :: '),
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      const detail = event.reason instanceof Error && event.reason.stack ? event.reason.stack : undefined;
      addDebugEntry({
        level: 'error',
        scope: 'unhandledrejection',
        message: reason,
        detail,
      });
    };

    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const [first, ...rest] = args;
      const message = typeof first === 'string'
        ? first
        : first instanceof Error
          ? first.message
          : JSON.stringify(first);
      const detail = rest.map((item) => {
        if (item instanceof Error) return item.stack || item.message;
        if (typeof item === 'string') return item;
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      }).join('\n');

      addDebugEntry({
        level: 'error',
        scope: 'console.error',
        message,
        detail: detail || undefined,
      });
      originalConsoleError(...args);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      console.error = originalConsoleError;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [addDebugEntry]);

  useEffect(() => {
    Promise.all([
      loadDomains(),
      loadTasks(),
      loadHabits(),
      loadGoals(),
      loadAppState(),
      loadNotes(),
      loadInbox(),
      loadTaskTemplates(),
      loadFocusSessions(),
      loadFocusDrafts(),
      loadTaskFrictionLogs(),
      db.updateLastOpened(),
    ])
      .then(() => {
        setBooted(true);
      })
      .catch((err) => {
        console.error('[boot] hydration failed:', err);
        setBooted(true);
      });
  }, []);

  useEffect(() => () => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
    }
  }, []);

  const reloadSyncedData = async () => {
    await Promise.all([
      loadDomains(),
      loadTasks(),
      loadHabits(),
      loadGoals(),
      loadNotes(),
      loadInbox(),
      loadAppState(),
    ]);
  };

  const runAutoSync = async () => {
    const currentState = appStateRef.current;
    if (!booted || !currentState || !syncService.hasSession(currentState)) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      syncPendingRef.current = true;
      return;
    }
    if (syncInFlightRef.current) {
      syncPendingRef.current = true;
      return;
    }

    syncInFlightRef.current = true;
    syncPendingRef.current = false;
    try {
      await syncService.syncNow(currentState);
      await reloadSyncedData();
    } catch (err) {
      console.error('[sync] auto sync failed:', err);
    } finally {
      syncInFlightRef.current = false;
      if (syncPendingRef.current && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
        syncPendingRef.current = false;
        void runAutoSync();
      }
    }
  };

  const scheduleAutoSync = (immediate = false) => {
    const currentState = appStateRef.current;
    if (!booted || !currentState || !syncService.hasSession(currentState)) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      syncPendingRef.current = true;
      return;
    }

    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    if (immediate) {
      void runAutoSync();
      return;
    }

    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null;
      void runAutoSync();
    }, 900);
  };

  useEffect(() => {
    if (!booted || autoBackupCheckedRef.current || !appState?.auto_backup_enabled) {
      return;
    }

    autoBackupCheckedRef.current = true;
    const today = new Date().toISOString().slice(0, 10);
    if (appState.last_backup_at?.slice(0, 10) === today) {
      return;
    }

    db.createBackup()
      .then(() => loadAppState())
      .catch((err) => {
        console.error('[backup] auto backup failed:', err);
      });
  }, [booted, appState?.auto_backup_enabled, appState?.last_backup_at, loadAppState]);

  useEffect(() => {
    if (!booted) {
      return;
    }

    if (!appState || !syncService.hasSession(appState)) {
      bootSyncedSessionRef.current = null;
      syncPendingRef.current = false;
      return;
    }

    const sessionKey = [
      appState.sync_user_id ?? '',
      appState.sync_refresh_token ?? '',
      appState.sync_supabase_url ?? '',
    ].join('::');

    if (bootSyncedSessionRef.current === sessionKey) {
      return;
    }

    bootSyncedSessionRef.current = sessionKey;
    scheduleAutoSync(true);
  }, [
    booted,
    appState?.sync_user_id,
    appState?.sync_refresh_token,
    appState?.sync_supabase_url,
  ]);

  useEffect(() => {
    const handleDirty = () => {
      scheduleAutoSync();
    };

    const handleOnline = () => {
      scheduleAutoSync(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        scheduleAutoSync(true);
        return;
      }
      if (document.visibilityState === 'hidden') {
        scheduleAutoSync(true);
      }
    };

    const handleBeforeUnload = () => {
      scheduleAutoSync(true);
    };

    window.addEventListener(LIFE_OS_SYNC_DIRTY_EVENT, handleDirty as EventListener);
    window.addEventListener('online', handleOnline);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener(LIFE_OS_SYNC_DIRTY_EVENT, handleDirty as EventListener);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [booted, appState?.sync_user_id, appState?.sync_refresh_token, appState?.sync_supabase_url]);

  if (!booted) return <BootScreen />;

  return (
    <div
      className="app-shell"
      data-domain={shellDomain ?? undefined}
      data-scale={appState?.text_scale ?? 'normal'}
      data-density={appState?.ui_density ?? 'comfortable'}
      style={displayVariables}
    >
      <TitleBar />
      <TopBar />
      <TabBar />
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/overview" element={<CommandCenter />} />
          <Route path="/command-center" element={<Navigate to="/overview" replace />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/domain/:domainId" element={<DomainPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/review" element={<Navigate to="/weekly-review" replace />} />
          <Route
            path="/weekly-review"
            element={(
              <RouteErrorBoundary scope="weekly-review">
                <WeeklyReviewPage />
              </RouteErrorBoundary>
            )}
          />
          <Route path="/templates" element={<TemplatesPage />} />
        </Routes>
      </main>
      <FooterBar />
      <ErrorToast />
      <UndoToast />
      <DebugConsole />
      <FocusTimer />
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <Onboarding />
    </div>
  );
};

const App: React.FC = () => (
  <BrowserRouter>
    <RouteErrorBoundary scope="app-shell">
      <AppInner />
    </RouteErrorBoundary>
  </BrowserRouter>
);

export default App;
