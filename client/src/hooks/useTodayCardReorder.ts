import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, PointerEvent, RefObject } from 'react';
import {
  computeTodayAutoScrollDelta,
  reorderIdsByActiveCenter,
  type ReorderMeasurement,
} from '../utils/todayReorder';

const MOUSE_ACTIVATION_DISTANCE = 6;
const TOUCH_CANCEL_DISTANCE = 8;
const TOUCH_HOLD_MS = 180;

interface UseTodayCardReorderOptions<T> {
  items: T[];
  getId: (item: T) => string;
  onCommit: (orderedIds: string[]) => void;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}

interface DragState {
  id: string;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  lastPointerY: number;
  grabOffsetY: number;
  transformY: number;
  activated: boolean;
  originalIds: string[];
}

interface SelectionStyles {
  bodyUserSelect: string;
  bodyWebkitUserSelect: string;
  documentUserSelect: string;
  documentWebkitUserSelect: string;
}

export interface TodayCardReorderProps {
  setDragNode: (node: HTMLDivElement | null) => void;
  onPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: PointerEvent<HTMLDivElement>) => void;
  onClickCapture: (e: MouseEvent<HTMLDivElement>) => void;
  isDragging: boolean;
  dragY: number;
}

function idsEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest('button, input, textarea, select, a, [contenteditable="true"], [data-no-card-drag="true"]'),
  );
}

function trySetPointerCapture(node: HTMLDivElement, pointerId: number): void {
  try {
    if (!node.hasPointerCapture(pointerId)) node.setPointerCapture(pointerId);
  } catch {
    // Some embedded WebViews can invalidate a touch pointer before the hold timer fires.
  }
}

function tryReleasePointerCapture(node: HTMLDivElement, pointerId: number): void {
  try {
    if (node.hasPointerCapture(pointerId)) node.releasePointerCapture(pointerId);
  } catch {
    // The pointer may already be gone after a native cancellation.
  }
}

