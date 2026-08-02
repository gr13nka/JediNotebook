import { describe, it, expect } from 'vitest';
import {
  createHistory,
  recordTyping,
  recordSnapshot,
  undo,
  redo,
  getProjectHistory,
  setProjectHistory,
  MAX_ENTRIES,
  TYPING_COALESCE_MS,
  type UndoEntry,
  type UndoHistory,
} from './textUndo';

const entry = (text: string, caret = text.length): UndoEntry => ({
  text,
  caretStart: caret,
  caretEnd: caret,
});

/**
 * Simulates typing `chars` one keystroke at a time onto `text`, the way the
 * editor records it: prev = pre-change text with the caret at the insertion
 * point (end of text here), next = text with the char appended.
 */
function typeString(
  h: UndoHistory,
  text: string,
  chars: string,
  startAt: number,
  gap: number
): { h: UndoHistory; text: string; at: number } {
  let at = startAt;
  for (const ch of chars) {
    const next = text + ch;
    h = recordTyping(h, { text, caretStart: text.length, caretEnd: text.length }, next, at);
    text = next;
    at += gap;
  }
  return { h, text, at };
}

/** Simulates `count` backspaces at the end of `text`. */
function backspace(
  h: UndoHistory,
  text: string,
  count: number,
  startAt: number,
  gap: number
): { h: UndoHistory; text: string; at: number } {
  let at = startAt;
  for (let i = 0; i < count; i++) {
    const next = text.slice(0, -1);
    const caret = text.length - 1;
    h = recordTyping(h, { text, caretStart: caret, caretEnd: caret }, next, at);
    text = next;
    at += gap;
  }
  return { h, text, at };
}

