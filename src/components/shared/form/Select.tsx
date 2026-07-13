import React from 'react';
import { clsx } from 'clsx';

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select ref={ref} className={clsx('input', className)} {...props}>
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';
