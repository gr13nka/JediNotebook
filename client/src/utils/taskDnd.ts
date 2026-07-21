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

export function setTaskPayload(e: React.DragEvent, taskId: string, title: string): void {
  e.dataTransfer.setData(TASK_MIME, JSON.stringify({ taskId, title }));
  e.dataTransfer.setData('text/plain', title);
  e.dataTransfer.effectAllowed = 'copy';
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
 * Resolves a character offset in `textarea` from a drop point.
 * Falls back to the end of the text when the engine does not support
 * caret-from-point (WebKit coverage is uneven).
 */
export function caretOffsetFromPoint(
  textarea: HTMLTextAreaElement,
  clientX: number,
  clientY: number,
): number {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(clientX, clientY);
    if (pos && textarea.contains(pos.offsetNode)) return pos.offset;
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(clientX, clientY);
    if (range && textarea.contains(range.startContainer)) return range.startOffset;
  }
  return textarea.value.length;
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
