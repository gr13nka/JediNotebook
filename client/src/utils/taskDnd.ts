/**
 * Offset arithmetic for moving text between a project note and its task panel.
 *
 * The drag itself is not here — it runs on the pointer channel
 * (`hooks/useDragGesture.ts`), which owns the payloads and the drop targets.
 * What stays here is the part that has nothing to do with pointers: mapping
 * between the rendered preview and offsets in the note's source text, and the
 * splices that add, remove and re-order whole lines. All of it is pure, and all
 * of it corrupts the user's note when it is wrong, so it is tested directly.
 */

/**
 * Mapping between the rendered description preview and offsets in its source.
 *
 * The preview renders exactly one element per source line, tagged with
 * `data-line-index`. That tag is the only reliable way to locate a drop point
 * or a selection in the source text: the caret-from-point APIs cannot be used
 * here, because the textarea is hidden whenever the preview is showing, and
 * because they resolve into a text control's internal shadow tree, which
 * `Node.contains` does not reach.
 */
export const LINE_INDEX_ATTR = 'data-line-index';

export function lineIndexFromNode(node: Node | null): number | null {
  let el: HTMLElement | null =
    node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  while (el) {
    const attr = el.getAttribute(LINE_INDEX_ATTR);
    if (attr !== null) {
      const parsed = Number(attr);
      return Number.isNaN(parsed) ? null : parsed;
    }
    el = el.parentElement;
  }
  return null;
}

/** Which source line sits under a viewport point, or null if none does. */
export function lineIndexFromPoint(clientX: number, clientY: number): number | null {
  return lineIndexFromNode(document.elementFromPoint(clientX, clientY));
}

/**
 * Character range covering whole source lines `startLine`..`endLine`.
 *
 * The trailing newline is excluded, so cutting the range leaves the newline
 * before it adjacent to the newline after it — which is exactly the case
 * `cutRange` collapses.
 */
export function wholeLineRange(
  text: string,
  startLine: number,
  endLine: number,
): { start: number; end: number } {
  const lines = text.split('\n');
  const first = Math.max(0, Math.min(startLine, lines.length - 1));
  const last = Math.max(first, Math.min(endLine, lines.length - 1));

  let start = 0;
  for (let i = 0; i < first; i++) start += lines[i].length + 1;

  let end = start;
  for (let i = first; i <= last; i++) {
    if (i > first) end += 1; // the newline joining this line to the previous
    end += lines[i].length;
  }
  return { start, end };
}

/** Offset just past the end of `lineIndex`, before its trailing newline. */
export function offsetAfterLine(text: string, lineIndex: number): number {
  return wholeLineRange(text, lineIndex, lineIndex).end;
}

/**
 * Which source line an offset falls on.
 *
 * The inverse direction from everything else here, and needed for one case: a
 * selection inside the textarea is reported as offsets, but deciding whether a
 * press landed *on* that selection has to happen in line space, because that is
 * the only granularity the preview's geometry can answer in.
 */
export function lineOfOffset(text: string, offset: number): number {
  const limit = Math.max(0, Math.min(offset, text.length));
  let line = 0;
  for (let i = 0; i < limit; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

/** Removes [start, end) from `text`, collapsing the blank line it may leave behind. */
export function cutRange(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const joined = before + after;
  // A whole line dragged out leaves "\n\n" where there was one line; collapse it
  // so the description does not accumulate blank lines.
  if (before.endsWith('\n') && after.startsWith('\n')) {
    return before + after.slice(1);
  }
  // Same case at the top of the text, where there is no preceding newline to
  // pair with — otherwise cutting the first line leaves a blank line behind.
  if (before === '' && after.startsWith('\n')) {
    return after.slice(1);
  }
  return joined;
}

/**
 * Moves whole source lines `lineStart`..`lineEnd` to sit just above or below
 * `targetLine`, and returns the rebuilt text.
 *
 * Deliberately splices the line array rather than doing offset arithmetic:
 * removing a block shifts every offset after it, and the target offset would
 * have to be re-derived against the post-removal text. Line indices have no
 * such coupling, so the whole operation is one splice out and one splice in.
 *
 * Returns `text` unchanged when the move is a no-op — the target sits inside
 * the block being moved, or the block would land exactly where it already is.
 */
export function moveLineBlock(
  text: string,
  lineStart: number,
  lineEnd: number,
  targetLine: number,
  position: 'above' | 'below',
): string {
  const lines = text.split('\n');
  const first = Math.max(0, Math.min(lineStart, lines.length - 1));
  const last = Math.max(first, Math.min(lineEnd, lines.length - 1));
  const target = Math.max(0, Math.min(targetLine, lines.length - 1));

  // Dropping onto the block itself has no meaning — it is already there.
  if (target >= first && target <= last) return text;

  const insertAt = position === 'below' ? target + 1 : target;
  // Landing immediately before the block, or immediately after it, is the
  // position it already occupies.
  if (insertAt === first || insertAt === last + 1) return text;

  const block = lines.slice(first, last + 1);
  lines.splice(first, block.length);
  // Removing the block shifts everything after it up by its length.
  const shifted = insertAt > last ? insertAt - block.length : insertAt;
  lines.splice(shifted, 0, ...block);
  return lines.join('\n');
}

/** Inserts `line` into `text` at `offset` as its own line. */
export function insertLine(text: string, offset: number, line: string): string {
  const at = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, at);
  const after = text.slice(at);
  const prefix = before === '' || before.endsWith('\n') ? '' : '\n';
  const suffix = after === '' || after.startsWith('\n') ? '' : '\n';
  return before + prefix + line + suffix + after;
}
