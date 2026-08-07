import { NEU } from '../../utils/shadows';
import { useActiveDrag, useDragPointer } from '../../hooks/useDragGesture';

/**
 * What follows the pointer during a drag.
 *
 * A native HTML5 drag rendered this for free (a translucent snapshot of the
 * source element); a pointer drag has to draw it. Mounted once for the whole
 * app rather than per draggable list, because every drag needs the same thing
 * and the source element is often not what should follow the cursor anyway —
 * a note line's grip is 24px wide, and it is the line's text you want to see.
 */
export function DragGhost() {
  const drag = useActiveDrag();
  const point = useDragPointer();

  if (!drag || !point) return null;

  const { label, color, icon } = drag.spec.ghost;

  return (
    <div
      className="pointer-events-none fixed z-[100] flex max-w-[320px] items-center gap-1.5 rounded-md border border-border bg-bg-card px-2 py-1"
      style={{
        // Offset from the pointer so the ghost never sits under it — the drop
        // target is resolved by `elementFromPoint`, and a ghost centred on the
        // pointer would be the topmost element there if it ever stopped being
        // pointer-events:none.
        left: point.x + 12,
        top: point.y - 10,
        boxShadow: NEU.modal,
        opacity: 0.9,
      }}
    >
      {icon ? (
        <span className="shrink-0 text-[12px] leading-none">{icon}</span>
      ) : color ? (
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      ) : null}
      <span className="truncate whitespace-nowrap text-[12px] text-text-primary">
        {label}
      </span>
      {drag.copy && <span className="shrink-0 text-[12px] text-accent">+</span>}
    </div>
  );
}
