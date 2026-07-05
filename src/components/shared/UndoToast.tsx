import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { useUndoStore } from '../../store/useUndoStore';

const UndoCountdown: React.FC<{ expiresAt: number }> = ({ expiresAt }) => {
  const [remaining, setRemaining] = useState(() => Math.max(expiresAt - Date.now(), 0));

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(Math.max(expiresAt - Date.now(), 0));
    }, 120);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  const pct = Math.max(Math.min((remaining / 8000) * 100, 100), 0);

  return (
    <div className="undo-toast-meter">
      <div className="undo-toast-meter-fill" style={{ width: `${pct}%` }} />
    </div>
  );
};

export const UndoToast: React.FC = () => {
  const entries = useUndoStore((state) => state.entries);
  const undoEntry = useUndoStore((state) => state.undoEntry);
  const dismissUndo = useUndoStore((state) => state.dismissUndo);

  if (entries.length === 0) return null;

  return (
    <div className="undo-toast-stack">
      {entries.map((entry) => (
        <div key={entry.id} className="undo-toast fade-in">
          <div className="undo-toast-head">
            <span className="undo-toast-title">{entry.title}</span>
            <button type="button" className="undo-toast-close" onClick={() => dismissUndo(entry.id)}>
              <X size={12} />
            </button>
          </div>
          <div className="undo-toast-detail">{entry.detail}</div>
          <UndoCountdown expiresAt={entry.expiresAt} />
          <div className="undo-toast-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => undoEntry(entry.id).catch(console.error)}
              disabled={entry.isUndoing}
            >
              <RotateCcw size={12} />
              {entry.isUndoing ? 'UNDOING' : 'UNDO'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
