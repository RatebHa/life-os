import React from 'react';
import { clsx } from 'clsx';

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={clsx('input', className)} {...props} />;
  },
);
TextInput.displayName = 'TextInput';
