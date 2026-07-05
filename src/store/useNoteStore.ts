import { create } from 'zustand';
import type { Note, CreateNotePayload, UpdateNotePayload } from '../lib/types';
import { db } from '../lib/db';
import { useErrorStore } from './useErrorStore';
import { useUndoStore } from './useUndoStore';

interface NoteStore {
  notes: Note[];
  selectedNoteId: string | null;
  searchQuery: string;
  isLoading: boolean;

  loadNotes: () => Promise<void>;
  createNote: (payload: CreateNotePayload) => Promise<Note>;
  updateNote: (payload: UpdateNotePayload) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  selectNote: (id: string | null) => void;
  setSearch: (q: string) => void;

  filteredNotes: () => Note[];
  selectedNote: () => Note | undefined;
}

export const useNoteStore = create<NoteStore>((set, get) => ({
  notes: [],
  selectedNoteId: null,
  searchQuery: '',
  isLoading: false,

  loadNotes: async () => {
    set({ isLoading: true });
    try {
      const notes = await db.getNotes();
      set({ notes });
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createNote: async (payload) => {
    try {
      const note = await db.createNote(payload);
      set((s) => ({ notes: [note, ...s.notes], selectedNoteId: note.id }));
      return note;
    } catch (err) {
      useErrorStore.getState().addError('Failed to create note');
      throw err;
    }
  },

  updateNote: async (payload) => {
    try {
      const updated = await db.updateNote(payload);
      set((s) => ({ notes: s.notes.map((n) => n.id === updated.id ? updated : n) }));
      return updated;
    } catch (err) {
      useErrorStore.getState().addError('Failed to update note');
      throw err;
    }
  },

  deleteNote: async (id) => {
    try {
      const noteSnapshot = get().notes.find((note) => note.id === id);
      await db.deleteNote(id);
      set((s) => ({
        notes: s.notes.filter((n) => n.id !== id),
        selectedNoteId: s.selectedNoteId === id ? null : s.selectedNoteId,
      }));
      if (noteSnapshot) {
        useUndoStore.getState().registerUndo({
          title: 'NOTE DELETED',
          detail: noteSnapshot.title,
          undo: async () => {
            await db.restoreNote(noteSnapshot.id);
            await get().loadNotes();
            get().selectNote(noteSnapshot.id);
          },
        });
      }
    } catch (err) {
      useErrorStore.getState().addError('Failed to delete note');
      throw err;
    }
  },

  selectNote: (id) => set({ selectedNoteId: id }),
  setSearch: (q) => set({ searchQuery: q }),

  filteredNotes: () => {
    const { notes, searchQuery } = get();
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  },

  selectedNote: () => {
    const { notes, selectedNoteId } = get();
    return notes.find((n) => n.id === selectedNoteId);
  },
}));
