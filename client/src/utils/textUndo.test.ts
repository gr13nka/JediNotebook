import { describe, it, expect } from 'vitest';
import {
  createHistory,
  recordEdit,
  undo,
  redo,
  getProjectHistory,
  setProjectHistory,
  MAX_ENTRIES,
  TYPING_COALESCE_MS,
  type UndoEntry,
  type UndoHistory,
} from './textUndo';

function entry(text: string, caret = text.length): UndoEntry {
  return { text, caretStart: caret, caretEnd: caret };
}

describe('recordEdit', () => {
  it('coalesces typing edits within the window into one undo entry', () => {
    let h = createHistory();
    h = recordEdit(h, entry(''), 1000, 'typing');
    // Each keystroke lands within TYPING_COALESCE_MS of the previous one —
    // the run coalesces even though it spans more than the window overall,
    // because lastEditAt advances with every call.
    h = recordEdit(h, entry('a'), 1400, 'typing');
    h = recordEdit(h, entry('ab'), 1800, 'typing');
    h = recordEdit(h, entry('abc'), 2200, 'typing');
    expect(h.undo).toEqual([entry('')]);
    expect(h.lastEditAt).toBe(2200);
  });

  it('pushes a new entry when the gap exceeds the window', () => {
    let h = createHistory();
    h = recordEdit(h, entry(''), 1000, 'typing');
    h = recordEdit(h, entry('a'), 1000 + TYPING_COALESCE_MS + 1, 'typing');
    expect(h.undo).toEqual([entry(''), entry('a')]);
  });

  it('coalesces at exactly the window boundary (gap must exceed, not equal)', () => {
    let h = createHistory();
    h = recordEdit(h, entry(''), 1000, 'typing');
    h = recordEdit(h, entry('a'), 1000 + TYPING_COALESCE_MS, 'typing');
    expect(h.undo).toEqual([entry('')]);
  });

  it('always pushes the first typing edit onto an empty stack', () => {
    const h = createHistory();
    // lastEditAt is 0 and now is within the window of it — the empty-stack
    // rule must push regardless.
    const next = recordEdit(h, entry('seed'), 100, 'typing');
    expect(next.undo).toEqual([entry('seed')]);
  });

  it('always pushes a snapshot, even inside the coalesce window', () => {
    let h = createHistory();
    h = recordEdit(h, entry(''), 1000, 'typing');
    h = recordEdit(h, entry('a'), 1100, 'snapshot');
    expect(h.undo).toEqual([entry(''), entry('a')]);
  });

  it('clears redo even on a coalesced typing edit', () => {
    // Constructed state: non-empty redo alongside a within-window
    // lastEditAt. (It can't arise naturally — undo/redo reset lastEditAt —
    // but the contract is "every call clears redo", so test it directly.)
    const h: UndoHistory = {
      undo: [entry('a')],
      redo: [entry('c')],
      lastEditAt: 1000,
    };
    const next = recordEdit(h, entry('b'), 1100, 'typing');
    expect(next.undo).toEqual(h.undo); // coalesced — nothing pushed
    expect(next.redo).toEqual([]);
  });

  it('clears redo on a snapshot edit', () => {
    let h = createHistory();
    h = recordEdit(h, entry(''), 1000, 'typing');
    h = undo(h, entry('ab'))!.history;
    expect(h.redo).toHaveLength(1);
    h = recordEdit(h, entry('c'), 2000, 'snapshot');
    expect(h.redo).toEqual([]);
  });

  it('caps undo at MAX_ENTRIES by dropping the oldest', () => {
    let h = createHistory();
    const total = MAX_ENTRIES + 5;
    for (let i = 0; i < total; i++) {
      h = recordEdit(h, entry(`e${i}`), 1000 + i, 'snapshot');
    }
    expect(h.undo).toHaveLength(MAX_ENTRIES);
    // Oldest five (e0..e4) dropped; the stack starts at e5 and ends at the
    // most recent push.
    expect(h.undo[0]).toEqual(entry('e5'));
    expect(h.undo[MAX_ENTRIES - 1]).toEqual(entry(`e${total - 1}`));
    expect(h.undo.some((e) => e.text === 'e0')).toBe(false);
  });
});

describe('undo/redo', () => {
  it('returns null on empty stacks', () => {
    const h = createHistory();
    expect(undo(h, entry('x'))).toBeNull();
    expect(redo(h, entry('x'))).toBeNull();
  });

  it('round-trips text and caret, moving states between stacks', () => {
    const a: UndoEntry = { text: 'a', caretStart: 1, caretEnd: 1 };
    const b: UndoEntry = { text: 'ab', caretStart: 0, caretEnd: 2 };
    const c: UndoEntry = { text: 'abc', caretStart: 3, caretEnd: 3 };

    let h = createHistory();
    h = recordEdit(h, a, 1000, 'snapshot'); // before edit a → b
    h = recordEdit(h, b, 2000, 'snapshot'); // before edit b → c
    // Textarea now shows c.

    const u1 = undo(h, c)!;
    expect(u1.restored).toEqual(b); // text AND selection restored
    expect(u1.history.undo).toEqual([a]);
    expect(u1.history.redo).toEqual([c]);

    const u2 = undo(u1.history, u1.restored)!;
    expect(u2.restored).toEqual(a);
    expect(u2.history.undo).toEqual([]);
    expect(u2.history.redo).toEqual([c, b]);

    const r1 = redo(u2.history, u2.restored)!;
    expect(r1.restored).toEqual(b);
    expect(r1.history.undo).toEqual([a]);
    expect(r1.history.redo).toEqual([c]);

    const r2 = redo(r1.history, r1.restored)!;
    expect(r2.restored).toEqual(c);
    expect(r2.history.undo).toEqual([a, b]);
    expect(r2.history.redo).toEqual([]);
  });
});

describe('immutability', () => {
  it('recordEdit does not mutate its inputs', () => {
    const h: UndoHistory = {
      undo: [entry('old')],
      redo: [entry('redoable')],
      lastEditAt: 1000,
    };
    const prev = entry('prev');
    const hBefore = structuredClone(h);
    const prevBefore = structuredClone(prev);

    recordEdit(h, prev, 2000, 'snapshot'); // pushes
    recordEdit(h, prev, 1100, 'typing'); // coalesces
    expect(h).toEqual(hBefore);
    expect(prev).toEqual(prevBefore);
  });

  it('undo and redo do not mutate their inputs', () => {
    const h: UndoHistory = {
      undo: [entry('a')],
      redo: [entry('c')],
      lastEditAt: 1000,
    };
    const current = entry('b');
    const hBefore = structuredClone(h);
    const currentBefore = structuredClone(current);

    undo(h, current);
    redo(h, current);
    expect(h).toEqual(hBefore);
    expect(current).toEqual(currentBefore);
  });
});

describe('session store', () => {
  it('creates isolated per-project histories and returns the same instance per id', () => {
    const a = getProjectHistory('proj-a');
    const b = getProjectHistory('proj-b');
    expect(a).not.toBe(b);
    expect(getProjectHistory('proj-a')).toBe(a);
  });

  it('setProjectHistory replaces one project without touching others', () => {
    const before = getProjectHistory('proj-keep');
    const replacement = recordEdit(createHistory(), entry('x'), 1000, 'snapshot');
    setProjectHistory('proj-replace', replacement);
    expect(getProjectHistory('proj-replace')).toBe(replacement);
    expect(getProjectHistory('proj-keep')).toBe(before);
  });
});
