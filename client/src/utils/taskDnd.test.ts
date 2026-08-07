import { describe, it, expect } from 'vitest';
import { wholeLineRange, offsetAfterLine, lineOfOffset, cutRange, insertLine, moveLineBlock } from './taskDnd';

// These four functions are the character-offset arithmetic behind dragging
// task lines into/out of a project description (see taskDnd.ts doc comments).
// Getting them wrong corrupts the user's description text, so every edge
// documented in the source comments gets a pinned test here.

describe('wholeLineRange', () => {
  it('covers a middle line, excluding surrounding newlines', () => {
    const text = 'aaa\nbbb\nccc';
    expect(wholeLineRange(text, 1, 1)).toEqual({ start: 4, end: 7 });
    expect(text.slice(4, 7)).toBe('bbb');
  });

  it('covers the first line starting at offset 0', () => {
    const text = 'aaa\nbbb\nccc';
    expect(wholeLineRange(text, 0, 0)).toEqual({ start: 0, end: 3 });
  });

  it('covers the last line, excluding a trailing newline when absent', () => {
    const text = 'aaa\nbbb\nccc';
    expect(wholeLineRange(text, 2, 2)).toEqual({ start: 8, end: 11 });
    expect(text.slice(8, 11)).toBe('ccc');
  });

  it('covers a multi-line span joined by internal newlines only', () => {
    const text = 'aaa\nbbb\nccc';
    expect(wholeLineRange(text, 0, 1)).toEqual({ start: 0, end: 7 });
    expect(text.slice(0, 7)).toBe('aaa\nbbb');
  });

  it('excludes the trailing newline of the last real line when text ends with \\n', () => {
    // split('\n') on a trailing-newline text produces a phantom empty final
    // element; line index 2 ("ccc") must still resolve to just its content.
    const text = 'aaa\nbbb\nccc\n';
    expect(wholeLineRange(text, 2, 2)).toEqual({ start: 8, end: 11 });
    expect(text.slice(8, 11)).toBe('ccc');
  });

  it('resolves the phantom empty line after a trailing newline to an empty range at the end', () => {
    const text = 'aaa\nbbb\nccc\n';
    expect(wholeLineRange(text, 3, 3)).toEqual({ start: 12, end: 12 });
    expect(text.length).toBe(12);
  });

  it('clamps out-of-range line indices into bounds', () => {
    const text = 'aaa\nbbb\nccc';
    expect(wholeLineRange(text, -5, 0)).toEqual({ start: 0, end: 3 });
    expect(wholeLineRange(text, 2, 999)).toEqual({ start: 8, end: 11 });
    // endLine below startLine: `last` is clamped up to `first`.
    expect(wholeLineRange(text, 2, 0)).toEqual({ start: 8, end: 11 });
  });

  it('handles empty text as a single empty line', () => {
    expect(wholeLineRange('', 0, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe('offsetAfterLine', () => {
  it('points just past a middle line, before its own trailing newline', () => {
    const text = 'aaa\nbbb\nccc';
    expect(offsetAfterLine(text, 0)).toBe(3);
    expect(text[3]).toBe('\n');
  });

  it('points at text.length for the last line when there is no trailing newline', () => {
    const text = 'aaa\nbbb\nccc';
    expect(offsetAfterLine(text, 2)).toBe(text.length);
  });

  it('points before the trailing newline for the last real line when text ends with \\n', () => {
    const text = 'aaa\nbbb\nccc\n';
    expect(offsetAfterLine(text, 2)).toBe(11);
    expect(text[11]).toBe('\n');
  });

  it('is 0 for an empty text', () => {
    expect(offsetAfterLine('', 0)).toBe(0);
  });
});

describe('lineOfOffset', () => {
  const text = 'aaa\nbbb\nccc';

  it('is the inverse of wholeLineRange for each line start', () => {
    for (const line of [0, 1, 2]) {
      expect(lineOfOffset(text, wholeLineRange(text, line, line).start)).toBe(line);
    }
  });

  it('keeps the end of a line on that line, not the next one', () => {
    // Offset 3 is the '\n' that ends line 0; a selection ending there selected
    // line 0, not line 1.
    expect(lineOfOffset(text, 3)).toBe(0);
    expect(lineOfOffset(text, 4)).toBe(1);
  });

  it('is 0 at the start and the last line at the end', () => {
    expect(lineOfOffset(text, 0)).toBe(0);
    expect(lineOfOffset(text, text.length)).toBe(2);
    expect(lineOfOffset('', 0)).toBe(0);
  });

  it('clamps out-of-range offsets', () => {
    expect(lineOfOffset(text, -5)).toBe(0);
    expect(lineOfOffset(text, 999)).toBe(2);
  });
});

describe('cutRange', () => {
  it('removes a middle line and collapses the resulting blank line', () => {
    const text = 'aaa\nbbb\nccc';
    const { start, end } = wholeLineRange(text, 1, 1);
    expect(cutRange(text, start, end)).toBe('aaa\nccc');
  });

  it('removes the first line without leaving a leading blank line', () => {
    const text = 'aaa\nbbb\nccc';
    const { start, end } = wholeLineRange(text, 0, 0);
    expect(cutRange(text, start, end)).toBe('bbb\nccc');
  });

  it('removes the last line, leaving the preceding newline behind (documented asymmetry)', () => {
    // Unlike the first-line case, there is no newline *after* the cut to pair
    // with, so cutRange's collapse rule does not fire here and the newline
    // that used to separate line 1 from line 2 remains. This is current,
    // intentional-looking behavior per the source comment, not verified as a
    // deliberate design choice beyond what the comment states — pinned as-is.
    const text = 'aaa\nbbb\nccc';
    const { start, end } = wholeLineRange(text, 2, 2);
    expect(cutRange(text, start, end)).toBe('aaa\nbbb\n');
  });

  it('removes the only line of a single-line text, yielding empty string', () => {
    const text = 'aaa';
    const { start, end } = wholeLineRange(text, 0, 0);
    expect(cutRange(text, start, end)).toBe('');
  });

  it('is a no-op on empty text', () => {
    expect(cutRange('', 0, 0)).toBe('');
  });

  it('collapses a blank line left behind even without whole-line-aligned offsets', () => {
    // cutRange only inspects the text immediately around [start, end); it
    // does not require the range to come from wholeLineRange. Cutting "XX"
    // out of "a\nXX\nb" leaves before="a\n" and after="\nb", which is exactly
    // the collapse case.
    expect(cutRange('a\nXX\nb', 2, 4)).toBe('a\nb');
  });
});

describe('insertLine', () => {
  it('inserts into empty text as just the line', () => {
    expect(insertLine('', 0, 'NEW')).toBe('NEW');
  });

  it('inserts a new line after an existing line via offsetAfterLine', () => {
    const text = 'aaa\nbbb';
    const at = offsetAfterLine(text, 0);
    expect(insertLine(text, at, 'NEW')).toBe('aaa\nNEW\nbbb');
  });

  it('appends a new final line when offset is at text.length with no trailing newline', () => {
    const text = 'aaa\nbbb';
    expect(insertLine(text, text.length, 'NEW')).toBe('aaa\nbbb\nNEW');
  });

  it('prepends a new first line when offset is 0', () => {
    const text = 'bbb\nccc';
    expect(insertLine(text, 0, 'NEW')).toBe('NEW\nbbb\nccc');
  });

  it('does not add a redundant newline when inserting right at an existing newline boundary', () => {
    const text = 'aaa\nbbb';
    // offset 4 is right after the '\n' that follows "aaa" (start of "bbb")
    expect(insertLine(text, 4, 'NEW')).toBe('aaa\nNEW\nbbb');
  });

  it('clamps an out-of-range offset into [0, text.length]', () => {
    const text = 'aaa';
    expect(insertLine(text, -10, 'NEW')).toBe('NEW\naaa');
    expect(insertLine(text, 999, 'NEW')).toBe('aaa\nNEW');
  });
});

describe('moveLineBlock', () => {
  const text = 'aaa\nbbb\nccc\nddd';

  it('moves a line down, below a later line', () => {
    expect(moveLineBlock(text, 0, 0, 2, 'below')).toBe('bbb\nccc\naaa\nddd');
  });

  it('moves a line up, above an earlier line', () => {
    expect(moveLineBlock(text, 3, 3, 1, 'above')).toBe('aaa\nddd\nbbb\nccc');
  });

  it('moves a line down, above a later line', () => {
    expect(moveLineBlock(text, 0, 0, 3, 'above')).toBe('bbb\nccc\naaa\nddd');
  });

  it('moves a line to the very top and to the very bottom', () => {
    expect(moveLineBlock(text, 2, 2, 0, 'above')).toBe('ccc\naaa\nbbb\nddd');
    expect(moveLineBlock(text, 1, 1, 3, 'below')).toBe('aaa\nccc\nddd\nbbb');
  });

  it('moves a multi-line block, keeping its internal order', () => {
    expect(moveLineBlock(text, 0, 1, 3, 'below')).toBe('ccc\nddd\naaa\nbbb');
    expect(moveLineBlock(text, 2, 3, 0, 'above')).toBe('ccc\nddd\naaa\nbbb');
  });

  it('is a no-op when the target sits inside the moved block', () => {
    expect(moveLineBlock(text, 0, 2, 1, 'above')).toBe(text);
    expect(moveLineBlock(text, 1, 1, 1, 'below')).toBe(text);
  });

  it('is a no-op when the block would land where it already is', () => {
    // Just above itself, and just below itself.
    expect(moveLineBlock(text, 2, 2, 1, 'below')).toBe(text);
    expect(moveLineBlock(text, 2, 2, 3, 'above')).toBe(text);
    expect(moveLineBlock(text, 0, 1, 2, 'above')).toBe(text);
  });

  it('clamps out-of-range indices into bounds', () => {
    expect(moveLineBlock(text, -5, -5, 999, 'below')).toBe('bbb\nccc\nddd\naaa');
    expect(moveLineBlock(text, 999, 999, -5, 'above')).toBe('ddd\naaa\nbbb\nccc');
  });

  it('is a no-op on a single-line text', () => {
    expect(moveLineBlock('aaa', 0, 0, 0, 'below')).toBe('aaa');
  });

  it('is a no-op on empty text', () => {
    expect(moveLineBlock('', 0, 0, 0, 'above')).toBe('');
  });

  it('treats the phantom line after a trailing newline as a real slot', () => {
    // split('\n') gives ['aaa', 'bbb', ''] here; moving onto that empty slot is
    // how a line gets dragged past the end of a note that ends in a newline.
    expect(moveLineBlock('aaa\nbbb\n', 0, 0, 2, 'below')).toBe('bbb\n\naaa');
    expect(moveLineBlock('aaa\nbbb\n', 0, 0, 2, 'above')).toBe('bbb\naaa\n');
  });
});
