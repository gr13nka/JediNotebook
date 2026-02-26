import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NEU } from '../../utils/shadows';
import { renderLineMd } from '../../utils/markdown';

interface ProjectDraftEditorProps {
  title: string;
  description: string;
  onSaveTitle: (title: string) => void;
  onSave: (description: string) => void;
}

export function ProjectDraftEditor({ title, description, onSaveTitle, onSave }: ProjectDraftEditorProps) {
  const [lines, setLines] = useState<string[]>(() => splitLines(description));
  const [localTitle, setLocalTitle] = useState(title);
  const [editingLine, setEditingLine] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines(splitLines(description));
  }, [description]);

  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  // Focus input when editing line changes
  useEffect(() => {
    if (editingLine !== null && inputRef.current) {
      inputRef.current.focus();
      // Place cursor at end
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editingLine]);

  const save = useCallback((newLines: string[]) => {
    const text = newLines.join('\n');
    if (text !== description) {
      onSave(text);
    }
  }, [description, onSave]);

  const handleTitleBlur = () => {
    if (localTitle !== title) {
      onSaveTitle(localTitle.trim());
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
    save(lines);
  };

  const handleLineKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Insert new line after current
      const newLines = [...lines];
      newLines.splice(index + 1, 0, '');
      setLines(newLines);
      save(newLines);
      setEditingLine(index + 1);
    } else if (e.key === 'Backspace' && lines[index] === '' && lines.length > 1) {
      e.preventDefault();
      // Delete empty line, move to previous
      const newLines = [...lines];
      newLines.splice(index, 1);
      setLines(newLines);
      save(newLines);
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
    <div className="flex flex-col h-full">
      {/* Title input - Google Keep style */}
      <input
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={handleTitleBlur}
        placeholder="Title"
        className="w-full bg-transparent text-xl font-bold text-text-primary placeholder:text-text-muted/40 focus:outline-none border-none mb-2 px-1"
      />

      <div className="mx-auto w-full max-w-prose">
        <div
          ref={containerRef}
          onClick={handleContainerClick}
          className="rounded-xl p-4 text-sm text-text-primary leading-relaxed cursor-text"
          style={{ boxShadow: NEU.pressedSm, minHeight: '300px' }}
        >
          {!hasContent && editingLine === null && (
            <span className="text-text-muted/40">Take a note...</span>
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
  );
}

function splitLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length === 0) return [''];
  return lines;
}
