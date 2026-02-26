import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/Button';
import { NEU } from '../../utils/shadows';
import { renderLineMd } from '../../utils/markdown';
import { useTranslation } from '../../i18n/useTranslation';
import { NOTE_COLORS } from '@shared/constants';
import type { Note } from '@shared/types';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

interface NoteEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { title: string; content: string; color: string }) => void;
  onDelete?: () => void;
  note?: Note | null;
}

function splitLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length === 0) return [''];
  return lines;
}

export function NoteEditor({ open, onClose, onSave, onDelete, note }: NoteEditorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState<string[]>(['']);
  const [color, setColor] = useState<string>(NOTE_COLORS[0]);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(note?.title ?? '');
      setLines(splitLines(note?.content ?? ''));
      setColor(note?.color ?? NOTE_COLORS[0]);
      setEditingLine(null);
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
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editingLine]);

  const getContent = useCallback((currentLines: string[]) => {
    return currentLines.join('\n');
  }, []);

  const handleSave = () => {
    const content = getContent(lines).trim();
    if (!title.trim() && !content) return;
    onSave({
      title: title.trim(),
      content,
      color,
    });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const handleLineClick = (index: number) => {
    setEditingLine(index);
  };

  const handleLineChange = (index: number, value: string) => {
    const newLines = [...lines];
    newLines[index] = value;
    setLines(newLines);
  };

  const handleLineBlur = () => {
    setEditingLine(null);
  };

  const handleLineKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newLines = [...lines];
      newLines.splice(index + 1, 0, '');
      setLines(newLines);
      setEditingLine(index + 1);
    } else if (e.key === 'Backspace' && lines[index] === '' && lines.length > 1) {
      e.preventDefault();
      const newLines = [...lines];
      newLines.splice(index, 1);
      setLines(newLines);
      setEditingLine(Math.max(0, index - 1));
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
              onClick={onClose}
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
                  onClick={() => setColor(c)}
                  className="w-5 h-5 rounded-full transition-transform"
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
                  onDelete();
                  onClose();
                }}
              >
                {t('ideas.deleteBtnLabel')}
              </Button>
            )}

            <Button size="sm" onClick={handleSave} disabled={!title.trim() && !hasContent}>
              {t('ideas.save')}
            </Button>
          </div>

          {/* Editor body */}
          <div className="flex-1 overflow-auto px-4 md:px-12 lg:px-24 py-6 max-w-4xl mx-auto w-full">
            {/* Title */}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('ideas.titlePlaceholder')}
              autoFocus
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
                      <input
                        key={i}
                        ref={inputRef}
                        value={line}
                        onChange={(e) => handleLineChange(i, e.target.value)}
                        onBlur={handleLineBlur}
                        onKeyDown={(e) => handleLineKeyDown(i, e)}
                        className="w-full bg-transparent text-sm text-text-primary focus:outline-none border-none py-0.5 font-mono"
                        style={{ lineHeight: '1.625' }}
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
                        className="h-6 cursor-text"
                      />
                    );
                  }
                  return (
                    <div
                      key={i}
                      onClick={() => handleLineClick(i)}
                      className="cursor-text py-0.5 markdown-preview"
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
