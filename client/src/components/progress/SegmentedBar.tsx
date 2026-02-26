import React from 'react';
import { getOverfillColor } from '../../utils/time';
import { NEU } from '../../utils/shadows';

interface SegmentedBarProps {
  ratio: number;
  color: string;
  isActive?: boolean;
  segments?: number;
}

export function SegmentedBar({ ratio, color, isActive, segments = 24 }: SegmentedBarProps) {
  const fillColor = getOverfillColor(ratio, color);
  const filledSegments = Math.floor(ratio * segments);

  return (
    <div className="flex items-end gap-[3px] w-full">
      {Array.from({ length: segments }, (_, i) => {
        const isFilled = i < filledSegments;
        return (
          <div
            key={i}
            className="flex-1 rounded-full transition-colors duration-300"
            style={{
              height: '20px',
              background: isFilled
                ? fillColor
                : 'var(--color-bg-elevated)',
              boxShadow: isFilled ? 'none' : NEU.pressedSm,
              opacity: isFilled ? 1 : 0.6,
              transitionDelay: isFilled ? `${i * 20}ms` : '0ms',
            }}
          />
        );
      })}
    </div>
  );
}
