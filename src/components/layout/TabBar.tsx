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
    <div className="pip-tabbar" style={{ justifyContent: 'space-between', gap: 12, padding: '0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingRight: 12,
            fontSize: 9,
            fontFamily: 'var(--font-body)',
            color: 'var(--pip-muted)',
            letterSpacing: 2,
            borderRight: '1px solid var(--pip-border)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {pageMeta.sectionLabel}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--pip-bright)', letterSpacing: 2 }}>
            {pageMeta.label}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 9,
              color: 'var(--pip-muted)',
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
          fontFamily: 'var(--font-body)',
          color: apiKey ? 'var(--pip)' : 'var(--pip-muted)',
          letterSpacing: 1,
        }}>
          <span style={{
            width: 6,
            height: 6,
            background: apiKey ? 'var(--pip)' : 'var(--pip-muted)',
            boxShadow: apiKey ? 'var(--pip-glow)' : 'none',
            display: 'inline-block',
          }} />
          {apiKey ? 'ASSIST READY' : 'LOCAL MODE'}
        </div>
      </div>
    </div>
  );
};
