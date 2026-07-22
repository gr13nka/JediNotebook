import { useRef, useState } from 'react';

/**
 * Drag-to-reorder for a flat list of rows, shared by every list in the app that
 * lets you drag a row and drop it above/below another row (project tasks,
 * selectable task rows, project cards).
 *
 * Owns the two pieces every one of those lists had reimplemented identically:
 * the in-flight drag index (a ref, not state — it must survive without
 * re-rendering the row being dragged) and the hit-test that turns a dragover's
 * `clientY` into an "above" or "below" insertion relative to the hovered row.
 * `onReorder` receives the full id list in its new order; callers decide what
 * "reorder" means for their data (persist it, splice in extra ids, or just
 * hold it in local state).
 */
export interface UseReorderListOptions<T> {
  /** Rows in their current display order — drag/drop indexes into this array. */
  items: T[];
  getId: (item: T) => string;
  /** Called with every item's id, in the new order, once a drop completes. */
  onReorder: (orderedIds: string[]) => void;
  /**
   * Extra work to run at the end of a row's dragstart, after this hook has set
   * `dataTransfer.effectAllowed = 'move'` — e.g. also advertising a payload for
   * a drop target outside this list. May overwrite `effectAllowed` itself.
   */
  onDragStart?: (item: T, index: number, e: React.DragEvent) => void;
  /**
   * Stop the three drag events from bubbling past this list's rows. Needed
   * only when the list is nested inside another draggable/reorderable
   * ancestor (e.g. task rows inside a project card that is itself dragged to
   * reorder projects) — otherwise a row drag would also register as a drag on
   * the ancestor.
   */
  stopPropagation?: boolean;
}

export type DropPosition = 'above' | 'below';

export interface ReorderRowProps {
  draggable: true;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: DropPosition | null;
}

export interface UseReorderListResult {
  /** Drag handlers + indicator state for row `index`. Spread onto its draggable element. */
  getRowProps(index: number): ReorderRowProps;
  /** Wire to the list container's `onDragEnd` — always clears drag state. */
  handleDragEnd(): void;
  /** Wire to the list container's `onDragLeave` — clears only the drop indicator, keeping the drag active. */
  handleDragLeave(): void;
}

export function useReorderList<T>({
  items,
  getId,
  onReorder,
  onDragStart,
  stopPropagation = false,
}: UseReorderListOptions<T>): UseReorderListResult {
  const dragIdx = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: DropPosition } | null>(null);

  const getRowProps = (index: number): ReorderRowProps => ({
    draggable: true,
    onDragStart: (e) => {
      if (stopPropagation) e.stopPropagation();
      dragIdx.current = index;
      e.dataTransfer.effectAllowed = 'move';
      onDragStart?.(items[index], index, e);
    },
    onDragOver: (e) => {
      e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      if (dragIdx.current === null || dragIdx.current === index) {
        setDropTarget(null);
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position: DropPosition = e.clientY < midY ? 'above' : 'below';
      setDropTarget({ index, position });
    },
    onDrop: (e) => {
      e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      const from = dragIdx.current;
      if (from === null || from === index) {
        dragIdx.current = null;
        setDropTarget(null);
        return;
      }
      const ordered = items.map(getId);
      const [moved] = ordered.splice(from, 1);
      const insertAt = dropTarget?.position === 'below'
        ? index + (from < index ? 0 : 1)
        : index - (from < index ? 1 : 0);
      ordered.splice(Math.max(0, insertAt), 0, moved);
      onReorder(ordered);
      dragIdx.current = null;
      setDropTarget(null);
    },
    isDragOver: dropTarget?.index === index ? dropTarget.position : null,
  });

  const handleDragEnd = () => {
    setDropTarget(null);
    dragIdx.current = null;
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  return { getRowProps, handleDragEnd, handleDragLeave };
}