describe('recordTyping — word-boundary coalescing', () => {
  it('typing "hello world" briskly yields exactly two undo chunks, split before "w"', () => {
    const { h } = typeString(createHistory(), '', 'hello world', 1000, 100);
    expect(h.undo.map((e) => e.text)).toEqual(['', 'hello ']);
  });

  it('a trailing delimiter coalesces into the word it ends', () => {
    const { h } = typeString(createHistory(), '', 'hello ', 1000, 100);
    expect(h.undo.map((e) => e.text)).toEqual(['']);
  });

  it('Enter counts as a delimiter: first char of the next line pushes', () => {
    const { h } = typeString(createHistory(), '', 'a\nb', 1000, 100);
    expect(h.undo.map((e) => e.text)).toEqual(['', 'a\n']);
  });

  it('slow typing inside one word (600ms gaps) stays one chunk', () => {
    const { h } = typeString(createHistory(), '', 'word', 1000, 600);
    expect(h.undo.map((e) => e.text)).toEqual(['']);
  });

  it('a pause longer than TYPING_COALESCE_MS splits even mid-word', () => {
    let s = typeString(createHistory(), '', 'wo', 1000, 100);
    s = typeString(s.h, s.text, 'rd', s.at + TYPING_COALESCE_MS + 1, 100);
    expect(s.h.undo.map((e) => e.text)).toEqual(['', 'wo']);
  });

  it('a pause of exactly TYPING_COALESCE_MS still coalesces (> not >=)', () => {
    let s = typeString(createHistory(), '', 'a', 1000, 0);
    s = typeString(s.h, s.text, 'b', 1000 + TYPING_COALESCE_MS, 0);
    expect(s.h.undo.map((e) => e.text)).toEqual(['']);
  });

  it('inserting at the start of non-empty text is a boundary', () => {
    const h = recordTyping(
      recordSnapshot(createHistory(), entry('seed'), 500),
      { text: 'world', caretStart: 0, caretEnd: 0 },
      'xworld',
      1000
    );
    expect(h.undo.map((e) => e.text)).toEqual(['seed', 'world']);
  });

  it('backspacing after typing starts a new chunk (direction change)', () => {
    let s = typeString(createHistory(), '', 'ab', 1000, 100);
    s = backspace(s.h, s.text, 1, s.at, 100);
    expect(s.h.undo.map((e) => e.text)).toEqual(['', 'ab']);
  });

  it('typing after backspacing starts a new chunk (direction change)', () => {
    let s = typeString(createHistory(), '', 'abc', 1000, 100);
    s = backspace(s.h, s.text, 1, s.at, 100); // pushes 'abc'
    s = typeString(s.h, s.text, 'x', s.at, 100); // pushes 'ab'
    expect(s.h.undo.map((e) => e.text)).toEqual(['', 'abc', 'ab']);
  });

  it('consecutive backspaces coalesce with no word-boundary splitting', () => {
    let s = typeString(createHistory(), '', 'one two', 1000, 100);
    s = backspace(s.h, s.text, 5, s.at, 100); // eats "o two" across the space
    expect(s.h.undo.map((e) => e.text)).toEqual(['', 'one ', 'one two']);
  });

  it('backspace runs split on a long pause', () => {
    let s = backspace(recordSnapshot(createHistory(), entry('seed'), 500), 'abcd', 2, 1000, 100);
    s = backspace(s.h, s.text, 1, s.at + TYPING_COALESCE_MS + 1, 100);
    expect(s.h.undo.map((e) => e.text)).toEqual(['seed', 'abcd', 'ab']);
  });

  it('paste (multi-char delta) always pushes and breaks the run', () => {
    const s = typeString(createHistory(), '', 'ab', 1000, 100);
    let h = recordTyping(s.h, entry(s.text), 'abXYZ', s.at); // bulk
    expect(h.undo.map((e) => e.text)).toEqual(['', 'ab']);
    expect(h.lastEditKind).toBeNull();
    // next keystroke starts fresh (direction change vs null)
    h = recordTyping(h, entry('abXYZ'), 'abXYZq', s.at + 100);
    expect(h.undo.map((e) => e.text)).toEqual(['', 'ab', 'abXYZ']);
  });

  it('typing over a selection always pushes', () => {
    const s = typeString(createHistory(), '', 'ab', 1000, 100);
    const h = recordTyping(s.h, { text: 'ab', caretStart: 0, caretEnd: 2 }, 'x', s.at);
    expect(h.undo.map((e) => e.text)).toEqual(['', 'ab']);
    expect(h.lastEditKind).toBeNull();
  });

  it('first edit on an empty stack always pushes', () => {
    const h = recordTyping(createHistory(), entry(''), 'a', 1000);
    expect(h.undo.map((e) => e.text)).toEqual(['']);
    expect(h.lastEditKind).toBe('insert');
  });

  it('every call clears redo, coalesced or pushed', () => {
    // Pushed path.
    let h = typeString(createHistory(), '', 'ab', 1000, 100).h;
    const stepped = undo(h, entry('ab'));
    expect(stepped!.history.redo).toHaveLength(1);
    h = recordTyping(stepped!.history, entry(''), 'x', 5000);
    expect(h.redo).toEqual([]);
    // Coalesced path (constructed: an active insert run with a stale redo).
    const artificial: UndoHistory = {
      undo: [entry('')],
      redo: [entry('zzz')],
      lastEditAt: 1000,
      lastEditKind: 'insert',
    };
    const coalesced = recordTyping(artificial, entry('a'), 'ab', 1100);
    expect(coalesced.undo).toHaveLength(1); // did coalesce
    expect(coalesced.redo).toEqual([]);
  });

  it('caps the undo stack at MAX_ENTRIES, dropping the oldest', () => {
    let h = createHistory();
    for (let i = 0; i < MAX_ENTRIES + 5; i++) {
      h = recordSnapshot(h, entry(`e${i}`), 1000 + i);
    }
    expect(h.undo).toHaveLength(MAX_ENTRIES);
    expect(h.undo[0].text).toBe('e5');
    expect(h.undo[h.undo.length - 1].text).toBe(`e${MAX_ENTRIES + 4}`);
  });
});

