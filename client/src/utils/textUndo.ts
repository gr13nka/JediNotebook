/**
 * App-level undo/redo history for the project-note editor's controlled
 * `<textarea>` (ProjectDraftEditor). The browser's native undo stack is
 * unusable there: any programmatic value replacement — a live-query
 * re-emit, a vault-sync merge landing mid-edit, a DnD cut/drop mutation —
 * wipes it. This module is the replacement: the editor records the
 * pre-change state before applying each edit, and undo/redo restore both
 * text and caret from app state instead of relying on the browser.
 *
 * Every function here is pure — inputs are never mutated, results are new
 * objects — so histories can live in React state or the session store
 * below interchangeably.
 */

export interface UndoEntry {
  /** Full textarea value at this point in history. */
  text: string;
  /** Selection to restore with the text — equal start/end is a plain caret. */
  caretStart: number;
  caretEnd: number;
}

export interface UndoHistory {
  undo: UndoEntry[];
  redo: UndoEntry[];
  /** Timestamp of the most recent `recordEdit`, driving typing coalescing. */
  lastEditAt: number;
}

/** Cap on the undo stack — beyond it the oldest entry is dropped. */
export const MAX_ENTRIES = 100;

/**
 * Two typing edits closer together than this coalesce into one undo step,
 * so undo rewinds a whole typing run instead of one keystroke at a time.
 */
export const TYPING_COALESCE_MS = 500;

export function createHistory(): UndoHistory {
  return { undo: [], redo: [], lastEditAt: 0 };
}

/**
 * Records the PRE-change state (`prev`) just before an edit is applied to
 * the textarea. Two kinds:
 *
 *  - `'typing'` pushes `prev` onto `undo` only at a coalescing boundary —
 *    when more than TYPING_COALESCE_MS passed since the last recorded edit,
 *    or when `undo` is empty (the first edit must always be undoable).
 *    Inside the window it records nothing: the in-flight typing run keeps
 *    coalescing into the boundary already pushed, and only `lastEditAt`
 *    advances (which is what makes an unbroken run coalesce indefinitely —
 *    each keystroke extends the window from itself, not from the boundary).
 *  - `'snapshot'` (DnD cut/drop, external overwrites) ALWAYS pushes —
 *    a discrete mutation must be its own undo step, never folded into
 *    surrounding typing.
 *
 * Every call — pushed or coalesced — clears `redo` (a new edit forks
 * history, orphaning the redo branch) and stamps `lastEditAt = now`.
 * The undo stack is capped at MAX_ENTRIES by dropping the oldest entry.
 */
export function recordEdit(
  h: UndoHistory,
  prev: UndoEntry,
  now: number,
  kind: 'typing' | 'snapshot'
): UndoHistory {
  const push =
    kind === 'snapshot' || h.undo.length === 0 || now - h.lastEditAt > TYPING_COALESCE_MS;

  if (!push) {
    return { undo: h.undo, redo: [], lastEditAt: now };
  }

  return {
    undo: [...h.undo, prev].slice(-MAX_ENTRIES),
    redo: [],
    lastEditAt: now,
  };
}

/**
 * Pops the last undo entry as the state to restore, pushing `current`
 * (the textarea's state right now) onto `redo` so the step is reversible.
 * Returns `null` when there is nothing to undo.
 *
 * `lastEditAt` resets to 0 so the next typing edit always starts a fresh
 * coalescing boundary — otherwise typing again quickly after an undo would
 * coalesce into a stale window and never push the just-restored state,
 * making it unreachable by a second undo.
 */
export function undo(
  h: UndoHistory,
  current: UndoEntry
): { history: UndoHistory; restored: UndoEntry } | null {
  if (h.undo.length === 0) return null;

  const restored = h.undo[h.undo.length - 1];
  return {
    history: {
      undo: h.undo.slice(0, -1),
      redo: [...h.redo, current],
      lastEditAt: 0,
    },
    restored,
  };
}

/**
 * Mirror image of `undo`: pops the last redo entry as the state to
 * restore, pushing `current` back onto `undo`. Returns `null` when there
 * is nothing to redo.
 */
export function redo(
  h: UndoHistory,
  current: UndoEntry
): { history: UndoHistory; restored: UndoEntry } | null {
  if (h.redo.length === 0) return null;

  const restored = h.redo[h.redo.length - 1];
  return {
    history: {
      undo: [...h.undo, current],
      redo: h.redo.slice(0, -1),
      lastEditAt: 0,
    },
    restored,
  };
}

/**
 * Per-project session store. In-memory only, deliberately not persisted:
 * it survives editor remounts and tab switches within a session (which is
 * what makes app-level undo feel native), but a reload starts fresh —
 * persisting caret positions against text that may have been merged by
 * vault sync in the meantime would restore garbage.
 */
const histories = new Map<string, UndoHistory>();

/** Returns the project's history, creating an empty one on first access. */
export function getProjectHistory(projectId: string): UndoHistory {
  let h = histories.get(projectId);
  if (!h) {
    h = createHistory();
    histories.set(projectId, h);
  }
  return h;
}

export function setProjectHistory(projectId: string, h: UndoHistory): void {
  histories.set(projectId, h);
}
