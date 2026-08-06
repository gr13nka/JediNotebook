/**
 * The drag contract between the project description editor and the task panel.
 *
 * Custom MIME types are used so foreign drags (a file, a link, text from another
 * app) are ignored rather than silently turned into tasks. `effectAllowed` is
 * always 'copy': the browser must never mutate the drag source itself, because
 * every move in this feature is performed explicitly by our own handlers, and
 * engines disagree about when a 'move' effect deletes source text.
 */

const TEXT_MIME = 'application/x-jedi-text';
const TASK_MIME = 'application/x-jedi-task';

export interface TextPayload {
  kind: 'text';
  text: string;
  /** Offsets into the textarea's value, so the exact range can be cut out. */
  start: number;
  end: number;
  /**
   * Source line range, present only when the dragged text covers whole lines.
   * That is what makes a drag re-orderable *within* the note: a block of whole
   * lines can be spliced to another position, an arbitrary mid-line selection
   * cannot. Absent for a partial selection dragged out of the textarea.
   */
  lineStart?: number;
  lineEnd?: number;
}

export interface TaskPayload {
  kind: 'task';
  taskId: string;
  title: string;
}

export type DragPayload = TextPayload | TaskPayload;

export function setTextPayload(
  e: React.DragEvent,
  text: string,
  start: number,
  end: number,
): void {
  e.dataTransfer.setData(TEXT_MIME, JSON.stringify({ text, start, end }));
  e.dataTransfer.setData('text/plain', text);
  e.dataTransfer.effectAllowed = 'copy';
}

/**
 * A whole-line block dragged by its grip in the rendered preview.
 *
 * Two differences from `setTextPayload`, both deliberate:
 *
 * - It carries the source line range, which is what lets the note itself accept
 *   the drop and re-order the block (see `moveLineBlock`).
 * - `effectAllowed` is 'copyMove', for the same reason `setTaskPayload` uses it:
 *   this one drag has two possible targets that ask for different effects — the
 *   note sets dropEffect 'move' to re-order, the task panel sets 'copy' — and a
 *   dropEffect incompatible with effectAllowed silently cancels the drop. The
 *   'copy'-only pinning that `setTextPayload` needs does not apply here, because
 *   the source is a preview element, not a text control the engine might mutate.
 */
export function setLineBlockPayload(
  e: React.DragEvent,
  text: string,
  start: number,
  end: number,
  lineStart: number,
  lineEnd: number,
): void {
  e.dataTransfer.setData(TEXT_MIME, JSON.stringify({ text, start, end, lineStart, lineEnd }));
  e.dataTransfer.setData('text/plain', text);
  e.dataTransfer.effectAllowed = 'copyMove';
}

/**
 * `effectAllowed` is 'copyMove' here, not 'copy'.
 *
 * A task row is the source of two different drags: reordering within the task
 * list, whose dragover sets dropEffect 'move', and dropping into the
 * description, which sets 'copy'. A dropEffect incompatible with effectAllowed
 * resolves the drag operation to "none" and the drop event never fires — so
 * pinning this to 'copy' would silently break reordering. Unlike a text
 * selection, a task row has no native source mutation to guard against, so
 * permitting 'move' costs nothing.
 */
export function setTaskPayload(e: React.DragEvent, taskId: string, title: string): void {
  e.dataTransfer.setData(TASK_MIME, JSON.stringify({ taskId, title }));
  e.dataTransfer.setData('text/plain', title);
  e.dataTransfer.effectAllowed = 'copyMove';
}

/**
 * Reads a payload on drop. Returns null for anything we did not originate.
 *
 * Note: only `types` is readable during dragover — the data itself is not. Use
 * `hasPayload` for hover feedback and this for the drop itself.
 */
export function readPayload(e: React.DragEvent): DragPayload | null {
  const rawText = e.dataTransfer.getData(TEXT_MIME);
  if (rawText) {
    try {
      const { text, start, end, lineStart, lineEnd } = JSON.parse(rawText);
      return { kind: 'text', text, start, end, lineStart, lineEnd };
    } catch {
      return null;
    }
  }
  const rawTask = e.dataTransfer.getData(TASK_MIME);
  if (rawTask) {
    try {
      const { taskId, title } = JSON.parse(rawTask);
      return { kind: 'task', taskId, title };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Whether a drag in progress carries the given payload kind. Safe during
 * dragover. Takes anything with a `dataTransfer`, so a native DragEvent from a
 * document-level listener works as well as React's synthetic one.
 */
export function hasPayload(
  e: { dataTransfer: DataTransfer | null },
  kind: 'text' | 'task',
): boolean {
  const mime = kind === 'text' ? TEXT_MIME : TASK_MIME;
  return Array.from(e.dataTransfer?.types ?? []).includes(mime);
}

/** True when the user asked to copy rather than move (⌘ on macOS, Ctrl elsewhere). */
export function isCopyModifier(e: React.DragEvent): boolean {
  return e.metaKey || e.ctrlKey;
}

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
