import React from 'react';
import { clsx } from 'clsx';

export interface ToggleChipProps {
  active: boolean;
  onClick: () => void;
  domain?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  children: React.ReactNode;
}

export const ToggleChip: React.FC<ToggleChipProps> = ({ active, onClick, domain, style, disabled, children }) => {
  return (
    <button
      type="button"
      data-domain={domain}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx('toggle-chip', active && 'active')}
      style={style}
    >
      {children}
    </button>
  );
};