export function useTodayCardReorder<T>({
  items,
  getId,
  onCommit,
  scrollContainerRef,
}: UseTodayCardReorderOptions<T>) {
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<DragState | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const selectionStylesRef = useRef<SelectionStyles | null>(null);
  const suppressClickRef = useRef(false);
  const clearSuppressClickTimerRef = useRef<number | null>(null);

  const [orderedIds, setOrderedIds] = useState(() => items.map(getId));
  const [activeView, setActiveView] = useState<{ id: string; y: number } | null>(null);

  const orderedIdsRef = useRef(orderedIds);
  const itemsRef = useRef(items);

  useEffect(() => {
    orderedIdsRef.current = orderedIds;
  }, [orderedIds]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) {
      window.cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const clearSuppressClickTimer = useCallback(() => {
    if (clearSuppressClickTimerRef.current !== null) {
      window.clearTimeout(clearSuppressClickTimerRef.current);
      clearSuppressClickTimerRef.current = null;
    }
  }, []);

  const disableTextSelection = useCallback(() => {
    if (selectionStylesRef.current !== null) return;
    const root = document.documentElement;
    selectionStylesRef.current = {
      bodyUserSelect: document.body.style.userSelect,
      bodyWebkitUserSelect: document.body.style.webkitUserSelect,
      documentUserSelect: root.style.userSelect,
      documentWebkitUserSelect: root.style.webkitUserSelect,
    };
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    root.style.userSelect = 'none';
    root.style.webkitUserSelect = 'none';
    window.getSelection()?.removeAllRanges();
  }, []);

  const restoreUserSelect = useCallback(() => {
    const previous = selectionStylesRef.current;
    if (previous === null) return;
    const root = document.documentElement;
    document.body.style.userSelect = previous.bodyUserSelect;
    document.body.style.webkitUserSelect = previous.bodyWebkitUserSelect;
    root.style.userSelect = previous.documentUserSelect;
    root.style.webkitUserSelect = previous.documentWebkitUserSelect;
    selectionStylesRef.current = null;
  }, []);

  const setDragNode = useCallback((id: string) => (node: HTMLDivElement | null) => {
    if (node) {
      itemRefs.current.set(id, node);
    } else {
      itemRefs.current.delete(id);
    }
  }, []);

  const measureCards = useCallback((activeId: string): ReorderMeasurement[] => {
    return orderedIdsRef.current
      .filter((id) => id !== activeId)
      .map((id) => {
        const node = itemRefs.current.get(id);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { id, top: rect.top, height: rect.height };
      })
      .filter((measurement): measurement is ReorderMeasurement => measurement !== null);
  }, []);

  const updateDraggedPosition = useCallback((pointerY: number) => {
    const drag = dragRef.current;
    if (!drag?.activated) return;

    const node = itemRefs.current.get(drag.id);
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const desiredTop = pointerY - drag.grabOffsetY;
    const nextY = drag.transformY + desiredTop - rect.top;
    drag.transformY = nextY;
    setActiveView({ id: drag.id, y: nextY });
  }, []);

  const reorderFromPointer = useCallback((pointerY: number) => {
    const drag = dragRef.current;
    if (!drag?.activated) return;

    const activeNode = itemRefs.current.get(drag.id);
    if (!activeNode) return;

    const activeHeight = activeNode.getBoundingClientRect().height;
    const activeCenterY = pointerY - drag.grabOffsetY + activeHeight / 2;
    const nextIds = reorderIdsByActiveCenter(
      orderedIdsRef.current,
      drag.id,
      activeCenterY,
      measureCards(drag.id),
    );

    if (nextIds !== orderedIdsRef.current) {
      orderedIdsRef.current = nextIds;
      setOrderedIds(nextIds);
      window.requestAnimationFrame(() => updateDraggedPosition(drag.lastPointerY));
    }
  }, [measureCards, updateDraggedPosition]);

  const runAutoScroll = useCallback(() => {
    const drag = dragRef.current;
    if (!drag?.activated) return;

    const container = scrollContainerRef?.current ?? null;
    const viewport = container
      ? container.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    const delta = computeTodayAutoScrollDelta(drag.lastPointerY, viewport.top, viewport.bottom);

    if (delta !== 0) {
      if (container) {
        container.scrollTop += delta;
      } else {
        window.scrollBy(0, delta);
      }
      updateDraggedPosition(drag.lastPointerY);
      reorderFromPointer(drag.lastPointerY);
    }

    autoScrollRef.current = window.requestAnimationFrame(runAutoScroll);
  }, [reorderFromPointer, scrollContainerRef, updateDraggedPosition]);

  const startAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) return;
    autoScrollRef.current = window.requestAnimationFrame(runAutoScroll);
  }, [runAutoScroll]);

  const activateDrag = useCallback((node: HTMLDivElement) => {
    const drag = dragRef.current;
    if (!drag || drag.activated) return;

    const rect = node.getBoundingClientRect();
    drag.activated = true;
    drag.grabOffsetY = drag.startY - rect.top;
    drag.transformY = 0;
    suppressClickRef.current = true;
    disableTextSelection();
    setActiveView({ id: drag.id, y: 0 });
    startAutoScroll();
  }, [disableTextSelection, startAutoScroll]);

  const cancelPendingDrag = useCallback(() => {
    clearHoldTimer();
    dragRef.current = null;
  }, [clearHoldTimer]);

  const finishDrag = useCallback((commit: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;

    clearHoldTimer();
    stopAutoScroll();
    restoreUserSelect();
    dragRef.current = null;
    setActiveView(null);

    if (!drag.activated) return;

    if (commit) {
      const finalIds = orderedIdsRef.current;
      if (!idsEqual(finalIds, drag.originalIds)) onCommit(finalIds);
    } else {
      orderedIdsRef.current = drag.originalIds;
      setOrderedIds(drag.originalIds);
    }

    clearSuppressClickTimer();
    clearSuppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      clearSuppressClickTimerRef.current = null;
    }, 0);
  }, [clearHoldTimer, onCommit, restoreUserSelect, stopAutoScroll]);

  useEffect(() => {
    const nextIds = items.map(getId);
    const drag = dragRef.current;

    if (!drag?.activated) {
      orderedIdsRef.current = nextIds;
      setOrderedIds(nextIds);
      return;
    }

    if (!nextIds.includes(drag.id)) {
      finishDrag(false);
      orderedIdsRef.current = nextIds;
      setOrderedIds(nextIds);
      return;
    }

    const reconciled = orderedIdsRef.current.filter((id) => nextIds.includes(id));
    for (const id of nextIds) {
      if (!reconciled.includes(id)) reconciled.push(id);
    }
    if (!idsEqual(reconciled, orderedIdsRef.current)) {
      orderedIdsRef.current = reconciled;
      setOrderedIds(reconciled);
    }
  }, [finishDrag, getId, items]);

  useEffect(() => {
    return () => {
      clearHoldTimer();
      stopAutoScroll();
      clearSuppressClickTimer();
      restoreUserSelect();
    };
  }, [clearHoldTimer, clearSuppressClickTimer, restoreUserSelect, stopAutoScroll]);

  const getCardProps = useCallback((id: string): TodayCardReorderProps => ({
    setDragNode: setDragNode(id),
    onPointerDown: (e) => {
      if (isInteractiveTarget(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const node = e.currentTarget;
      const pointerId = e.pointerId;
      if (e.pointerType !== 'touch') e.preventDefault();

      dragRef.current = {
        id,
        pointerId,
        pointerType: e.pointerType,
        startX: e.clientX,
        startY: e.clientY,
        lastPointerY: e.clientY,
        grabOffsetY: 0,
        transformY: 0,
        activated: false,
        originalIds: orderedIdsRef.current,
      };

      if (e.pointerType === 'touch') {
        holdTimerRef.current = window.setTimeout(() => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== pointerId || drag.activated) return;
          trySetPointerCapture(node, pointerId);
          activateDrag(node);
        }, TOUCH_HOLD_MS);
      } else {
        trySetPointerCapture(node, pointerId);
      }
    },
    onPointerMove: (e) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      drag.lastPointerY = e.clientY;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (!drag.activated) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (drag.pointerType === 'touch') {
          if (distance > TOUCH_CANCEL_DISTANCE) cancelPendingDrag();
          return;
        }
        if (distance < MOUSE_ACTIVATION_DISTANCE) return;
        activateDrag(e.currentTarget);
      }

      e.preventDefault();
      suppressClickRef.current = true;
      updateDraggedPosition(e.clientY);
      reorderFromPointer(e.clientY);
    },
    onPointerUp: (e) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      tryReleasePointerCapture(e.currentTarget, e.pointerId);
      finishDrag(true);
    },
    onPointerCancel: (e) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      tryReleasePointerCapture(e.currentTarget, e.pointerId);
      finishDrag(false);
    },
    onClickCapture: (e) => {
      if (!suppressClickRef.current) return;
      suppressClickRef.current = false;
      clearSuppressClickTimer();
      e.preventDefault();
      e.stopPropagation();
    },
    isDragging: activeView?.id === id,
    dragY: activeView?.id === id ? activeView.y : 0,
  }), [activateDrag, activeView, cancelPendingDrag, finishDrag, reorderFromPointer, setDragNode, updateDraggedPosition]);

  const itemById = new Map(items.map((item) => [getId(item), item]));
  const orderedItems = orderedIds
    .map((id) => itemById.get(id))
    .filter((item): item is T => item !== undefined);

  return { orderedItems, getCardProps };
}
