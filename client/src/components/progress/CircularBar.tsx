import React from 'react';
import { getOverfillColor } from '../../utils/time';

interface CircularBarProps {
  ratio: number;
  color: string;
  isActive?: boolean;
  size?: number;
}

export function CircularBar({ ratio, color, isActive, size = 48 }: CircularBarProps) {
  const fillColor = getOverfillColor(ratio, color);
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - Math.min(ratio, 1) * circumference;

  return (
    <svg width={size} height={size}>
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#D1D9E6"
        strokeWidth={strokeWidth}
        opacity={0.5}
      />
      {/* Main fill */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={fillColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      {/* Overfill ring */}
      {ratio > 1 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - strokeWidth - 1}
          fill="none"
          stroke={getOverfillColor(ratio, color)}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * (radius - strokeWidth - 1)}
          strokeDashoffset={
            2 * Math.PI * (radius - strokeWidth - 1) -
            Math.min(ratio - 1, 1) * 2 * Math.PI * (radius - strokeWidth - 1)
          }
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500"
          opacity={0.6}
        />
      )}
    </svg>
  );
}
