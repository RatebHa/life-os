import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getNavigationMeta } from '../../lib/navigation';

export const TabBar: React.FC<{ apiKey?: string }> = ({ apiKey }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pageMeta = getNavigationMeta(location.pathname);
  const onToday = location.pathname === '/' || location.pathname.startsWith('/today');
  const onOverview = location.pathname.startsWith('/overview') || location.pathname.startsWith('/command-center');

  return (
    <div className="tabbar" style={{ justifyContent: 'space-between', gap: 12, padding: '0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingRight: 12,
            fontSize: 9,
            fontFamily: 'var(--font-sans)',
            color: 'var(--color-text-muted)',
            letterSpacing: 2,
            borderRight: '1px solid var(--color-border)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {pageMeta.sectionLabel}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 18, color: 'var(--color-text)', letterSpacing: 2 }}>
            {pageMeta.label}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 9,
              color: 'var(--color-text-muted)',
              letterSpacing: 1,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {pageMeta.description}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {!onToday && (
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/today')}>
            OPEN TODAY
          </button>
        )}
        {!onOverview && (
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/overview')}>
            OVERVIEW
          </button>
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 9,
          fontFamily: 'var(--font-sans)',
          color: apiKey ? 'var(--color-accent)' : 'var(--color-text-muted)',
          letterSpacing: 1,
        }}>
          <span style={{
            width: 6,
            height: 6,
            background: apiKey ? 'var(--color-accent)' : 'var(--color-text-muted)',
            boxShadow: apiKey ? 'var(--shadow-focus-ring)' : 'none',
            display: 'inline-block',
          }} />
          {apiKey ? 'ASSIST READY' : 'LOCAL MODE'}
        </div>
      </div>
    </div>
  );
};
