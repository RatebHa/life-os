/**
 * CompletionButton
 *
 * Drop-in replacement for task/habit completion circles.
 * Plays check-pop animation when done.
 * Safe to use as a React.memo'd component — stable callback via props.
 */

import React, { useRef } from 'react';
import { Circle, CheckCircle2 } from 'lucide-react';

interface Props {
  done: boolean;
  onComplete: () => void | Promise<void>;
  onUndo?: () => void | Promise<void>;
  size?: number;
  className?: string;
}

export const CompletionButton: React.FC<Props> = React.memo(({ done, onComplete, onUndo, size = 16, className }) => {
  const firing = useRef(false);

  async function handleClick() {
    if (firing.current) return;
    if (done && !onUndo) return;
    firing.current = true;

    try {
      if (done) {
        await onUndo?.();
      } else {
        await onComplete();
      }
    } finally {
      firing.current = false;
    }
  }

  const isDisabled = done ? !onUndo : false;

  return (
    <div className={`relative flex-shrink-0 ${className ?? ''}`}>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        title={done && onUndo ? 'Undo completion' : 'Complete'}
        className={`text-[var(--color-text-faint)] transition-colors disabled:cursor-default ${
          done
            ? (onUndo ? 'hover:text-[var(--color-warning)]' : '')
            : 'hover:text-green-400'
        }`}
      >
        {done
          ? <CheckCircle2 size={size} className="text-green-400 check-pop" />
          : <Circle size={size} />
        }
      </button>
    </div>
  );
});
