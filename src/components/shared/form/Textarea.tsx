import React from 'react';
import { clsx } from 'clsx';

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return <textarea ref={ref} className={clsx('input', className)} {...props} />;
  },
);
Textarea.displayName = 'Textarea';
