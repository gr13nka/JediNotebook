import type React from 'react';
import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
// Pure edge-pressure arithmetic; the `Today` in the name is where it was first
// needed, not a restriction — it takes its viewport and limits as arguments.
import { computeTodayAutoScrollDelta } from '../utils/todayReorder';

/**
 * The app's one drag channel.
 *
 * Everything draggable — note lines, task rows, project rows in the tree —
 * goes through pointer events and this module. There is deliberately no HTML5
 * drag-and-drop here: `dragstart` never fires from a touch, so every HTML5
 * drag in the app was desktop-only, and a parallel touch channel beside it
 * would have meant writing each gesture twice. Pointer events cover mouse,
 * touch and pen with one code path.
 *
 * The shape follows from that choice. A native drag hands the browser the
 * gesture and lets each target answer `dragover`/`drop` on its own; a pointer
 * drag stays with the source (that is what pointer capture means), so targets
 * cannot be discovered by event bubbling and must announce themselves. Hence:
 *
 * - `startDrag` — a plain function, not a hook, so a list can arm any number
 *   of rows without one hook call per row.
 * - `useDropTarget` — registers a node, and the module hit-tests registered
 *   nodes with `elementFromPoint` on every move. The innermost node that
 *   *accepts* the drag wins, which is how a native drag behaves when an inner
 *   target declines to `preventDefault` and its parent handles the drop.
 * - Targets receive the pointer coordinates and resolve their own internal
 *   drop position. A note line cannot be hit-tested at all while the textarea
 *   covers the preview (`visibility: hidden` takes it out of hit-testing), so
 *   the only workable contract is "here is the point, you decide".
 */

export type DropSide = 'above' | 'below';

/** Text lifted out of a project note, with the source range so it can be cut. */
export interface TextDragPayload {
  kind: 'text';
  text: string;
  /** Offsets into the note's source text. */
  start: number;
  end: number;
  /**
   * Source line range, present only when the drag covers whole lines. That is
   * what makes a drag re-orderable *within* the note: a block of whole lines
   * can be spliced elsewhere, an arbitrary mid-line selection cannot.
   */
  lineStart?: number;
  lineEnd?: number;
}

export interface TaskDragPayload {
  kind: 'task';
  taskId: string;
  title: string;
}

export interface ProjectDragPayload {
  kind: 'project';
  projectId: string;
}

/**
 * What a drag offers to targets *outside* the list it was lifted from. A drag
 * that only reorders its own list carries no payload — its `list` field is the
 * whole contract.
 */
export type DragPayload = TextDragPayload | TaskDragPayload | ProjectDragPayload;

/** What follows the pointer. Rendered by `ui/DragGhost`. */
export interface DragGhostInfo {
  label: string;
  color?: string;
  icon?: string;
}

export interface DragSpec {
  ghost: DragGhostInfo;
  payload?: DragPayload;
  /**
   * List membership, when this drag can reorder the list it came from.
   * `id` scopes the drag to one list instance: a task row dragged inside a
   * project card must not reorder a *different* card's rows, and matching on
   * this id is what keeps them apart now that events no longer stop at a
   * list's own DOM subtree.
   */
  list?: { id: string; itemId: string };
}

export interface ActiveDrag {
  spec: DragSpec;
  pointerType: string;
  /** ⌘/Ctrl held: the drop should copy rather than move. */
  copy: boolean;
}

export interface DropTargetSpec {
  accepts: (drag: ActiveDrag) => boolean;
  /** Called on every move while this target is the one under the pointer. */
  onOver?: (drag: ActiveDrag, x: number, y: number) => void;
  onLeave?: () => void;
  onDrop: (drag: ActiveDrag, x: number, y: number) => void;
}

/** Distance a mouse or pen must travel before a press becomes a drag. */
const POINTER_ACTIVATION_PX = 4;

/**
 * Whether a press that has moved by (dx, dy) has become a drag.
 *
 * Split out as a pure function because it is the one rule that decides whether
 * a click stays a click, and it is the same rule for every draggable thing in
 * the app.
 */
