import React from 'react';

interface StreakFlameProps {
  count: number;
  size?: 'sm' | 'md' | 'lg';
}

export const StreakFlame: React.FC<StreakFlameProps> = React.memo(({ count, size = 'sm' }) => {
  const fontSizes = { sm: 14, md: 18, lg: 22 };
  const fontSize = fontSizes[size];

  return (
    <span style={{
      fontFamily: 'var(--font-display)',
      fontSize,
      color: count > 0 ? 'var(--pip-bright)' : 'var(--pip-muted)',
      letterSpacing: 1,
      lineHeight: 1,
    }}>
      {count > 0 ? `${count}D` : '0D'}
    </span>
  );
});

StreakFlame.displayName = 'StreakFlame';
