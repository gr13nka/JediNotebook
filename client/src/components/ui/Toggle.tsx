import React from 'react';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-6 w-11 items-center rounded-full border border-border transition-colors duration-300"
        style={{
          backgroundColor: checked ? '#27AE60' : 'var(--color-bg-elevated)',
          boxShadow: NEU.pressedSm,
          borderColor: checked ? '#27AE60' : undefined,
        }}
      >
        <motion.span
          className="inline-block h-4 w-4 rounded-full"
          style={{
            backgroundColor: checked ? '#fff' : 'var(--color-text-secondary)',
            boxShadow: NEU.raisedSm,
          }}
          animate={{ x: checked ? 24 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </label>
  );
}
