import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useDomainStore } from '../../store/useDomainStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useHabitStore } from '../../store/useHabitStore';
import { useFocusStore } from '../../store/useFocusStore';
import { StreakFlame } from '../gamification/StreakFlame';
import { getDomainMeta, getDomainThemeStyle } from '../../lib/domain-utils';
import { PRIMARY_NAV_ITEMS, SUPPORT_NAV_ITEMS } from '../../lib/navigation';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { domains } = useDomainStore();
  const tasks = useTaskStore((state) => state.tasks);
  const habits = useHabitStore((state) => state.habits);
  const sessions = useFocusStore((state) => state.sessions);
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);

  const isActive = (path: string) => {
    if (path === '/today') return location.pathname === '/' || location.pathname.startsWith('/today');
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="app-sidebar">
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--color-border)' }}>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--color-text)',
          }}
        >
          LIFE-OS
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 9,
            letterSpacing: 2,
            color: 'var(--color-text-muted)',
            marginTop: 2,
          }}
        >
          COMMITMENT WORKSPACE
        </div>
        <div
          style={{
            marginTop: 6,
            padding: '2px 6px',
            border: '1px solid var(--color-border)',
            fontSize: 9,
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-text-muted)',
            letterSpacing: 1,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>SYS</span>
          <span style={{ color: 'var(--color-success)' }}>ONLINE</span>
        </div>
      </div>

      <div className="app-sidebar-scroll">
        <nav style={{ padding: '6px 0', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '0 12px 3px',
              fontFamily: 'var(--font-sans)',
              fontSize: 9,
              letterSpacing: 2,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
            }}
          >
            -- WORKSPACE --
          </div>

          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                className={clsx('nav-item', active && 'active')}
                onClick={() => navigate(item.path)}
                title={item.description}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ margin: '3px 12px', borderTop: '1px solid var(--color-border)' }} />

        <div style={{ padding: '3px 0', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '0 12px 3px',
              fontFamily: 'var(--font-sans)',
              fontSize: 9,
              letterSpacing: 2,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
            }}
          >
            -- SUPPORT --
          </div>

          {SUPPORT_NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                className={clsx('nav-item', active && 'active')}
                onClick={() => navigate(item.path)}
                title={item.description}
                style={{
                  fontSize: 11,
                  color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                  opacity: active ? 1 : 0.82,
                }}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ margin: '3px 12px', borderTop: '1px solid var(--color-border)' }} />

        <div style={{ padding: '3px 0', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '0 12px 3px',
              fontFamily: 'var(--font-sans)',
              fontSize: 9,
              letterSpacing: 2,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
            }}
          >
            -- DOMAINS --
          </div>

          {domains.length === 0 ? (
            <div style={{ padding: '8px 12px', fontFamily: 'var(--font-sans)', fontSize: 9, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
              NO DOMAINS CONFIGURED. COMPLETE SETUP TO CREATE YOUR FIRST ONE.
            </div>
          ) : domains.map((domain) => {
            const meta = getDomainMeta(domain.id, domains);
            const path = `/domain/${encodeURIComponent(domain.id)}`;
            const active = isActive(path);
            const activeCommitments = tasks.filter((task) => task.domain_id === domain.id && task.status !== 'done' && task.status !== 'archived' && task.task_kind !== 'recurring_template').length;
            const completedThisWeek = tasks.filter((task) => {
              const completedDay = task.completed_at?.slice(0, 10);
              return task.domain_id === domain.id && task.status === 'done' && Boolean(completedDay && completedDay >= weekStart);
            }).length;
            const overdueCount = tasks.filter((task) => task.domain_id === domain.id && task.status !== 'done' && task.status !== 'archived' && task.due_date && task.due_date.slice(0, 10) < today).length;
            const activeHabits = habits.filter((habit) => habit.domain_id === domain.id && habit.is_active).length;
            const focusMinutes = sessions
              .filter((session) => session.domain_id === domain.id && session.started_at.slice(0, 10) >= weekStart)
              .reduce((sum, session) => sum + session.actual_minutes, 0);

            return (
              <button
                key={domain.id}
                data-domain={domain.id}
                className={clsx('nav-item', active && 'active')}
                onClick={() => navigate(path)}
                style={{
                  ...getDomainThemeStyle(domain),
                  height: 'auto',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  padding: '6px 12px',
                }}
              >
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, color: active ? 'var(--domain-primary)' : 'var(--color-text-muted)', letterSpacing: 1 }}>
                      {meta.icon}
                    </span>
                    <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 600, color: active ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                      {meta.label}
                    </span>
                    <StreakFlame count={domain.streak_current} size="sm" />
                  </div>

                  <div
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 9,
                      color: 'var(--color-text-muted)',
                      letterSpacing: 1,
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 4,
                    }}
                  >
                    <span>OPEN: {activeCommitments}</span>
                    <span>DONE: {completedThisWeek}</span>
                    <span>OVERDUE: {overdueCount}</span>
                    <span>FOCUS: {focusMinutes}M</span>
                    <span>HABITS: {activeHabits}</span>
                    <span>STREAK: {domain.streak_current}D</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="app-sidebar-actions">
        <button
          className="nav-item"
          onClick={() =>
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))
          }
          title="Search (Ctrl+K)"
        >
          <span>SEARCH</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 8, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
            CTRL+K
          </span>
        </button>
        <button
          className="nav-item"
          onClick={() =>
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true, bubbles: true }))
          }
          title="Quick Capture (Ctrl+N)"
        >
          <span>CAPTURE</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 8, color: 'var(--color-text-muted)', letterSpacing: 1 }}>
            CTRL+N
          </span>
        </button>
      </div>
    </aside>
  );
};
