import type React from 'react';
import { useCallback, useId, useRef, useState } from 'react';
import {
  isInteractiveDragTarget,
  reorderIds,
  resolveDropSide,
  startDrag,
  useActiveDrag,
  useDropTarget,
  type DragPayload,
  type DropSide,
} from './useDragGesture';

/**
 * Drag-to-reorder for a flat list of rows, shared by every list in the app that
 * lets you drag a row above or below another row (project tasks, selectable
 * task rows, project rows).
 *
 * Runs on the pointer drag channel (`useDragGesture`), so it works from a
 * finger as well as a mouse. Two consequences worth knowing:
 *
 * - The list *container* is the drop target, not each row. Rows are found
 *   inside it by `data-reorder-id` and the pointer's coordinates, which is one
 *   registration per list instead of one per row.
 * - Rows are scoped by list id rather than by where events stop bubbling. A
 *   task row dragged inside a project card used to need `stopPropagation` so
 *   its drag would not also register on the card's own draggable header; now
 *   the card's row list simply does not accept a drag whose list id is not
 *   its own.
 */
export interface UseReorderListOptions<T> {
  /** Rows in their current display order. */
  items: T[];
  getId: (item: T) => string;
  /** Called with every item's id, in the new order, once a drop completes. */
  onReorder: (orderedIds: string[]) => void;
  /** Text the drag ghost carries. */
  getLabel: (item: T) => string;
  /**
   * Payload offered to drop targets *outside* this list — e.g. a task row that
   * can also be dropped into a project note. Omit for a list that only
   * reorders itself.
   */
  getPayload?: (item: T) => DragPayload;
}

export interface ReorderRowProps {
  /** Render as `data-reorder-id` on the element whose box decides above/below. */
  rowId: string;
  /**
   * Put on whatever starts the drag — the whole row, or a grip inside it. A row
   * that owns another pointer gesture (the swipe on `SelectableTaskRow`) must
   * use a grip, or the two gestures would both claim the press.
   */
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  isDragOver: DropSide | null;
  isDragging: boolean;
}

export interface UseReorderListResult {
  /** Spread on the element wrapping the rows — it is the drop target. */
  containerProps: { ref: (node: HTMLElement | null) => void };
  /** Drag handlers + indicator state for row `index`. */
  getRowProps(index: number): ReorderRowProps;
}

const REORDER_ID_ATTR = 'reorderId';

/**
 * The row under a point, and its box. Restricted to `ids`, so a nested list's
 * rows (task rows inside a project card whose header is itself a row) cannot be
 * mistaken for rows of this list.
 */
function rowAtPoint(
  x: number,
  y: number,
  ids: string[],
): { id: string; rect: DOMRect } | null {
  let element: Element | null = document.elementFromPoint(x, y);
  while (element) {
    if (element instanceof HTMLElement) {
      const id = element.dataset[REORDER_ID_ATTR];
      if (id !== undefined && ids.includes(id)) {
        return { id, rect: element.getBoundingClientRect() };
      }
    }
    element = element.parentElement;
  }
  return null;
}

export function useReorderList<T>({
  items,
  getId,
  onReorder,
  getLabel,
  getPayload,
}: UseReorderListOptions<T>): UseReorderListResult {
  const listId = useId();
  const [dropTarget, setDropTarget] = useState<{ id: string; side: DropSide } | null>(null);
  const drag = useActiveDrag();
  const draggingId = drag?.spec.list?.id === listId ? drag.spec.list.itemId : null;

  // Read inside the drop-target callbacks, which are registered once per node
  // and must not close over a stale render's items.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const resolveHit = useCallback((x: number, y: number, movingId: string) => {
    const ids = itemsRef.current.map(getId);
    const hit = rowAtPoint(x, y, ids);
    if (!hit || hit.id === movingId) return null;
    return { ids, id: hit.id, side: resolveDropSide(hit.rect, y) };
  }, [getId]);

  const { ref } = useDropTarget({
    accepts: (active) => active.spec.list?.id === listId,
    onOver: (active, x, y) => {
      const movingId = active.spec.list?.itemId ?? '';
      const hit = resolveHit(x, y, movingId);
      setDropTarget((previous) => {
        if (!hit) return previous === null ? previous : null;
        if (previous?.id === hit.id && previous.side === hit.side) return previous;
        return { id: hit.id, side: hit.side };
      });
    },
    onLeave: () => setDropTarget(null),
    // Resolved from the drop coordinates rather than from `dropTarget`: the
    // indicator is state and may lag a move behind, and a drop must land where
    // the pointer actually is.
    onDrop: (active, x, y) => {
      setDropTarget(null);
      const movingId = active.spec.list?.itemId;
      if (!movingId) return;
      const hit = resolveHit(x, y, movingId);
      if (!hit) return;
      const next = reorderIds(hit.ids, movingId, hit.id, hit.side);
      if (next !== hit.ids) onReorderRef.current(next);
    },
  });

  const getRowProps = (index: number): ReorderRowProps => {
    const item = items[index];
    const id = getId(item);
    return {
      rowId: id,
      onPointerDown: (event) => {
        // The row's own checkbox, delete button and title editor keep working
        // when the whole row is the drag source.
        if (isInteractiveDragTarget(event.target)) return;
        startDrag(event, {
          ghost: { label: getLabel(item) },
          payload: getPayload?.(item),
          list: { id: listId, itemId: id },
        });
      },
      isDragOver: dropTarget?.id === id ? dropTarget.side : null,
      isDragging: draggingId === id,
    };
  };

  return { containerProps: { ref }, getRowProps };
}
