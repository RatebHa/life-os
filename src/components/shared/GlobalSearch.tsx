import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTaskStore } from '../../store/useTaskStore';
import { useGoalStore } from '../../store/useGoalStore';
import { useNoteStore } from '../../store/useNoteStore';
import { useHabitStore } from '../../store/useHabitStore';
import { useInboxStore } from '../../store/useInboxStore';
import { useDomainStore } from '../../store/useDomainStore';
import type { DomainId } from '../../lib/types';
import { getDomainLabel, getDomainThemeStyle } from '../../lib/domain-utils';
import { TextInput } from './form';

interface SearchResult {
  type: 'task' | 'goal' | 'note' | 'habit' | 'inbox' | 'command';
  id: string;
  title: string;
  subtitle: string;
  domain?: DomainId;
  route: string;
  action?: () => Promise<void> | void;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { tasks } = useTaskStore();
  const { goals } = useGoalStore();
  const { notes } = useNoteStore();
  const { habits } = useHabitStore();
  const { items, captureInboxItem } = useInboxStore();
  const domains = useDomainStore((state) => state.domains);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const results: SearchResult[] = React.useMemo(() => {
    const trimmed = query.trim();

    const commandResults: SearchResult[] = [
      {
        type: 'command',
        id: 'open-inbox',
        title: 'OPEN INBOX',
        subtitle: 'COMMAND · REVIEW CAPTURED IDEAS',
        route: '/inbox',
      },
    ];

    if (!trimmed) return commandResults;

    const q = trimmed.toLowerCase();

    const taskResults: SearchResult[] = tasks
      .filter((task) => task.status !== 'archived' && (task.title.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q)))
      .slice(0, 5)
      .map((task) => ({
        type: 'task',
        id: task.id,
        title: task.title,
        subtitle: `${getDomainLabel(task.domain_id, domains)} · ${task.priority} · ${task.status}`,
        domain: task.domain_id,
        route: `/tasks?task=${encodeURIComponent(task.id)}&q=${encodeURIComponent(task.title)}`,
      }));

    const goalResults: SearchResult[] = goals
      .filter((goal) => goal.status !== 'archived' && (goal.title.toLowerCase().includes(q) || goal.description?.toLowerCase().includes(q)))
      .slice(0, 3)
      .map((goal) => ({
        type: 'goal',
        id: goal.id,
        title: goal.title,
        subtitle: `GOAL · ${getDomainLabel(goal.domain_id, domains)} · ${goal.progress_percent}%`,
        domain: goal.domain_id,
        route: `/goals?goal=${encodeURIComponent(goal.id)}`,
      }));

    const noteResults: SearchResult[] = notes
      .filter((note) => note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q))
      .slice(0, 3)
      .map((note) => ({
        type: 'note',
        id: note.id,
        title: note.title,
        subtitle: `NOTE · ${note.domain_id ? getDomainLabel(note.domain_id, domains) : 'GLOBAL'}`,
        domain: note.domain_id ?? undefined,
        route: `/notes?note=${encodeURIComponent(note.id)}`,
      }));

    const habitResults: SearchResult[] = habits
      .filter((habit) => habit.is_active && habit.title.toLowerCase().includes(q))
      .slice(0, 3)
      .map((habit) => ({
        type: 'habit',
        id: habit.id,
        title: habit.title,
        subtitle: `HABIT · ${getDomainLabel(habit.domain_id, domains)} · ${habit.streak_current}D STREAK`,
        domain: habit.domain_id,
        route: `/habits?habit=${encodeURIComponent(habit.id)}`,
      }));

    const inboxResults: SearchResult[] = items
      .filter((item) => item.status !== 'triaged' && item.content.toLowerCase().includes(q))
      .slice(0, 3)
      .map((item) => ({
        type: 'inbox',
        id: item.id,
        title: item.content,
        subtitle: `INBOX · ${item.source_label.replace('_', ' ').toUpperCase()} · ${item.status.toUpperCase()}`,
        domain: item.domain_id ?? undefined,
        route: '/inbox',
      }));

    const captureCommand: SearchResult = {
      type: 'command',
      id: `capture-${trimmed}`,
      title: `CAPTURE "${trimmed.toUpperCase()}"`,
      subtitle: 'COMMAND · SEND DIRECTLY TO INBOX',
      route: '/inbox',
      action: async () => {
        await captureInboxItem({
          content: trimmed,
          source_label: 'manual',
          suggested_kind: 'generic',
        });
      },
    };

    return [captureCommand, ...commandResults, ...taskResults, ...goalResults, ...noteResults, ...habitResults, ...inboxResults].slice(0, 10);
  }, [query, tasks, goals, notes, habits, items, captureInboxItem, domains]);

  const handleSelect = useCallback((result: SearchResult) => {
    Promise.resolve(result.action?.())
      .then(() => {
        navigate(result.route);
        onClose();
      })
      .catch((error) => {
        console.error('[GlobalSearch]', error);
      });
  }, [navigate, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        setSelected((value) => Math.min(value + 1, results.length - 1));
        event.preventDefault();
      }
      if (event.key === 'ArrowUp') {
        setSelected((value) => Math.max(value - 1, 0));
        event.preventDefault();
      }
      if (event.key === 'Enter' && results[selected]) {
        handleSelect(results[selected]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, results, selected, handleSelect, onClose]);

  if (!open) return null;

  const typeColors: Record<SearchResult['type'], string> = {
    task: 'var(--color-accent)',
    goal: 'var(--color-warning)',
    note: 'var(--color-info)',
    habit: 'var(--color-text)',
    inbox: 'var(--color-warning)',
    command: 'var(--color-danger)',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 500,
        background: 'rgba(6,14,6,0.85)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
      }}
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        style={{
          width: 560,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 0 24px rgba(124,108,255,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--color-border)' }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)' }}>?</span>
          <TextInput
            ref={inputRef}
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-regular)', padding: 0 }}
            placeholder="SEARCH TASKS, GOALS, NOTES, HABITS..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
          />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 1 }}>ESC</span>
        </div>

        {results.length > 0 ? (
          <div>
            {results.map((result, index) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result)}
                data-domain={result.domain}
                style={{
                  ...(result.domain ? getDomainThemeStyle(result.domain, domains) : {}),
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) var(--space-4)',
                  borderBottom: '1px solid var(--color-surface-hover)',
                  background: index === selected ? 'var(--color-surface-hover)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'crosshair',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)',
                    color: typeColors[result.type],
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    minWidth: 56,
                  }}
                >
                  {result.type}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {result.title}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 1, marginTop: 1 }}>
                    {result.subtitle}
                  </div>
                </div>
                {index === selected && (
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)' }}>ENTER</span>
                )}
              </button>
            ))}
          </div>
        ) : query.trim() ? (
          <div style={{ padding: 'var(--space-6) var(--space-4)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-regular)', color: 'var(--color-text-muted)', textAlign: 'center', letterSpacing: 1 }}>
            NO RESULTS FOR "{query.toUpperCase()}"
          </div>
        ) : (
          <div style={{ padding: 'var(--space-6) var(--space-4)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', textAlign: 'center', letterSpacing: 1 }}>
            TYPE TO SEARCH ACROSS ALL ENTRIES
          </div>
        )}

        <div style={{ padding: 'var(--space-1) var(--space-4)', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 'var(--space-4)' }}>
          {[['UP/DOWN', 'navigate'], ['ENTER', 'open'], ['ESC', 'close']].map(([key, label]) => (
            <span key={key} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-muted)', letterSpacing: 1 }}>
              {key} · {label.toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
