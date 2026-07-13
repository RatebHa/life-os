import React from 'react';
import { useLocation } from 'react-router-dom';
import { getNavigationMeta } from '../../lib/navigation';

export const TabBar: React.FC = () => {
  const location = useLocation();
  const pageMeta = getNavigationMeta(location.pathname);

  return (
    <div className="tabbar" style={{ gap: 'var(--space-3)', padding: '0 var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 'var(--space-3)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            paddingRight: 'var(--space-3)',
            fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
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
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
            {pageMeta.label}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)',
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {pageMeta.description}
          </div>
        </div>
      </div>
    </div>
  );
};
