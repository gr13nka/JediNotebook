import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number } | null;
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjusted, setAdjusted] = useState<{ x: number; y: number } | null>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!position) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [position, onClose]);

  // Measure after render and adjust to stay in viewport
  useLayoutEffect(() => {
    if (!position) {
      setAdjusted(null);
      return;
    }
    // Start with click position, adjust after measuring
    const el = menuRef.current;
    if (!el) {
      setAdjusted(position);
      return;
    }
    let x = position.x;
    let y = position.y;
    // `offsetWidth`/`offsetHeight`, not `getBoundingClientRect`: this measures
    // on the first layout after opening, when the entry animation still has the
    // menu at `scale: 0.95`. A bounding rect reports the *visual* box, so it
    // under-reported by 5% and the clamp let the menu overhang by that much —
    // and it never re-measured, because the effect does not run again when the
    // animation settles.
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const pad = 8;

    if (x + width > window.innerWidth) {
      x = window.innerWidth - width - pad;
    }
    if (x < pad) x = pad;

    if (y + height > window.innerHeight) {
      // Show above the click point
      y = position.y - height;
    }
    if (y < pad) y = pad;

    setAdjusted({ x, y });
  }, [position, items]);

  return (
    <AnimatePresence>
      {position && (
        <motion.div
          ref={menuRef}
          className="fixed z-[100] min-w-[140px] rounded-lg bg-bg-card py-1"
          style={{
            left: adjusted?.x ?? position.x,
            top: adjusted?.y ?? position.y,
            boxShadow: NEU.modal,
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                item.danger
                  ? 'text-red hover:bg-red/10'
                  : 'text-text-primary hover:bg-bg-elevated/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
