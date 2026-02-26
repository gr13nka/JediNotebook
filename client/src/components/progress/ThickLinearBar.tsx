import React from 'react';
import { NEU } from '../../utils/shadows';
import { getOverfillColor } from '../../utils/time';

interface ThickLinearBarProps {
  ratio: number;
  color: string;
  isActive?: boolean;
}

export function ThickLinearBar({ ratio, color, isActive }: ThickLinearBarProps) {
  const fillColor = getOverfillColor(ratio, color);
  const percent = Math.min(ratio * 100, 100);
  const overfillPercent = ratio > 1 ? Math.min((ratio - 1) * 100, 100) : 0;

  return (
    <div>
      <div
        className="w-full h-3 rounded-full overflow-hidden relative"
        style={{
          backgroundColor: 'var(--color-bg-primary)',
          boxShadow: NEU.pressed,
        }}
      >
        {/* Main fill */}
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${percent}%`,
            backgroundColor: fillColor,
          }}
        />
        {/* Overfill overlay */}
        {overfillPercent > 0 && (
          <div
            className="absolute top-0 left-0 h-full rounded-full opacity-30"
            style={{
              width: `${overfillPercent}%`,
              backgroundColor: getOverfillColor(ratio, color),
            }}
          />
        )}
      </div>
    </div>
  );
}
