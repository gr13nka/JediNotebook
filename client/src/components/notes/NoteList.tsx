import { useState, useMemo } from 'react';
import { NEU } from '../../utils/shadows';
import { NoteCard } from './NoteCard';
import { NoteEditor } from './NoteEditor';
import { PdfCard } from './PdfCard';
import { PdfViewer } from './PdfViewer';
import { PdfUploadButton } from './PdfUploadButton';
import { useNotes } from '../../hooks/useNotes';
import { usePdfDocuments } from '../../hooks/usePdfDocuments';
import { useTranslation } from '../../i18n/useTranslation';
import type { Note, PdfDocument } from '@shared/types';

type IdeasItem =
  | { type: 'note'; data: Note }
  | { type: 'pdf'; data: PdfDocument };

export function NoteList() {
  const { t } = useTranslation();
  const { notes, createNote, updateNote, deleteNote, togglePin: toggleNotePin } = useNotes();
  const { pdfs, createPdf, deletePdf, togglePin: togglePdfPin } = usePdfDocuments();

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<PdfDocument | null>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);

  const items = useMemo<IdeasItem[]>(() => {
    const all: IdeasItem[] = [
      ...notes.map((n) => ({ type: 'note' as const, data: n })),
      ...pdfs.map((p) => ({ type: 'pdf' as const, data: p })),
    ];
    return all.sort((a, b) => {
      if (a.data.isPinned !== b.data.isPinned) return a.data.isPinned ? -1 : 1;
      return b.data.updatedAt.localeCompare(a.data.updatedAt);
    });
  }, [notes, pdfs]);

  const handleNewNote = () => {
    setEditingNote(null);
    setEditorOpen(true);
  };

  const handleOpenNote = (note: Note) => {
    setEditingNote(note);
    setEditorOpen(true);
  };

  const handleSaveNote = async (data: { title: string; content: string; color: string }) => {
    if (editingNote) {
      await updateNote(editingNote.id, data);
    } else {
      await createNote(data);
    }
  };

  const handleDeleteNote = () => {
    if (editingNote) {
      deleteNote(editingNote.id);
    }
  };

  const handleOpenPdf = (pdf: PdfDocument) => {
    setViewingPdf(pdf);
    setPdfViewerOpen(true);
  };

  const handleDeletePdf = () => {
    if (viewingPdf) {
      deletePdf(viewingPdf.id);
    }
  };

  const handleUploadPdf = async (data: {
    title: string;
    fileName: string;
    fileSize: number;
    pageCount: number;
    pdfData: Blob;
    thumbnail: Blob | null;
  }) => {
    await createPdf(data);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t('ideas.title')}
        </h1>
      </div>

      <div className="columns-2 gap-3">
        {items.map((item) =>
          item.type === 'note' ? (
            <NoteCard
              key={item.data.id}
              note={item.data}
              onClick={() => handleOpenNote(item.data)}
              onTogglePin={() => toggleNotePin(item.data.id)}
            />
          ) : (
            <PdfCard
              key={item.data.id}
              pdf={item.data}
              onClick={() => handleOpenPdf(item.data)}
              onTogglePin={() => togglePdfPin(item.data.id)}
            />
          ),
        )}

        <button
          onClick={handleNewNote}
          className="rounded-2xl p-3 w-full flex items-center justify-center text-sm font-medium text-text-muted hover:text-text-secondary transition-colors mb-3"
          style={{ boxShadow: NEU.pressed, minHeight: '80px' }}
        >
          {t('ideas.new')}
        </button>

        <PdfUploadButton onUpload={handleUploadPdf} />
      </div>

      <NoteEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingNote(null); }}
        onSave={handleSaveNote}
        onDelete={editingNote ? handleDeleteNote : undefined}
        note={editingNote}
      />

      <PdfViewer
        open={pdfViewerOpen}
        onClose={() => { setPdfViewerOpen(false); setViewingPdf(null); }}
        onDelete={viewingPdf ? handleDeletePdf : undefined}
        pdf={viewingPdf}
      />
    </div>
  );
}
