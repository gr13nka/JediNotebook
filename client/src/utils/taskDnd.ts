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
      const { text, start, end } = JSON.parse(rawText);
      return { kind: 'text', text, start, end };
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

/** Whether a drag in progress carries the given payload kind. Safe during dragover. */
export function hasPayload(e: React.DragEvent, kind: 'text' | 'task'): boolean {
  const mime = kind === 'text' ? TEXT_MIME : TASK_MIME;
  return Array.from(e.dataTransfer.types).includes(mime);
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

/** Inserts `line` into `text` at `offset` as its own line. */
export function insertLine(text: string, offset: number, line: string): string {
  const at = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, at);
  const after = text.slice(at);
  const prefix = before === '' || before.endsWith('\n') ? '' : '\n';
  const suffix = after === '' || after.startsWith('\n') ? '' : '\n';
  return before + prefix + line + suffix + after;
}
