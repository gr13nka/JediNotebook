import React, { useState, useRef, useEffect } from 'react';

interface InlineTextEditProps {
  value: string;
  editing: boolean;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
}

/**
 * Single-line click-to-edit text.
 *
 * Commit rules, shared by every caller: Enter and blur commit, Escape reverts,
 * and an empty or unchanged value reverts rather than writing. The caller owns
 * the `editing` flag so it can decide what opens the editor (double-click, a
 * context-menu entry, a pencil button).
 */
export function InlineTextEdit({ value, editing, onCommit, onCancel, className = '' }: InlineTextEditProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onCommit(trimmed);
    } else {
      setDraft(value);
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDraft(value);
      onCancel();
    }
  };

  if (!editing) return null;

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      className={`w-full bg-transparent focus:outline-none ${className}`}
    />
  );
}
