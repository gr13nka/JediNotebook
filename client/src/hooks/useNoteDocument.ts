import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isDragActive } from './useDragGesture';
import { cutRange as cutRangeFromText } from '../utils/taskDnd';
import {
  recordTyping,
  recordSnapshot as pushSnapshot,
  undo as undoHistory,
  redo as redoHistory,
  getProjectHistory,
  setProjectHistory,
  type UndoEntry,
} from '../utils/textUndo';

/**
 * A project note as a document: its text, its undo history, and the reconciling
 * of local edits against values arriving from elsewhere.
 *
 * Split out of `ProjectDraftEditor` because the editor was doing seven jobs and
 * this is the one that owns data. Everything here is about *what the text is*;
 * nothing here knows about preview-versus-textarea, focus mode, font size or
 * drag gestures, which is what the component keeps.
 */
/**
 * How long typing pauses before the note is written.
 *
 * Long enough that a normal typing run is one write, short enough that no
 * thought worth keeping is ever more than this far from being stored.
 */
const AUTOSAVE_IDLE_MS = 800;

export interface UseNoteDocumentOptions {
  /** Keys the per-project undo history, which survives editor remounts. */
  projectId: string;
  /** The stored note, as the live query reports it. */
  description: string;
  onSave: (description: string) => void;
}

export interface NoteDocument {
  /** The note's text as the editor has it, saved or not. */
  text: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** For the textarea's `onChange`: records a typing step and takes the value. */
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /**
   * For the textarea's `onBlur`: persists local edits, or accepts a foreign
   * value that arrived while the caret was in the box.
   */
  settle: () => void;
  /** Replaces the text as one undoable step and persists it. */
  replace: (next: string) => void;
  /** Removes [start, end) as one undoable step and persists it. */
  cutRange: (start: number, end: number) => void;
  undo: () => void;
  redo: () => void;
}

