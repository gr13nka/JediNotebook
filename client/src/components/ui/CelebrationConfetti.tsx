import { motion, useReducedMotion } from 'motion/react';

/**
 * The one-shot confetti finale over `/today`'s "all done" panel — the reward
 * for clearing the last task of the day, a tier above the per-task
 * `CompletionBurst`.
 *
 * Same crisp constraint as the burst: solid rectangles, whole-pixel sizes, no
 * `filter`, no glow, no border radius.
 */
const COLORS = ['var(--color-green)', 'var(--color-accent)', 'var(--color-text-secondary)'];

/**
 * Deterministic stand-in for `Math.random()`, which must not be called during
 * render — the scatter has to be stable across re-renders or every piece
 * would jump to a new column mid-fall.
 */
function seeded(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** Falls further than the panel is ever tall; the wrapper's `overflow-hidden` clips the rest. */
const FALL_DISTANCE = 320;

const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: `${Math.round(seeded(i, 1) * 100)}%`,
  color: COLORS[i % COLORS.length],
  delay: Math.round(seeded(i, 2) * 400) / 1000,
  duration: 1.1 + Math.round(seeded(i, 3) * 500) / 1000,
  drift: Math.round((seeded(i, 4) - 0.5) * 48),
  spin: Math.round((seeded(i, 5) - 0.5) * 720),
  height: seeded(i, 6) > 0.5 ? 6 : 8,
}));

/** Renders inside the "all done" panel, which must be `relative`. */
export function CelebrationConfetti({ burst }: { burst: number }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion || burst === 0) return null;

  return (
    <span
      key={burst}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {PIECES.map((piece, i) => (
        <motion.span
          key={i}
          className="absolute block"
          style={{
            left: piece.left,
            top: -12,
            width: 4,
            height: piece.height,
            backgroundColor: piece.color,
          }}
          initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
          animate={{
            y: FALL_DISTANCE,
            x: piece.drift,
            rotate: piece.spin,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            ease: 'easeIn',
            opacity: { duration: piece.duration, delay: piece.delay, times: [0, 0.7, 1] },
          }}
        />
      ))}
    </span>
  );
}
