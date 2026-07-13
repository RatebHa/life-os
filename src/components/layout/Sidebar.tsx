import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { useDomainStore } from '../../store/useDomainStore';
import { StreakFlame } from '../gamification/StreakFlame';
import { getDomainMeta, getDomainThemeStyle } from '../../lib/domain-utils';
import { PRIMARY_NAV_ITEMS, SUPPORT_NAV_ITEMS } from '../../lib/navigation';

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { domains } = useDomainStore();

  const isActive = (path: string) => {
    if (path === '/today') return location.pathname === '/' || location.pathname.startsWith('/today');
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="app-sidebar">
      <div style={{ padding: 'var(--space-3) var(--space-3) var(--space-2)', borderBottom: '1px solid var(--color-border)' }}>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-bold)',
            letterSpacing: '-0.01em',
            color: 'var(--color-text)',
          }}
        >
          LIFE-OS
        </div>
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
            letterSpacing: 2,
            color: 'var(--color-text-muted)',
            marginTop: 2,
          }}
        >
          COMMITMENT WORKSPACE
        </div>
      </div>

      <div className="app-sidebar-scroll">
        <nav style={{ padding: 'var(--space-2) 0', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '0 var(--space-3) 3px',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
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

        <div style={{ margin: '3px var(--space-3)', borderTop: '1px solid var(--color-border)' }} />

        <div style={{ padding: '3px 0', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '0 var(--space-3) 3px',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
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
                  fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)',
                  color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
                  opacity: active ? 1 : 0.82,
                }}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ margin: '3px var(--space-3)', borderTop: '1px solid var(--color-border)' }} />

        <div style={{ padding: '3px 0', display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              padding: '0 var(--space-3) 3px',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
              letterSpacing: 2,
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
            }}
          >
            -- DOMAINS --
          </div>

          {domains.length === 0 ? (
            <div style={{ padding: 'var(--space-2) var(--space-3)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 1 }}>
              NO DOMAINS CONFIGURED. COMPLETE SETUP TO CREATE YOUR FIRST ONE.
            </div>
          ) : domains.map((domain) => {
            const meta = getDomainMeta(domain.id, domains);
            const path = `/domain/${encodeURIComponent(domain.id)}`;
            const active = isActive(path);

            return (
              <button
                key={domain.id}
                data-domain={domain.id}
                className={clsx('nav-item', active && 'active')}
                onClick={() => navigate(path)}
                style={{
                  ...getDomainThemeStyle(domain),
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                }}
              >
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: active ? 'var(--domain-primary)' : 'var(--color-text-muted)' }}>
                  {meta.icon}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-semibold)', color: active ? 'var(--color-text)' : 'var(--color-text-muted)', flex: 1, textAlign: 'left' }}>
                  {meta.label}
                </span>
                <StreakFlame count={domain.streak_current} size="sm" />
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
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 1 }}>
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
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 1 }}>
            CTRL+N
          </span>
        </button>
      </div>
    </aside>
  );
};
