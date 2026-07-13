import React from 'react';

interface StreakFlameProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
}

export const StreakFlame: React.FC<StreakFlameProps> = React.memo(({ count, size = 'sm' }) => {
  const fontSizes = { sm: 'var(--text-sm)', md: 'var(--text-lg)', lg: 'var(--text-lg)' };
  const fontSize = fontSizes[size];

  return (
    <span style={{
      fontFamily: 'var(--font-sans)',
      fontWeight: 'var(--font-weight-semibold)',
      fontSize,
      color: count > 0 ? 'var(--color-warning)' : 'var(--color-text-faint)',
      lineHeight: 1,
    }}>
      {count > 0 ? `${count}D` : '0D'}
    </span>
  );
});

StreakFlame.displayName = 'StreakFlame';