export function dragActivation(dx: number, dy: number): 'wait' | 'activate' {
  return Math.hypot(dx, dy) >= POINTER_ACTIVATION_PX ? 'activate' : 'wait';
}

/** Which half of a row a point falls in — the insertion side. */
export function resolveDropSide(rect: { top: number; height: number }, y: number): DropSide {
  return y < rect.top + rect.height / 2 ? 'above' : 'below';
}

/**
 * `ids` with `draggedId` moved to sit above or below `targetId`.
 *
 * Works on ids rather than indices on purpose: the caller's array and the
 * pointer's target are resolved independently, and index arithmetic across a
 * removal ("does the target index shift?") is exactly where the previous
 * implementation was hard to check.
 */
export function reorderIds(
  ids: string[],
  draggedId: string,
  targetId: string,
  side: DropSide,
): string[] {
  const from = ids.indexOf(draggedId);
  const to = ids.indexOf(targetId);
  if (from === -1 || to === -1 || from === to) return ids;

  const next = ids.slice();
  next.splice(from, 1);
  // Removing the dragged id shifts everything after it down by one.
  const base = to > from ? to - 1 : to;
  next.splice(side === 'below' ? base + 1 : base, 0, draggedId);
  return next;
}

/** Rows whose own controls must keep working when the whole row is a drag source. */
export function isInteractiveDragTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest('button, input, textarea, select, a, [contenteditable="true"], [data-no-drag="true"]'),
  );
}

interface DragSession {
  spec: DragSpec;
  pointerId: number;
  pointerType: string;
  node: HTMLElement;
  startX: number;
  startY: number;
  x: number;
  y: number;
  copy: boolean;
  activated: boolean;
}

interface SavedSelectionStyles {
  bodyUserSelect: string;
  bodyWebkitUserSelect: string;
  rootUserSelect: string;
  rootWebkitUserSelect: string;
}

const registry = new Map<Element, () => DropTargetSpec>();

let session: DragSession | null = null;
let currentTarget: Element | null = null;
let savedSelection: SavedSelectionStyles | null = null;
let autoScrollFrame: number | null = null;
/** Swallows the click that a mouse always emits after a drag it did not mean. */
let suppressClick = false;
let suppressClickTimer: number | null = null;

let activeSnapshot: ActiveDrag | null = null;
let pointSnapshot: { x: number; y: number } | null = null;
const activeListeners = new Set<() => void>();
const pointListeners = new Set<() => void>();

function publishActive(next: ActiveDrag | null): void {
  activeSnapshot = next;
  for (const listener of activeListeners) listener();
}

function publishPoint(next: { x: number; y: number } | null): void {
  pointSnapshot = next;
  for (const listener of pointListeners) listener();
}

/** True while a drag is in flight. A non-reactive read, for effects that must stand aside. */
export function isDragActive(): boolean {
  return activeSnapshot !== null;
}

/**
 * The drag in flight, or null. Re-renders on start, end, and modifier changes
 * — not on movement, which only `useDragPointer` follows.
 */
export function useActiveDrag(): ActiveDrag | null {
  return useSyncExternalStore(
    (listener) => {
      activeListeners.add(listener);
      return () => activeListeners.delete(listener);
    },
    () => activeSnapshot,
  );
}

/** Where the pointer is, for whatever draws the ghost. Re-renders on every move. */
export function useDragPointer(): { x: number; y: number } | null {
  return useSyncExternalStore(
    (listener) => {
      pointListeners.add(listener);
      return () => pointListeners.delete(listener);
    },
    () => pointSnapshot,
  );
}

function snapshotOf(active: DragSession): ActiveDrag {
  return { spec: active.spec, pointerType: active.pointerType, copy: active.copy };
}

function disableTextSelection(): void {
  if (savedSelection !== null) return;
  const root = document.documentElement;
  savedSelection = {
    bodyUserSelect: document.body.style.userSelect,
    bodyWebkitUserSelect: document.body.style.webkitUserSelect,
    rootUserSelect: root.style.userSelect,
    rootWebkitUserSelect: root.style.webkitUserSelect,
  };
  document.body.style.userSelect = 'none';
  document.body.style.webkitUserSelect = 'none';
  root.style.userSelect = 'none';
  root.style.webkitUserSelect = 'none';
  window.getSelection()?.removeAllRanges();
}