describe('recordSnapshot', () => {
  it('always pushes, even inside an active typing run', () => {
    const s = typeString(createHistory(), '', 'ab', 1000, 100);
    const h = recordSnapshot(s.h, entry('ab'), s.at);
    expect(h.undo.map((e) => e.text)).toEqual(['', 'ab']);
    expect(h.lastEditKind).toBeNull();
  });
});

describe('undo/redo', () => {
  it('return null on empty stacks', () => {
    expect(undo(createHistory(), entry('x'))).toBeNull();
    expect(redo(createHistory(), entry('x'))).toBeNull();
  });

  it('round-trips text and caret, moving states between stacks', () => {
    const a: UndoEntry = { text: 'alpha', caretStart: 2, caretEnd: 4 };
    const b: UndoEntry = { text: 'beta', caretStart: 1, caretEnd: 1 };
    let h = createHistory();
    h = recordSnapshot(h, a, 1000); // before edit a → b
    h = recordSnapshot(h, b, 2000); // before edit b → c
    const current = entry('gamma');

    const u1 = undo(h, current)!;
    expect(u1.restored).toEqual(b);
    const u2 = undo(u1.history, u1.restored)!;
    expect(u2.restored).toEqual(a);
    expect(u2.history.undo).toHaveLength(0);
    expect(u2.history.redo.map((e) => e.text)).toEqual(['gamma', 'beta']);

    const r1 = redo(u2.history, u2.restored)!;
    expect(r1.restored).toEqual(b);
    const r2 = redo(r1.history, r1.restored)!;
    expect(r2.restored).toEqual(current);
    expect(r2.history.redo).toHaveLength(0);
    expect(r2.history.undo.map((e) => e.text)).toEqual(['alpha', 'beta']);
  });

  it('resets lastEditAt and lastEditKind so post-undo typing starts a fresh chunk', () => {
    const h = typeString(createHistory(), '', 'ab', 1000, 100).h;
    const u = undo(h, entry('ab'))!;
    expect(u.history.lastEditAt).toBe(0);
    expect(u.history.lastEditKind).toBeNull();
    // Typing right after the undo must push the restored state, not coalesce.
    const next = recordTyping(u.history, entry(''), 'z', 1300);
    expect(next.undo.map((e) => e.text)).toEqual(['']);
  });
});

describe('immutability', () => {
  it('recordTyping (push and coalesce), recordSnapshot, and undo/redo never mutate inputs', () => {
    const base = typeString(createHistory(), '', 'ab', 1000, 100).h;
    const baseSnap = structuredClone(base);
    const prev = entry('ab');
    const prevSnap = structuredClone(prev);

    recordTyping(base, prev, 'ab ', 1200); // coalesce
    recordTyping(base, prev, 'abXYZ', 1200); // bulk push
    recordSnapshot(base, prev, 1200);
    undo(base, prev);
    expect(base).toEqual(baseSnap);
    expect(prev).toEqual(prevSnap);

    const u = undo(base, prev)!;
    redo(u.history, u.restored);
    expect(base).toEqual(baseSnap);
  });
});

describe('per-project session store', () => {
  it('isolates histories per project and returns the same instance per id', () => {
    const a = getProjectHistory('proj-a');
    const b = getProjectHistory('proj-b');
    expect(a).not.toBe(b);
    expect(getProjectHistory('proj-a')).toBe(a);
  });

  it('setProjectHistory replaces one project without touching another', () => {
    const before = getProjectHistory('proj-d');
    const replacement = recordSnapshot(createHistory(), entry('x'), 1000);
    setProjectHistory('proj-c', replacement);
    expect(getProjectHistory('proj-c')).toBe(replacement);
    expect(getProjectHistory('proj-d')).toBe(before);
  });
});
