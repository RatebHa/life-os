import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNoteStore } from '../store/useNoteStore';
import { useTaskStore } from '../store/useTaskStore';
import { useGoalStore } from '../store/useGoalStore';
import { useHabitStore } from '../store/useHabitStore';
import { useInboxStore } from '../store/useInboxStore';
import type { DomainId } from '../lib/types';
import { useSearchParams } from 'react-router-dom';
import { useDomainStore } from '../store/useDomainStore';
import { getDomainLabel } from '../lib/domain-utils';
import { formatDateDisplay, formatDateWithWeekday } from '../lib/date-format';

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const NotesPage: React.FC = () => {
  const {
    notes, loadNotes, createNote, updateNote, deleteNote,
    selectNote, selectedNoteId, searchQuery, setSearch,
    filteredNotes, selectedNote, isLoading,
  } = useNoteStore();
  const { tasks } = useTaskStore();
  const { goals } = useGoalStore();
  const { habits, logs } = useHabitStore();
  const { captureInboxItem } = useInboxStore();
  const domains = useDomainStore((state) => state.domains);
  const [searchParams, setSearchParams] = useSearchParams();

  const [titleDraft, setTitleDraft]     = useState('');
  const [contentDraft, setContentDraft] = useState('');
  const [saveStatus, setSaveStatus]     = useState<'idle' | 'modified' | 'saved'>('idle');
  const [tagInput, setTagInput]         = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const journalCreated = useRef(false);

  // Auto-create daily journal note on first Notes page visit of the day
  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    if (journalCreated.current || isLoading) return;
    const today = new Date().toISOString().slice(0, 10);
    const alreadyExists = notes.some(
      (n) => n.title.startsWith('JOURNAL //') && n.created_at.slice(0, 10) === today
    );
    if (!alreadyExists) {
      journalCreated.current = true;
      const todayDone = tasks.filter((t) => t.status === 'done' && t.completed_at?.slice(0, 10) === today).length;
      const todayHabits = habits.filter((h) => h.is_active);
      const todayHabitsDone = logs.filter((l) => l.completed_date === today).length;
      const dateLabel = formatDateWithWeekday(new Date());
      const prePopulated = [
        `## ${dateLabel}`,
        '',
        `Tasks completed: ${todayDone}`,
        `Habits logged: ${todayHabitsDone}/${todayHabits.length}`,
        '',
        `### REFLECTION`,
        '',
      ].join('\n');
      createNote({
        title: `JOURNAL // ${formatDateDisplay(today)}`,
        content: prePopulated,
        tags: JSON.stringify(['journal', 'daily']),
      }).then((n) => selectNote(n.id)).catch(console.error);
    } else {
      journalCreated.current = true;
    }
  }, [notes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const noteId = searchParams.get('note');
    if (!noteId) return;
    const exists = notes.some((entry) => entry.id === noteId);
    if (!exists) return;
    selectNote(noteId);
  }, [notes, searchParams, selectNote]);

  const note = selectedNote();

  // Sync drafts when selected note changes
  useEffect(() => {
    if (note) {
      setTitleDraft(note.title);
      setContentDraft(note.content);
      setSaveStatus('idle');
      try {
        const tags = JSON.parse(note.tags || '[]') as string[];
        setTagInput(tags.join(', '));
      } catch { setTagInput(''); }
    } else {
      setTitleDraft('');
      setContentDraft('');
      setSaveStatus('idle');
      setTagInput('');
    }
  }, [selectedNoteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduleSave = useCallback((title: string, content: string) => {
    setSaveStatus('modified');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!selectedNoteId) return;
      try {
        await updateNote({ id: selectedNoteId, title, content });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1000);
      } catch { /* error toast already shown */ }
    }, 500);
  }, [selectedNoteId, updateNote]);

  const handleTitleChange = (v: string) => {
    setTitleDraft(v);
    scheduleSave(v, contentDraft);
  };
  const handleContentChange = (v: string) => {
    setContentDraft(v);
    scheduleSave(titleDraft, v);
  };

  const handleNewNote = async () => {
    const n = await createNote({ title: 'NEW ENTRY', content: '' });
    selectNote(n.id);
  };

  const handleDelete = async () => {
    if (!selectedNoteId) return;
    if (!window.confirm('DELETE THIS ENTRY?')) return;
    await deleteNote(selectedNoteId);
  };

  const handleTogglePin = async () => {
    if (!note) return;
    await updateNote({ id: note.id, pinned: !note.pinned });
  };

  const handleSendToInbox = async () => {
    if (!note) return;
    await captureInboxItem({
      content: `${note.title}\n\n${contentDraft}`.trim(),
      domain_id: note.domain_id,
      source_label: 'note',
      suggested_kind: 'generic',
    });
  };

  const filtered = filteredNotes();
  const wordCount = contentDraft.trim() ? contentDraft.trim().split(/\s+/).length : 0;

  return (
    <div className="fade-in" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* ── Left: Note List ────────────────────────────────────────────────── */}
      <div style={{
        width: 260,
        minWidth: 260,
        borderRight: '2px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--color-border)' }}>
          <div className="page-title" style={{ fontSize: 22 }}>NOTES</div>
          <div className="page-subtitle">// FIELD ENTRIES — {notes.length} TOTAL</div>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--color-border)' }}>
          <input
            className="input"
            placeholder="> SEARCH ENTRIES..."
            value={searchQuery}
            onChange={(e) => setSearch(e.target.value)}
            style={{ height: 28, fontSize: 11 }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 10px' }}>
              <div className="empty-state-title">NO ENTRIES</div>
              <span>FOUND<span className="boot-cursor" /></span>
            </div>
          ) : (
            filtered.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  selectNote(n.id);
                  setSearchParams((params) => {
                    const next = new URLSearchParams(params);
                    next.set('note', n.id);
                    return next;
                  });
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--color-surface-hover)',
                  background: selectedNoteId === n.id ? 'var(--color-surface-hover)' : 'transparent',
                  borderLeft: selectedNoteId === n.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                  cursor: 'crosshair',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {n.pinned && <span style={{ color: 'var(--color-warning)', fontSize: 9 }}>PIN</span>}
                  <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    color: selectedNoteId === n.id ? 'var(--color-text)' : 'var(--color-accent)',
                    letterSpacing: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}>
                    {n.title || 'UNTITLED'}
                  </span>
                </div>
                <div style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 10,
                  color: 'var(--color-text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {n.content.slice(0, 60) || '(empty)'}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'var(--font-sans)',
                  fontSize: 9,
                  color: 'var(--color-text-muted)',
                  letterSpacing: 1,
                  flexWrap: 'wrap',
                }}>
                  <span>{relativeTime(n.updated_at)}</span>
                  {n.domain_id && <span style={{ color: 'var(--color-text-faint)' }}>| {getDomainLabel(n.domain_id, domains).toUpperCase()}</span>}
                  {(() => {
                    try {
                      const tags = JSON.parse(n.tags || '[]') as string[];
                      return tags.slice(0, 2).map((t) => (
                        <span key={t} style={{
                          background: 'var(--color-surface-hover)',
                          border: '1px solid var(--color-border)',
                          padding: '0 3px',
                          fontSize: 8,
                          color: 'var(--color-text-muted)',
                        }}>
                          {t}
                        </span>
                      ));
                    } catch { return null; }
                  })()}
                </div>
              </button>
            ))
          )}
        </div>

        {/* New Note Button */}
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--color-border)' }}>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleNewNote}>
            [+ NEW ENTRY]
          </button>
        </div>
      </div>

      {/* ── Right: Editor ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {note ? (
          <>
            {/* Title input */}
            <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--color-border)' }}>
              <input
                value={titleDraft}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="ENTRY TITLE"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 24,
                  color: 'var(--color-text)',
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                }}
              />
            </div>

            {/* Metadata bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '5px 16px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-hover)',
              flexWrap: 'wrap',
            }}>
              {/* Domain selector */}
              <select
                className="input"
                value={note.domain_id ?? ''}
                onChange={(e) => updateNote({ id: note.id, domain_id: e.target.value as DomainId | '' })}
                style={{ height: 24, fontSize: 9, width: 'auto', minWidth: 100, padding: '0 6px' }}
              >
                <option value="">ALL DOMAINS</option>
                {domains.map((domain) => <option key={domain.id} value={domain.id}>{getDomainLabel(domain.id, domains).toUpperCase()}</option>)}
              </select>

              {/* Pin toggle */}
              <button
                className={`btn btn-sm ${note.pinned ? 'btn-primary' : 'btn-ghost'}`}
                onClick={handleTogglePin}
              >
                {note.pinned ? '[PINNED]' : 'PIN'}
              </button>

              {/* Tags input */}
              <input
                className="input"
                placeholder="TAGS (comma separated)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onBlur={() => {
                  if (!note) return;
                  const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
                  updateNote({ id: note.id, tags: JSON.stringify(tags) }).catch(console.error);
                }}
                style={{ height: 24, fontSize: 9, width: 150, padding: '0 6px' }}
              />

              {/* Goal link */}
              <select
                className="input"
                value={note.goal_id ?? ''}
                onChange={(e) => updateNote({ id: note.id, goal_id: e.target.value || '' }).catch(console.error)}
                style={{ height: 24, fontSize: 9, width: 'auto', minWidth: 100, padding: '0 6px' }}
                title="Link note to goal"
              >
                <option value="">NO GOAL LINK</option>
                {goals.filter((g) => g.status === 'active').map((g) => (
                  <option key={g.id} value={g.id}>{g.title.slice(0, 32)}</option>
                ))}
              </select>

              {/* Delete */}
              <button className="btn btn-sm btn-ghost" onClick={() => handleSendToInbox().catch(console.error)}>INBOX</button>
              <button className="btn btn-sm btn-danger" onClick={handleDelete}>DEL</button>

              <div style={{ flex: 1 }} />

              {/* Save status */}
              <span style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 9,
                letterSpacing: 1.5,
                color: saveStatus === 'modified' ? 'var(--color-warning)'
                     : saveStatus === 'saved'    ? 'var(--color-text-muted)'
                     : 'transparent',
                textTransform: 'uppercase',
              }}>
                {saveStatus === 'modified' ? '● MODIFIED' : saveStatus === 'saved' ? '✓ SAVED' : '.'}
              </span>
            </div>

            {/* Content textarea */}
            <textarea
              value={contentDraft}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="> BEGIN ENTRY..."
              style={{
                flex: 1,
                width: '100%',
                background: 'var(--color-bg)',
                border: 'none',
                outline: 'none',
                padding: '14px 18px',
                fontFamily: 'var(--font-sans)',
                fontSize: 12,
                color: 'var(--color-accent)',
                resize: 'none',
                lineHeight: 1.7,
              }}
            />

            {/* Footer */}
            <div style={{
              padding: '5px 16px',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-surface-hover)',
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-sans)',
              fontSize: 9,
              color: 'var(--color-text-muted)',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}>
              <span>{wordCount} WORDS</span>
              <span>UPDATED: {relativeTime(note.updated_at)}</span>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ height: '100%' }}>
            <div className="empty-state-title">NO ENTRY SELECTED</div>
            <span>{'> SELECT AN ENTRY OR CREATE NEW'}<span className="boot-cursor" /></span>
          </div>
        )}
      </div>
    </div>
  );
};
