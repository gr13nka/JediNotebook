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
  /** Timestamp of the most recent record call, driving typing coalescing. */
  lastEditAt: number;
  /**
   * Direction of the typing run currently coalescing: `'insert'` while
   * characters are being added, `'delete'` while they are being removed,
   * `null` when no run is active — initially, after undo/redo, and after
   * any always-push edit (snapshot, paste, selection replacement). `null`
   * never equals the next keystroke's kind, so the keystroke following a
   * break always starts a fresh chunk via the direction-change rule.
   */
  lastEditKind: 'insert' | 'delete' | null;
}

/** Cap on the undo stack — beyond it the oldest entry is dropped. */
export const MAX_ENTRIES = 100;

/**
 * Fallback chunker for typing runs: a pause longer than this splits a run
 * even without a word boundary or direction change. Word boundaries do the
 * fine-grained splitting (see `recordTyping`), so this can be generous —
 * it only needs to break up long delimiter-less bursts and mark thinking
 * pauses. (It used to be 500ms and the ONLY rule, which made slow typing
 * produce per-character undo steps and brisk typing collapse a whole
 * paragraph into one.)
 */
export const TYPING_COALESCE_MS = 2000;

export function createHistory(): UndoHistory {
  return { undo: [], redo: [], lastEditAt: 0, lastEditKind: null };
}

const WHITESPACE = /\s/;

/** Pushes `prev` as a new undo step, clearing redo and enforcing the cap. */
function pushEntry(
  h: UndoHistory,
  prev: UndoEntry,
  now: number,
  lastEditKind: UndoHistory['lastEditKind']
): UndoHistory {
  return {
    undo: [...h.undo, prev].slice(-MAX_ENTRIES),
    redo: [],
    lastEditAt: now,
    lastEditKind,
  };
}

/**
 * Classifies a typing edit by comparing the pre-change state to the new
 * text. Only clean single-caret keystrokes coalesce; everything shaped
 * like a discrete mutation is `'bulk'` and always gets its own undo step:
 *
 *  - a non-collapsed pre-change selection (typing or pasting over a
 *    selection replaces it — never mergeable with a plain typing run);
 *  - a length delta other than +1 or ≤ -1: paste, IME burst, autocomplete
 *    (0 or ≥ +2). A delta ≤ -1 stays `'delete'` so a Ctrl+Backspace
 *    word-delete coalesces with the backspaces around it.
 */
function classifyEdit(prev: UndoEntry, nextText: string): 'insert' | 'delete' | 'bulk' {
  if (prev.caretStart !== prev.caretEnd) return 'bulk';
  const delta = nextText.length - prev.text.length;
  if (delta === 1) return 'insert';
  if (delta <= -1) return 'delete';
  return 'bulk';
}

/**
 * Word-boundary test for a single-char insert: true when the inserted
 * char is non-whitespace and the insertion point is immediately preceded
 * by whitespace (newline included) — this keystroke starts a new word, so
 * the state that ended at the delimiter should become an undo step. The
 * caret is taken as the insertion point: the inserted char is
 * `nextText[caretStart]`, the preceding char `prev.text[caretStart - 1]`.
 * (The editor records the post-edit selection clamped to the pre-change
 * text, which matches this exactly for end-of-text typing and is within
 * one char mid-text — close enough for a chunk boundary.)
 *
 * Whitespace inserts themselves return false: the delimiter ENDS a word
 * and coalesces into its chunk; the next word's first char is what pushes.
 * Insertion at position 0 of non-empty text counts as a boundary (the
 * virtual char before the text is a break); position 0 of EMPTY text does
 * not — the very first word is covered by the empty-stack rule instead.
 */
function startsNewWord(prev: UndoEntry, nextText: string): boolean {
  if (WHITESPACE.test(nextText[prev.caretStart])) return false;
  if (prev.caretStart === 0) return prev.text.length > 0;
  return WHITESPACE.test(prev.text[prev.caretStart - 1]);
}

/**
 * Records the PRE-change state (`prev`) just before a typing edit turns
 * the text into `nextText`. Pushes `prev` onto `undo` — starting a new
 * undo chunk — when ANY of:
 *
 *  - the edit is `'bulk'` (paste / IME burst / selection replacement —
 *    see `classifyEdit`): always its own step, like a snapshot;
 *  - the undo stack is empty (the first edit must always be undoable);
 *  - more than TYPING_COALESCE_MS passed since the last recorded edit
 *    (fallback chunker for pauses and delimiter-less bursts);
 *  - the direction changed (`insert` after `delete` or vice versa, or
 *    either after a `null` break) — backspacing after typing starts a new
 *    chunk, like native editors;
 *  - a single-char insert starts a new word (see `startsNewWord`).
 *    Deletes get NO word-boundary splitting — editors chunk deletions
 *    coarser, so a backspace run only splits on pause or direction change.
 *
 * Otherwise the keystroke coalesces: nothing is pushed, and only
 * `lastEditAt`/`lastEditKind` advance — each keystroke extends the pause
 * window from itself, which is what lets an unbroken run coalesce
 * indefinitely.
 *
 * Every call — pushed or coalesced — clears `redo` (a new edit forks
 * history, orphaning the redo branch) and stamps `lastEditAt = now`.
 * `lastEditKind` becomes the edit's direction, except `'bulk'` edits set
 * it to `null` so the next keystroke starts a fresh chunk. The undo stack
 * is capped at MAX_ENTRIES by dropping the oldest entry.
 */
export function recordTyping(
  h: UndoHistory,
  prev: UndoEntry,
  nextText: string,
  now: number
): UndoHistory {
  const kind = classifyEdit(prev, nextText);
  if (kind === 'bulk') return pushEntry(h, prev, now, null);

  const push =
    h.undo.length === 0 ||
    now - h.lastEditAt > TYPING_COALESCE_MS ||
    kind !== h.lastEditKind ||
    (kind === 'insert' && startsNewWord(prev, nextText));

  if (!push) {
    return { undo: h.undo, redo: [], lastEditAt: now, lastEditKind: kind };
  }
  return pushEntry(h, prev, now, kind);
}

/**
 * Records the PRE-change state before a discrete mutation (DnD cut/drop,
 * an external overwrite landing). ALWAYS pushes — such a mutation must be
 * its own undo step, never folded into surrounding typing — and sets
 * `lastEditKind` to `null` so the typing that follows starts a fresh
 * chunk rather than coalescing across the mutation.
 */
export function recordSnapshot(h: UndoHistory, prev: UndoEntry, now: number): UndoHistory {
  return pushEntry(h, prev, now, null);
}

/**
 * Pops the last undo entry as the state to restore, pushing `current`
 * (the textarea's state right now) onto `redo` so the step is reversible.
 * Returns `null` when there is nothing to undo.
 *
 * `lastEditAt` resets to 0 so the next typing edit always starts a fresh
 * coalescing boundary — otherwise typing again quickly after an undo would
 * coalesce into a stale window and never push the just-restored state,
 * making it unreachable by a second undo. `lastEditKind` resets to `null`
 * for the same reason: no typing run survives an undo.
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
      lastEditKind: null,
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
      lastEditKind: null,
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
