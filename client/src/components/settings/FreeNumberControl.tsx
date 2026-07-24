import React, { useEffect, useRef, useState } from 'react';
import { NEU } from '../../utils/shadows';

interface FreeNumberControlProps {
  value: number;
  min: number;
  suffix: string;
  onChange: (value: number) => void;
  onReset?: () => void;
  resetLabel?: string;
}

/** A compact, unbounded numeric spinner with keyboard, wheel and drag input. */
export function FreeNumberControl({ value, min, suffix, onChange, onReset, resetLabel }: FreeNumberControlProps) {
  const dragRef = useRef<{ pointerId: number; startY: number; startValue: number } | null>(null);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const normalize = (next: number) => Number.isFinite(next) ? Math.max(min, Math.round(next)) : value;

  const adjust = (delta: number) => onChange(normalize(value + delta));

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => adjust(-1)}
        disabled={value <= min}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-elevated text-text-primary text-lg border border-border disabled:opacity-30 transition-colors"
        style={{ boxShadow: NEU.raisedSm }}
        aria-label={`Decrease to ${value - 1}${suffix}`}
      >
        &minus;
      </button>
      <input
        type="number"
        min={min}
        step={1}
        value={draft}
        onChange={(event) => {
          const nextDraft = event.currentTarget.value;
          setDraft(nextDraft);
          const next = Number(nextDraft);
          if (Number.isFinite(next) && next >= min) onChange(normalize(next));
        }}
        onBlur={() => {
          const next = Number(draft);
          if (Number.isFinite(next) && next >= min) onChange(normalize(next));
          else setDraft(String(value));
        }}
        onWheel={(event) => {
          event.preventDefault();
          adjust(event.deltaY < 0 ? 1 : -1);
        }}
        onPointerDown={(event) => {
          dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startValue: value };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const delta = Math.round((drag.startY - event.clientY) / 4);
          if (delta !== 0) onChange(normalize(drag.startValue + delta));
        }}
        onPointerUp={() => { dragRef.current = null; }}
        className="w-20 h-8 rounded-lg bg-bg-card border border-border text-center text-sm text-text-primary tabular-nums outline-none focus:border-accent"
        style={{ boxShadow: NEU.pressedSm, touchAction: 'none' }}
        aria-label={`Value in ${suffix}`}
      />
      <span className="text-sm text-text-secondary -ml-1 select-none">{suffix}</span>
      <button
        type="button"
        onClick={() => adjust(1)}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-elevated text-text-primary text-lg border border-border transition-colors"
        style={{ boxShadow: NEU.raisedSm }}
        aria-label={`Increase to ${value + 1}${suffix}`}
      >
        +
      </button>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="ml-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary rounded-md hover:bg-bg-elevated transition-colors"
        >
          {resetLabel}
        </button>
      )}
    </div>
  );
}
