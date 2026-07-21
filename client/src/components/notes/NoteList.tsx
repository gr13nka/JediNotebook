import { useState } from 'react';
import { NEU } from '../../utils/shadows';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { useNotes } from '../../hooks/useNotes';
import { useTranslation } from '../../i18n/useTranslation';
import { IDEAS_FROZEN } from '@shared/constants';
import type { Note } from '@shared/types';

export function NoteList() {
  const { t } = useTranslation();
  const { notes, createNote, updateNote, deleteNote, togglePin } = useNotes();

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const handleNewNote = () => {
    setEditingNote(null);
    setEditorOpen(true);
  };

  const handleOpenNote = (note: Note) => {
    setEditingNote(note);
    setEditorOpen(true);
  };

  const handleDeleteNote = () => {
    if (editingNote) {
      deleteNote(editingNote.id);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t('ideas.title')}
        </h1>
      </div>

      {IDEAS_FROZEN && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-500/10 text-amber-600 text-xs">
          {t('ideas.frozen')}
        </div>
      )}

      <div className="columns-2 gap-3">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onClick={() => handleOpenNote(note)}
            onTogglePin={IDEAS_FROZEN ? undefined : () => togglePin(note.id)}
          />
        ))}

        {!IDEAS_FROZEN && (
          <button
            onClick={handleNewNote}
            className="rounded-2xl p-3 w-full flex items-center justify-center text-sm font-medium text-text-muted hover:text-text-secondary transition-colors mb-3"
            style={{ boxShadow: NEU.pressed, minHeight: '80px' }}
          >
            {t('ideas.new')}
          </button>
        )}
      </div>

      <NoteEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingNote(null); }}
        createNote={createNote}
        updateNote={updateNote}
        onDelete={IDEAS_FROZEN || !editingNote ? undefined : handleDeleteNote}
        note={editingNote}
      />
    </div>
  );
}
