export interface ReorderMeasurement {
  id: string;
  top: number;
  height: number;
}

export const TODAY_REORDER_EDGE_SIZE = 72;
export const TODAY_REORDER_MAX_SCROLL = 18;

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function reorderIdsByActiveCenter(
  orderedIds: string[],
  activeId: string,
  activeCenterY: number,
  measurements: ReorderMeasurement[],
): string[] {
  if (!orderedIds.includes(activeId)) return orderedIds;

  const measurementById = new Map(measurements.map((m) => [m.id, m]));
  const remaining = orderedIds.filter((id) => id !== activeId);
  let insertAt = remaining.length;

  for (let i = 0; i < remaining.length; i++) {
    const measurement = measurementById.get(remaining[i]);
    if (!measurement) continue;
    if (activeCenterY <= measurement.top + measurement.height / 2) {
      insertAt = i;
      break;
    }
  }

  const next = [...remaining];
  next.splice(insertAt, 0, activeId);
  return sameOrder(orderedIds, next) ? orderedIds : next;
}

export function buildTodayBoxOrder(incompleteIds: string[], completedIds: string[]): string[] {
  return [...incompleteIds, ...completedIds];
}

export function computeTodayAutoScrollDelta(
  pointerY: number,
  viewportTop: number,
  viewportBottom: number,
  edgeSize = TODAY_REORDER_EDGE_SIZE,
  maxScroll = TODAY_REORDER_MAX_SCROLL,
): number {
  const height = viewportBottom - viewportTop;
  if (height <= 0) return 0;

  const edge = Math.min(edgeSize, height / 2);
  if (pointerY < viewportTop + edge) {
    const pressure = Math.min(1, (viewportTop + edge - pointerY) / edge);
    return -maxScroll * pressure;
  }
  if (pointerY > viewportBottom - edge) {
    const pressure = Math.min(1, (pointerY - (viewportBottom - edge)) / edge);
    return maxScroll * pressure;
  }
  return 0;
}
