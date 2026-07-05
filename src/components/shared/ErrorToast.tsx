import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useErrorStore } from '../../store/useErrorStore';

export const ErrorToast: React.FC = () => {
  const { errors, dismissError } = useErrorStore();

  if (errors.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[300] space-y-2 pointer-events-none">
      {errors.map((err) => (
        <div
          key={err.id}
          className="flex items-start gap-2.5 px-3 py-2.5 border fade-in pointer-events-auto"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-danger)',
            clipPath: 'polygon(8px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 8px)',
            boxShadow: '0 0 16px rgba(239, 68, 68, 0.2)',
            maxWidth: 320,
          }}
        >
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-danger)' }} />
          <span className="text-xs text-[var(--color-text)] flex-1 leading-snug">{err.message}</span>
          <button
            onClick={() => dismissError(err.id)}
            className="flex-shrink-0 text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};