export function useNoteDocument({
  projectId,
  description,
  onSave,
}: UseNoteDocumentOptions): NoteDocument {
  const [text, setText] = useState(description);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * `text` mirrored into a ref so stable callbacks (cut registration, undo
   * snapshots) can read the current value without re-creating on every
   * keystroke, and so saves happen outside state updaters — React may invoke
   * updaters twice under StrictMode, which would double-save.
   */
  const textRef = useRef(text);
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // Held in a ref because callers rebuild this closure on every render; without
  // it every callback below would change identity per keystroke.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  /** The document's state right now — text plus textarea selection. */
  const currentEntry = useCallback((): UndoEntry => {
    const value = textRef.current;
    const ta = textareaRef.current;
    return ta
      ? { text: value, caretStart: ta.selectionStart, caretEnd: ta.selectionEnd }
      : { text: value, caretStart: value.length, caretEnd: value.length };
  }, []);

  /**
   * Pushes the current state as its own undo step. Called before every
   * discrete mutation (a drag's cut or drop, an external overwrite landing) so
   * the pre-mutation text stays one Ctrl+Z away. Only ever reached from event
   * handlers or a real `description` change — never from a mount effect, so
   * a StrictMode double-mount records nothing into the module-level history.
   */
  const recordSnapshot = useCallback(() => {
    setProjectHistory(
      projectId,
      pushSnapshot(getProjectHistory(projectId), currentEntry(), Date.now())
    );
  }, [projectId, currentEntry]);

  /**
   * External-overwrite bookkeeping. `lastAppliedRef` is the last `description`
   * value this document produced or accepted — a live-query re-emit equal to it
   * (our own save echo, or a title/color save) is ignored. `pendingExternalRef`
   * stashes a genuinely-foreign value that arrived mid-edit (textarea focused)
   * so in-progress typing is never clobbered; `settle` resolves it.
   */
  const lastAppliedRef = useRef(description);
  const pendingExternalRef = useRef<string | null>(null);

  const autosaveTimer = useRef<number | null>(null);

  const cancelAutosave = useCallback(() => {
    if (autosaveTimer.current !== null) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }
  }, []);

  /** Persists `next` as our own — the next live-query echo must be ignored. */
  const save = useCallback((next: string) => {
    cancelAutosave();
    lastAppliedRef.current = next;
    pendingExternalRef.current = null;
    onSaveRef.current(next);
  }, [cancelAutosave]);

  /** Writes what has been typed, if anything has. */
  const flush = useCallback(() => {
    if (textRef.current !== lastAppliedRef.current) save(textRef.current);
  }, [save]);

  /**
   * Restarts the idle countdown after a keystroke.
   *
   * Deferred while a drag is in flight, and this is not a nicety: a save echoes
   * back through the live query, and a re-render mid-gesture would move the note
   * lines out from under a pointer that is aiming at them by geometry. The text
   * is not at risk in the meantime — the gesture ends in milliseconds and the
   * countdown simply starts again.
   */
  const scheduleAutosave = useCallback(() => {
    cancelAutosave();
    autosaveTimer.current = window.setTimeout(() => {
      autosaveTimer.current = null;
      if (isDragActive()) {
        scheduleAutosave();
        return;
      }
      flush();
    }, AUTOSAVE_IDLE_MS);
  }, [cancelAutosave, flush]);

  /** Accepts a foreign description, keeping the overwritten text undoable. */
  const applyExternal = useCallback(
    (next: string) => {
      cancelAutosave();
      if (next !== textRef.current) {
        recordSnapshot();
        textRef.current = next;
        setText(next);
      }
      lastAppliedRef.current = next;
      pendingExternalRef.current = null;
    },
    [cancelAutosave, recordSnapshot]
  );

  useEffect(() => {
    if (description === lastAppliedRef.current) return; // our own echo
    if (document.activeElement === textareaRef.current) {
      pendingExternalRef.current = description;
      return;
    }
    applyExternal(description);
  }, [description, applyExternal]);

  const onChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const previous = textRef.current;
      // The textarea's selection at onChange time is already post-edit; clamped
      // to the pre-change text it lands within a character of the true pre-edit
      // caret — close enough for a typing-run boundary.
      const caretStart = Math.min(event.target.selectionStart, previous.length);
      const caretEnd = Math.min(event.target.selectionEnd, previous.length);
      setProjectHistory(
        projectId,
        recordTyping(
          getProjectHistory(projectId),
          { text: previous, caretStart, caretEnd },
          event.target.value,
          Date.now()
        )
      );
      textRef.current = event.target.value;
      setText(event.target.value);
      scheduleAutosave();
    },
    [projectId, scheduleAutosave]
  );

  const settle = useCallback(() => {
    const pending = pendingExternalRef.current;
    if (textRef.current !== lastAppliedRef.current) {
      // Local edits win over anything stashed mid-edit — both sides carry an
      // updatedAt, and last-write-wins settles it downstream.
      save(textRef.current);
    } else if (pending !== null) {
      applyExternal(pending);
    }
  }, [applyExternal, save]);

  const replace = useCallback(
    (next: string) => {
      if (next === textRef.current) return;
      recordSnapshot();
      textRef.current = next;
      setText(next);
      save(next);
    },
    [recordSnapshot, save]
  );

  const cutRange = useCallback(
    (start: number, end: number) => {
      replace(cutRangeFromText(textRef.current, start, end));
    },
    [replace]
  );

  /** Applies one undo/redo step, restoring its caret once the value lands. */
  const applyHistoryStep = useCallback(
    (step: typeof undoHistory) => {
      const result = step(getProjectHistory(projectId), currentEntry());
      if (!result) return;
      setProjectHistory(projectId, result.history);
      const { text: restored, caretStart, caretEnd } = result.restored;
      textRef.current = restored;
      setText(restored);
      // An undone state is as much "what the note says now" as a typed one, so
      // it goes through the same countdown rather than waiting for a blur.
      scheduleAutosave();
      // The textarea is controlled — the restored value applies on the
      // re-render this discrete event flushes, so the caret must wait a frame.
      requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(caretStart, caretEnd);
      });
    },
    [currentEntry, projectId, scheduleAutosave]
  );

  const undo = useCallback(() => applyHistoryStep(undoHistory), [applyHistoryStep]);
  const redo = useCallback(() => applyHistoryStep(redoHistory), [applyHistoryStep]);

  /**
   * The last write, on the way out. Leaving the route, switching project (this
   * hook is keyed per project) and closing the app all end here, and none of
   * them fires blur first — which is exactly how typed text used to be lost.
   */
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const flushNow = () => flushRef.current();
    // `pagehide` rather than `beforeunload`: it is the one that fires on mobile,
    // where the app is backgrounded rather than closed.
    window.addEventListener('pagehide', flushNow);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      flushNow();
    };
  }, []);

  return { text, textareaRef, onChange, settle, replace, cutRange, undo, redo };
}
