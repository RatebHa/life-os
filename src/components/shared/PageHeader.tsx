import React from 'react';
import { clsx } from 'clsx';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  subtitleClassName?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className,
  titleClassName,
  subtitleClassName,
}) => (
  <div className={clsx('page-header', className)}>
    <div className="page-header-copy">
      <div className={clsx('page-title', titleClassName)}>{title}</div>
      {subtitle ? <div className={clsx('page-subtitle', subtitleClassName)}>{subtitle}</div> : null}
    </div>
    {actions ? <div className="page-header-actions">{actions}</div> : null}
  </div>
);
