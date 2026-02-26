import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';

interface HabitProgressBarProps {
  value: number;
  target: number;
  unit: string;
  color: string;
}

export function HabitProgressBar({ value, target, unit, color }: HabitProgressBarProps) {
  const pct = Math.min((value / target) * 100, 100);
  const formatNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-text-secondary mb-1.5">
        <span>{formatNum(value)}/{formatNum(target)} {unit}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div
        className="h-2.5 rounded-full overflow-hidden"
        style={{ boxShadow: NEU.pressedSm }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      </div>
    </div>
  );
}
