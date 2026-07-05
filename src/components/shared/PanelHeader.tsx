import React from 'react';
import { clsx } from 'clsx';

interface PanelHeaderProps {
  title: React.ReactNode;
  meta?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  titleClassName?: string;
  metaClassName?: string;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  meta,
  right,
  className,
  style,
  titleClassName,
  metaClassName,
}) => (
  <div className={clsx('card-header', className)} style={style}>
    <span className={clsx('card-title', titleClassName)}>{title}</span>
    {right ?? (meta ? <span className={clsx('card-meta', metaClassName)}>{meta}</span> : null)}
  </div>
);
