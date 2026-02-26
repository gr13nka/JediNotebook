import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const [show, setShow] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [above, setAbove] = useState(true);

  useEffect(() => {
    if (show && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      // If less than 120px above, render below instead
      setAbove(rect.top > 120);
    }
  }, [show]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <button
        type="button"
        className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold text-text-muted"
        style={{ boxShadow: NEU.raisedSm }}
        onClick={() => setShow((s) => !s)}
      >
        i
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: above ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: above ? 4 : -4 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 left-1/2 -translate-x-1/2 w-72 p-3 rounded-xl bg-bg-primary text-xs text-text-secondary leading-relaxed whitespace-pre-line ${
              above ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
            style={{ boxShadow: NEU.tooltipSm }}
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
