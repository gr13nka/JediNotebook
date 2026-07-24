import { useCallback, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/**
 * The particle burst that fires when a task is ticked off, shared by all
 * three checkboxes (`TodayTaskCard`, `SelectableTaskRow`, `TaskItem`) so the
 * reward feels identical wherever you complete something.
 *
 * Everything here is deliberately hard-edged: solid squares on whole-pixel
 * sizes and offsets, no `filter`, no glow shadow, no scale animation (which
 * would render a 4px square at fractional sizes and soften its edges). Only
 * position and opacity move.
 */
const PARTICLE_SIZE = 4;

const PARTICLES = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  // Alternating reach keeps the ring from reading as a rigid octagon.
  const distance = i % 2 === 0 ? 22 : 16;
  return {
    x: Math.round(Math.cos(angle) * distance),
    y: Math.round(Math.sin(angle) * distance),
    color: i % 2 === 0 ? 'var(--color-green)' : 'var(--color-accent)',
    delay: (i % 4) * 0.015,
  };
});

/**
 * Owns one checkbox's burst counter. Bumping it re-keys the particles, so
 * firing again mid-flight restarts the burst instead of stacking one on top
 * of another.
 */
export function useCompletionBurst(): [number, () => void] {
  const [burst, setBurst] = useState(0);
  const fire = useCallback(() => setBurst((n) => n + 1), []);
  return [burst, fire];
}

/** Renders inside the checkbox button, which must be `relative`. */
export function CompletionBurst({ burst }: { burst: number }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion || burst === 0) return null;

  return (
    <span key={burst} className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" aria-hidden="true">
      {PARTICLES.map((particle, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{
            width: PARTICLE_SIZE,
            height: PARTICLE_SIZE,
            marginLeft: -PARTICLE_SIZE / 2,
            marginTop: -PARTICLE_SIZE / 2,
            backgroundColor: particle.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: particle.x, y: particle.y, opacity: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: particle.delay }}
        />
      ))}
    </span>
  );
}