function restoreTextSelection(): void {
  const saved = savedSelection;
  if (saved === null) return;
  const root = document.documentElement;
  document.body.style.userSelect = saved.bodyUserSelect;
  document.body.style.webkitUserSelect = saved.bodyWebkitUserSelect;
  root.style.userSelect = saved.rootUserSelect;
  root.style.webkitUserSelect = saved.rootWebkitUserSelect;
  savedSelection = null;
}

/**
 * Innermost registered target under the point that accepts this drag.
 *
 * Walking up and re-asking `accepts` at each level is what lets a task row
 * decline a note-text drag and let the task panel behind it take the drop.
 */
function findTarget(x: number, y: number, drag: ActiveDrag): Element | null {
  let element: Element | null = document.elementFromPoint(x, y);
  while (element) {
    const getSpec = registry.get(element);
    if (getSpec && getSpec().accepts(drag)) return element;
    element = element.parentElement;
  }
  return null;
}

function scrollableAncestor(element: Element | null): HTMLElement | null {
  let node: Element | null = element;
  while (node) {
    if (node instanceof HTMLElement) {
      const overflowY = window.getComputedStyle(node).overflowY;
      if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * Keeps a scrollable list moving when the pointer sits near its edge. A native
 * drag got this from the browser; a pointer drag has to do it, or a row cannot
 * be dragged past the bottom of a list taller than its container.
 */
function runAutoScroll(): void {
  const active = session;
  if (!active?.activated) return;

  const container = scrollableAncestor(document.elementFromPoint(active.x, active.y));
  if (container) {
    const rect = container.getBoundingClientRect();
    const delta = computeTodayAutoScrollDelta(active.y, rect.top, rect.bottom);
    if (delta !== 0) container.scrollTop += delta;
  }
  autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
}

function stopAutoScroll(): void {
  if (autoScrollFrame !== null) {
    window.cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = null;
  }
}

function leaveCurrentTarget(): void {
  if (!currentTarget) return;
  registry.get(currentTarget)?.().onLeave?.();
  currentTarget = null;
}

function armClickSuppression(): void {
  suppressClick = true;
  if (suppressClickTimer !== null) window.clearTimeout(suppressClickTimer);
  // A click that never arrives (touch, or a drop outside the window) must not
  // leave the next real click swallowed.
  suppressClickTimer = window.setTimeout(() => {
    suppressClick = false;
    suppressClickTimer = null;
  }, 0);
}

function handleClickCapture(event: MouseEvent): void {
  if (!suppressClick) return;
  suppressClick = false;
  event.preventDefault();
  event.stopPropagation();
}

function endSession(commit: boolean): void {
  const active = session;
  if (!active) return;

  document.removeEventListener('pointermove', handlePointerMove);
  document.removeEventListener('pointerup', handlePointerUp);
  document.removeEventListener('pointercancel', handlePointerCancel);
  document.removeEventListener('keydown', handleKeyDown);

  try {
    if (active.node.hasPointerCapture(active.pointerId)) {
      active.node.releasePointerCapture(active.pointerId);
    }
  } catch {
    // The pointer can already be gone after a native cancellation.
  }

  session = null;

  if (!active.activated) {
    leaveCurrentTarget();
    return;
  }

  const drag = snapshotOf(active);
  const target = commit ? findTarget(active.x, active.y, drag) : null;
  leaveCurrentTarget();

  stopAutoScroll();
  restoreTextSelection();
  publishActive(null);
  publishPoint(null);
  armClickSuppression();

  if (target) registry.get(target)?.().onDrop(drag, active.x, active.y);
}

function handlePointerMove(event: PointerEvent): void {
  const active = session;
  if (!active || active.pointerId !== event.pointerId) return;

  active.x = event.clientX;
  active.y = event.clientY;

  if (!active.activated) {
    if (dragActivation(event.clientX - active.startX, event.clientY - active.startY) === 'wait') {
      return;
    }
    active.activated = true;
    try {
      active.node.setPointerCapture(active.pointerId);
    } catch {
      // Some embedded WebViews invalidate a pointer before we get here; the
      // document-level listeners keep the drag working without capture.
    }
    disableTextSelection();
    publishActive(snapshotOf(active));
    autoScrollFrame = window.requestAnimationFrame(runAutoScroll);
  }

  // Suppresses the browser's own gesture (text selection, panning) now that
  // this press is ours.
  event.preventDefault();

  const copy = event.ctrlKey || event.metaKey;
  if (copy !== active.copy) {
    active.copy = copy;
    publishActive(snapshotOf(active));
  }

  publishPoint({ x: active.x, y: active.y });

  const drag = snapshotOf(active);
  const target = findTarget(active.x, active.y, drag);
  if (target !== currentTarget) {
    leaveCurrentTarget();
    currentTarget = target;
  }
  if (target) registry.get(target)?.().onOver?.(drag, active.x, active.y);
}

function handlePointerUp(event: PointerEvent): void {
  const active = session;
  if (!active || active.pointerId !== event.pointerId) return;
  active.x = event.clientX;
  active.y = event.clientY;
  active.copy = event.ctrlKey || event.metaKey;
  endSession(true);
}

function handlePointerCancel(event: PointerEvent): void {
  const active = session;
  if (!active || active.pointerId !== event.pointerId) return;
  endSession(false);
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') endSession(false);
}

/**
 * Arms a drag on this press. Nothing is published and no target is notified
 * until the pointer has actually moved — until then the press is still a click.
 *
 * Touch is refused for now: a press that becomes a drag immediately would take
 * scrolling away from every list. `feat(dnd): long-press starts a drag on
 * touch` is what opens this to fingers.
 */
export function startDrag(event: React.PointerEvent<HTMLElement>, spec: DragSpec): void {
  if (event.pointerType === 'touch') return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (session) endSession(false);

  session = {
    spec,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    node: event.currentTarget,
    startX: event.clientX,
    startY: event.clientY,
    x: event.clientX,
    y: event.clientY,
    copy: event.ctrlKey || event.metaKey,
    activated: false,
  };

  document.addEventListener('pointermove', handlePointerMove);
  document.addEventListener('pointerup', handlePointerUp);
  document.addEventListener('pointercancel', handlePointerCancel);
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Registers a node as a drop target for as long as it is mounted.
 *
 * `isOver` is local to this target rather than derived from a shared "current
 * target" value, so a drag moving across the screen only re-renders the two
 * targets whose state actually changed.
 */
export function useDropTarget(spec: DropTargetSpec): {
  ref: (node: HTMLElement | null) => void;
  isOver: boolean;
} {
  const [isOver, setIsOver] = useState(false);
  const specRef = useRef(spec);
  specRef.current = spec;
  const nodeRef = useRef<HTMLElement | null>(null);

  // Registered once per node, reading the spec through a ref: the callbacks a
  // target passes are rebuilt on most renders, and re-registering on each of
  // them would drop the registration mid-drag.
  const ref = useCallback((node: HTMLElement | null) => {
    const previous = nodeRef.current;
    if (previous) registry.delete(previous);
    nodeRef.current = node;
    if (!node) {
      setIsOver(false);
      return;
    }
    registry.set(node, () => ({
      accepts: (drag) => specRef.current.accepts(drag),
      onOver: (drag, x, y) => {
        setIsOver(true);
        specRef.current.onOver?.(drag, x, y);
      },
      onLeave: () => {
        setIsOver(false);
        specRef.current.onLeave?.();
      },
      onDrop: (drag, x, y) => {
        setIsOver(false);
        specRef.current.onDrop(drag, x, y);
      },
    }));
  }, []);

  return { ref, isOver };
}

// A single capturing listener for the whole app: after a drag, the mouse still
// emits a click on whatever it was released over, and that click would open a
// project, start editing a task title, or toggle a folder.
if (typeof document !== 'undefined') {
  document.addEventListener('click', handleClickCapture, true);
}
