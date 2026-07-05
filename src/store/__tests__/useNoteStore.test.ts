import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useNoteStore } from '../useNoteStore';
import type { Note } from '../../lib/types';

const mockInvoke = vi.mocked(invoke);

const TODAY = new Date().toISOString().slice(0, 10);

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    domain_id: null,
    goal_id: null,
    title: 'Test Note',
    content: 'Some content here',
    tags: '[]',
    pinned: false,
    created_at: `${TODAY}T09:00:00Z`,
    updated_at: `${TODAY}T09:00:00Z`,
    deleted_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  useNoteStore.setState({ notes: [], selectedNoteId: null, searchQuery: '', isLoading: false });
  vi.clearAllMocks();
});

describe('useNoteStore', () => {
  it('initializes with empty state', () => {
    const state = useNoteStore.getState();
    expect(state.notes).toEqual([]);
    expect(state.selectedNoteId).toBeNull();
    expect(state.searchQuery).toBe('');
    expect(state.isLoading).toBe(false);
  });

  it('loadNotes: populates notes array', async () => {
    const notes = [makeNote({ id: 'n1' }), makeNote({ id: 'n2' })];
    mockInvoke.mockResolvedValueOnce(notes);

    await useNoteStore.getState().loadNotes();

    expect(useNoteStore.getState().notes).toHaveLength(2);
    expect(useNoteStore.getState().isLoading).toBe(false);
  });

  it('loadNotes: handles errors gracefully', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('DB error'));

    await useNoteStore.getState().loadNotes();

    expect(useNoteStore.getState().notes).toEqual([]);
  });

  it('createNote: adds note to front and selects it', async () => {
    const existing = makeNote({ id: 'existing' });
    const newNote = makeNote({ id: 'new-note', title: 'Fresh Note' });
    useNoteStore.setState({ notes: [existing] });
    mockInvoke.mockResolvedValueOnce(newNote);

    await useNoteStore.getState().createNote({ title: 'Fresh Note' });

    expect(useNoteStore.getState().notes[0].id).toBe('new-note');
    expect(useNoteStore.getState().selectedNoteId).toBe('new-note');
  });

  it('updateNote: updates matching note in list', async () => {
    const updated = makeNote({ id: 'n1', title: 'Updated Title' });
    useNoteStore.setState({ notes: [makeNote({ id: 'n1', title: 'Old Title' })] });
    mockInvoke.mockResolvedValueOnce(updated);

    await useNoteStore.getState().updateNote({ id: 'n1', title: 'Updated Title' });

    expect(useNoteStore.getState().notes[0].title).toBe('Updated Title');
  });

  it('deleteNote: removes note from list', async () => {
    useNoteStore.setState({ notes: [makeNote({ id: 'n1' }), makeNote({ id: 'n2' })] });
    mockInvoke.mockResolvedValueOnce(undefined);

    await useNoteStore.getState().deleteNote('n1');

    expect(useNoteStore.getState().notes).toHaveLength(1);
    expect(useNoteStore.getState().notes[0].id).toBe('n2');
  });

  it('deleteNote: clears selectedNoteId when deleted note was selected', async () => {
    useNoteStore.setState({ notes: [makeNote({ id: 'n1' })], selectedNoteId: 'n1' });
    mockInvoke.mockResolvedValueOnce(undefined);

    await useNoteStore.getState().deleteNote('n1');

    expect(useNoteStore.getState().selectedNoteId).toBeNull();
  });

  it('deleteNote: preserves selectedNoteId when a different note is deleted', async () => {
    useNoteStore.setState({
      notes: [makeNote({ id: 'n1' }), makeNote({ id: 'n2' })],
      selectedNoteId: 'n2',
    });
    mockInvoke.mockResolvedValueOnce(undefined);

    await useNoteStore.getState().deleteNote('n1');

    expect(useNoteStore.getState().selectedNoteId).toBe('n2');
  });

  it('selectNote: updates selectedNoteId', () => {
    useNoteStore.setState({ notes: [makeNote({ id: 'n1' })], selectedNoteId: null });
    useNoteStore.getState().selectNote('n1');
    expect(useNoteStore.getState().selectedNoteId).toBe('n1');
  });

  it('selectNote: can deselect (set to null)', () => {
    useNoteStore.setState({ selectedNoteId: 'n1' });
    useNoteStore.getState().selectNote(null);
    expect(useNoteStore.getState().selectedNoteId).toBeNull();
  });

  it('setSearch: updates searchQuery', () => {
    useNoteStore.getState().setSearch('hello world');
    expect(useNoteStore.getState().searchQuery).toBe('hello world');
  });

  it('filteredNotes: returns all notes when search is empty', () => {
    useNoteStore.setState({
      notes: [makeNote({ id: 'n1' }), makeNote({ id: 'n2' })],
      searchQuery: '',
    });
    expect(useNoteStore.getState().filteredNotes()).toHaveLength(2);
  });

  it('filteredNotes: filters by title (case-insensitive)', () => {
    useNoteStore.setState({
      notes: [
        makeNote({ id: 'n1', title: 'React Notes' }),
        makeNote({ id: 'n2', title: 'Rust Guide' }),
      ],
      searchQuery: 'react',
    });

    const filtered = useNoteStore.getState().filteredNotes();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('n1');
  });

  it('filteredNotes: filters by content', () => {
    useNoteStore.setState({
      notes: [
        makeNote({ id: 'n1', title: 'Note A', content: 'contains the keyword' }),
        makeNote({ id: 'n2', title: 'Note B', content: 'nothing relevant' }),
      ],
      searchQuery: 'keyword',
    });

    const filtered = useNoteStore.getState().filteredNotes();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('n1');
  });

  it('selectedNote: returns undefined when no selection', () => {
    useNoteStore.setState({ notes: [], selectedNoteId: null });
    expect(useNoteStore.getState().selectedNote()).toBeUndefined();
  });

  it('selectedNote: returns the note matching selectedNoteId', () => {
    useNoteStore.setState({
      notes: [makeNote({ id: 'n1' }), makeNote({ id: 'n2', title: 'Target' })],
      selectedNoteId: 'n2',
    });
    expect(useNoteStore.getState().selectedNote()?.title).toBe('Target');
  });
});
