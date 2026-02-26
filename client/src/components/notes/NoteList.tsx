import { useState } from 'react';
import { NEU } from '../../utils/shadows';
import { stripMarkdown } from '../../utils/markdown';
import { NoteEditor } from './NoteEditor';
import { useNotes } from '../../hooks/useNotes';
import { useTranslation } from '../../i18n/useTranslation';
import { NOTE_COLORS } from '@shared/constants';
import type { Note } from '@shared/types';

const PinIcon = ({ filled }: { filled: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 17v5" />
    <path d="M5 12h14" />
    <rect x="7" y="4" width="10" height="8" rx="1" />
  </svg>
);

export function NoteList() {
  const { t } = useTranslation();
  const { notes, createNote, updateNote, deleteNote, togglePin } = useNotes();
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const handleNew = () => {
    setEditingNote(null);
    setEditorOpen(true);
  };

  const handleOpen = (note: Note) => {
    setEditingNote(note);
    setEditorOpen(true);
  };

  const handleSave = async (data: { title: string; content: string; color: string }) => {
    if (editingNote) {
      await updateNote(editingNote.id, data);
    } else {
      await createNote(data);
    }
  };

  const handleDelete = () => {
    if (editingNote) {
      deleteNote(editingNote.id);
    }
  };

  const sorted = [...notes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return 0;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t('ideas.title')}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {sorted.map((n) => (
          <div
            key={n.id}
            onClick={() => handleOpen(n)}
            className="rounded-2xl bg-bg-card p-3 cursor-pointer"
            style={{ boxShadow: NEU.raised }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: n.color }}
              />
              <span className="text-sm font-medium text-text-primary truncate flex-1">
                {n.title || t('ideas.untitled')}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); togglePin(n.id); }}
                className={`p-0.5 rounded transition-colors shrink-0 ${
                  n.isPinned ? 'text-accent' : 'text-text-muted/40'
                }`}
              >
                <PinIcon filled={n.isPinned} />
              </button>
            </div>
            {n.content && (
              <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
                {stripMarkdown(n.content)}
              </p>
            )}
          </div>
        ))}

        <button
          onClick={handleNew}
          className="rounded-2xl p-3 flex items-center justify-center text-sm font-medium text-text-muted hover:text-text-secondary transition-colors"
          style={{ boxShadow: NEU.pressed, minHeight: '80px' }}
        >
          {t('ideas.new')}
        </button>
      </div>

      <NoteEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingNote(null); }}
        onSave={handleSave}
        onDelete={editingNote ? handleDelete : undefined}
        note={editingNote}
      />
    </div>
  );
}
