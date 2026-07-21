import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/Button';
import { NEU } from '../../utils/shadows';
import { renderLineMd } from '../../utils/markdown';
import { useTranslation } from '../../i18n/useTranslation';
import { NOTE_COLORS, IDEAS_FROZEN } from '@shared/constants';
import type { Note } from '@shared/types';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

interface NoteEditorProps {
  open: boolean;
  onClose: () => void;
  createNote: (data: { title: string; content: string; color: string }) => Promise<Note>;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'content' | 'color'>>) => Promise<void>;
  onDelete?: () => void;
  note?: Note | null;
}

function splitLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length === 0) return [''];
  return lines;
}

function getLineInputStyle(line: string): React.CSSProperties {
  const base: React.CSSProperties = { lineHeight: '1.625' };
  if (/^# /.test(line)) return { ...base, fontSize: '1.25rem', fontWeight: 700 };
  if (/^## /.test(line)) return { ...base, fontSize: '1.1rem', fontWeight: 600 };
  if (/^### /.test(line)) return { ...base, fontSize: '1rem', fontWeight: 600 };
  return base;
}

const autoResize = (el: HTMLTextAreaElement) => {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

export function NoteEditor({ open, onClose, createNote, updateNote, onDelete, note }: NoteEditorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState<string[]>(['']);
  const [color, setColor] = useState<string>(NOTE_COLORS[0]);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const latestRef = useRef({ title: '', lines: [''], color: NOTE_COLORS[0] as string, noteId: null as string | null });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    if (open) {
      const id = note?.id ?? null;
      setTitle(note?.title ?? '');
      setLines(splitLines(note?.content ?? ''));
      setColor(note?.color ?? NOTE_COLORS[0]);
      setEditingLine(null);
      setNoteId(id);
      latestRef.current = {
        title: note?.title ?? '',
        lines: splitLines(note?.content ?? ''),
        color: note?.color ?? NOTE_COLORS[0],
        noteId: id,
      };
      savingRef.current = false;
    }
  }, [open, note]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Focus input when editing line changes
  useEffect(() => {
    if (editingLine !== null && inputRef.current) {
      inputRef.current.focus();
      autoResize(inputRef.current);
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editingLine]);

  const performSave = useCallback(async () => {
    if (savingRef.current) return;
    const { title: t, lines: l, color: c, noteId: id } = latestRef.current;
    const content = l.join('\n').trim();
    if (!t.trim() && !content) return;
    savingRef.current = true;
    try {
      if (id) {
        await updateNote(id, { title: t.trim(), content, color: c });
      } else {
        const created = await createNote({ title: t.trim(), content, color: c });
        setNoteId(created.id);
        latestRef.current.noteId = created.id;
      }
    } finally {
      savingRef.current = false;
    }
  }, [createNote, updateNote]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => performSave(), 800);
  }, [performSave]);

  const handleClose = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    performSave();
    onClose();
  }, [performSave, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      performSave();
    }
  };

  const handleLineClick = (index: number) => {
    if (IDEAS_FROZEN) return;
    setEditingLine(index);
  };

  const handleLineChange = (index: number, value: string) => {
    const newLines = [...lines];
    newLines[index] = value;
    setLines(newLines);
    latestRef.current.lines = newLines;
    if (inputRef.current) autoResize(inputRef.current);
    scheduleSave();
  };

  const handleLineBlur = () => {
    setEditingLine(null);
  };

  const handleLineKeyDown = (index: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newLines = [...lines];
      newLines.splice(index + 1, 0, '');
      setLines(newLines);
      latestRef.current.lines = newLines;
      setEditingLine(index + 1);
      scheduleSave();
    } else if (e.key === 'Backspace' && lines[index] === '' && lines.length > 1) {
      e.preventDefault();
      const newLines = [...lines];
      newLines.splice(index, 1);
      setLines(newLines);
      latestRef.current.lines = newLines;
      setEditingLine(Math.max(0, index - 1));
      scheduleSave();
    } else if (e.key === 'ArrowDown') {
      if (index < lines.length - 1) {
        setEditingLine(index + 1);
      }
    } else if (e.key === 'ArrowUp') {
      if (index > 0) {
        setEditingLine(index - 1);
      }
    }
  };

  // Click on empty area to add a new line
  const handleContainerClick = (e: React.MouseEvent) => {
    if (IDEAS_FROZEN) return;
    if (e.target === containerRef.current) {
      const newLines = [...lines, ''];
      setLines(newLines);
      setEditingLine(newLines.length - 1);
    }
  };

  const hasContent = lines.some((l) => l.trim().length > 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-bg-primary flex flex-col"
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          onKeyDown={handleKeyDown}
        >
          {/* Top bar */}
          <div
            className="flex items-center gap-2 px-4 py-3 shrink-0"
            style={{ boxShadow: NEU.topBar }}
          >
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
            >
              <BackIcon />
            </button>

            {/* Color dots */}
            <div className="flex gap-1.5 ml-auto mr-2">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={IDEAS_FROZEN}
                  onClick={() => { setColor(c); latestRef.current.color = c; scheduleSave(); }}
                  className="w-5 h-5 rounded-full transition-transform disabled:cursor-default"
                  style={{
                    backgroundColor: c,
                    boxShadow: color === c ? NEU.pressedSm : NEU.raisedSm,
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                />
              ))}
            </div>

            {note && onDelete && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  if (saveTimerRef.current) {
                    clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = null;
                  }
                  onDelete();
                  onClose();
                }}
              >
                {t('ideas.deleteBtnLabel')}
              </Button>
            )}
          </div>

          {/* Editor body */}
          <div className="flex-1 overflow-auto px-4 md:px-12 lg:px-24 py-6 max-w-4xl mx-auto w-full">
            {/* Title */}
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); latestRef.current.title = e.target.value; scheduleSave(); }}
              placeholder={t('ideas.titlePlaceholder')}
              autoFocus={!IDEAS_FROZEN}
              readOnly={IDEAS_FROZEN}
              className="w-full bg-transparent text-2xl font-bold text-text-primary placeholder:text-text-muted/50 focus:outline-none mb-4 border-none"
            />

            {/* Inline markdown editor */}
            <div className="mx-auto w-full max-w-prose">
              <div
                ref={containerRef}
                onClick={handleContainerClick}
                className="rounded-xl p-4 text-sm text-text-primary leading-relaxed cursor-text"
                style={{ boxShadow: NEU.pressedSm, minHeight: 'calc(100vh - 250px)' }}
              >
                {!hasContent && editingLine === null && (
                  <span className="text-text-muted/40">{t('ideas.contentPlaceholder')}</span>
                )}

                {lines.map((line, i) => {
                  if (editingLine === i) {
                    return (
                      <textarea
                        key={i}
                        rows={1}
                        ref={inputRef}
                        value={line}
                        onChange={(e) => handleLineChange(i, e.target.value)}
                        onBlur={handleLineBlur}
                        onKeyDown={(e) => handleLineKeyDown(i, e)}
                        className="w-full bg-transparent text-text-primary focus:outline-none border-none resize-none overflow-hidden py-0.5"
                        style={getLineInputStyle(line)}
                      />
                    );
                  }

                  // Rendered line
                  const rendered = renderLineMd(line);
                  if (line.trim() === '') {
                    return (
                      <div
                        key={i}
                        onClick={() => handleLineClick(i)}
                        className="cursor-text py-0.5"
                        style={{ lineHeight: '1.625' }}
                      >&nbsp;</div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      onClick={() => handleLineClick(i)}
                      className="cursor-text py-0.5 markdown-preview break-words"
                      style={getLineInputStyle(line)}
                      dangerouslySetInnerHTML={{ __html: rendered }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
