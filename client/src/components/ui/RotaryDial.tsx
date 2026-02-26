import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { useThemeColors } from '../../hooks/useThemeColors';

interface RotaryDialProps {
  value: number; // minutes
  onChange: (minutes: number) => void;
}

const PRESETS = [30, 60, 90, 120, 150, 180, 240, 360, 480];
const LABELS = ['0:30', '1:00', '1:30', '2:00', '2:30', '3:00', '4:00', '6:00', '8:00'];

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function minutesToFraction(minutes: number): number {
  if (minutes <= PRESETS[0]) return 0;
  if (minutes >= PRESETS[PRESETS.length - 1]) return 1;
  for (let i = 0; i < PRESETS.length - 1; i++) {
    if (minutes >= PRESETS[i] && minutes <= PRESETS[i + 1]) {
      const t = (minutes - PRESETS[i]) / (PRESETS[i + 1] - PRESETS[i]);
      return (i + t) / (PRESETS.length - 1);
    }
  }
  return 0;
}

function fractionToMinutes(f: number): number {
  const clamped = Math.max(0, Math.min(1, f));
  const idx = clamped * (PRESETS.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.min(lower + 1, PRESETS.length - 1);
  const t = idx - lower;
  return Math.round(PRESETS[lower] + t * (PRESETS[upper] - PRESETS[lower]));
}

function snapToPreset(minutes: number): number {
  let closest = PRESETS[0];
  let minDist = Math.abs(minutes - closest);
  for (const p of PRESETS) {
    const d = Math.abs(minutes - p);
    if (d < minDist) {
      minDist = d;
      closest = p;
    }
  }
  return closest;
}

const W = 300;
const H = 170;
const CX = W / 2;
const CY = 15;       // circle center near top
const R = 130;        // arc hangs down, bottom at CY + R = 145

// Fraction 0 (0:30) = left, fraction 1 (8:00) = right
// Angle: PI (left) → 0 (right) going through PI/2 (bottom)
function fractionToAngle(f: number): number {
  return Math.PI * (1 - f);
}

function fractionToPos(f: number) {
  const angle = fractionToAngle(f);
  return {
    x: CX + Math.cos(angle) * R,
    y: CY + Math.sin(angle) * R,
  };
}

export function RotaryDial({ value, onChange }: RotaryDialProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [typedDigits, setTypedDigits] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const colors = useThemeColors();

  // Preset positions
  const presetPositions = PRESETS.map((_, i) => {
    const f = i / (PRESETS.length - 1);
    return fractionToPos(f);
  });

  // Current indicator
  const currentFraction = minutesToFraction(value);
  const indicatorPos = fractionToPos(currentFraction);

  // Tick marks
  const ticks: { x1: number; y1: number; x2: number; y2: number; isMajor: boolean }[] = [];
  for (let i = 0; i <= 36; i++) {
    const f = i / 36;
    const angle = fractionToAngle(f);
    const isMajor = i % 4 === 0;
    const outerR = R + 2;
    const innerR = isMajor ? R - 8 : R - 4;
    ticks.push({
      x1: CX + Math.cos(angle) * outerR,
      y1: CY + Math.sin(angle) * outerR,
      x2: CX + Math.cos(angle) * innerR,
      y2: CY + Math.sin(angle) * innerR,
      isMajor,
    });
  }

  // Arc: left endpoint to right endpoint, going DOWN (counterclockwise in SVG = sweep-flag 0)
  const arcPath = `M ${CX - R} ${CY} A ${R} ${R} 0 0 0 ${CX + R} ${CY}`;

  // --- Pointer drag ---
  const pointerToFraction = useCallback((clientX: number, clientY: number): number => {
    if (!svgRef.current) return currentFraction;
    const rect = svgRef.current.getBoundingClientRect();
    const sx = (clientX - rect.left) * (W / rect.width);
    const sy = (clientY - rect.top) * (H / rect.height);
    const dx = sx - CX;
    const dy = sy - CY;
    let angle = Math.atan2(dy, dx); // atan2 returns -PI..PI
    // We only care about the bottom semicircle (dy > 0, angle 0..PI)
    if (angle < 0) angle = dx < 0 ? Math.PI : 0; // clamp to ends
    // angle: PI = left (f=0), 0 = right (f=1)
    return 1 - angle / Math.PI;
  }, [currentFraction]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as Element).setPointerCapture(e.pointerId);
    const f = pointerToFraction(e.clientX, e.clientY);
    onChange(snapToPreset(fractionToMinutes(f)));
  }, [pointerToFraction, onChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const f = pointerToFraction(e.clientX, e.clientY);
    onChange(snapToPreset(fractionToMinutes(f)));
  }, [isDragging, pointerToFraction, onChange]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // --- Scroll wheel ---
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const currentIdx = PRESETS.indexOf(value);
    const idx = currentIdx >= 0 ? currentIdx : PRESETS.findIndex((p) => p >= value);
    const safeIdx = idx >= 0 ? idx : 0;
    if (e.deltaY < 0 || e.deltaX < 0) {
      onChange(PRESETS[Math.max(0, safeIdx - 1)]);
    } else {
      onChange(PRESETS[Math.min(PRESETS.length - 1, safeIdx + 1)]);
    }
  }, [value, onChange]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const prevent = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', prevent, { passive: false });
    return () => el.removeEventListener('wheel', prevent);
  }, []);

  const handlePresetClick = useCallback((minutes: number) => {
    setTypedDigits('');
    onChange(minutes);
  }, [onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      setTypedDigits(prev => {
        const next = prev.slice(0, -1);
        if (next.length === 0) {
          onChange(60);
        } else {
          const parsed = parseDigits(next);
          if (parsed > 0) onChange(parsed);
        }
        return next;
      });
      return;
    }
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      setTypedDigits(prev => {
        const next = (prev + e.key).slice(0, 3);
        const parsed = parseDigits(next);
        if (parsed > 0 && parsed <= 480) onChange(parsed);
        return next;
      });
    }
  }, [onChange]);

  return (
    <div
      className="flex flex-col items-center gap-2"
      onClick={() => inputRef.current?.focus()}
    >
      <svg
        ref={svgRef}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="cursor-pointer select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
      >
        {/* Arc track */}
        <path d={arcPath} fill="none" stroke={`${colors.accent}14`} strokeWidth="2" />

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line
            key={i}
            x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isMajor ? `${colors.accent}4D` : `${colors.accent}1F`}
            strokeWidth={t.isMajor ? 1.5 : 0.75}
            strokeLinecap="round"
          />
        ))}

        {/* Preset dots + labels */}
        {PRESETS.map((preset, i) => {
          const pos = presetPositions[i];
          const isSelected = value === preset;

          // Labels inside the arc (toward center)
          const f = i / (PRESETS.length - 1);
          const angle = fractionToAngle(f);
          const labelR = R - 18;
          const labelX = CX + Math.cos(angle) * labelR;
          const labelY = CY + Math.sin(angle) * labelR;

          return (
            <g
              key={preset}
              onClick={(e) => { e.stopPropagation(); handlePresetClick(preset); }}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={pos.x} cy={pos.y} r="16" fill="transparent" />
              <circle
                cx={pos.x} cy={pos.y}
                r={isSelected ? 5 : 3}
                fill={isSelected ? colors.accent : `${colors.accent}40`}
              />
              <text
                x={labelX} y={labelY + 3}
                textAnchor="middle"
                fill={isSelected ? colors.accent : `${colors.accent}60`}
                fontSize="9"
                fontFamily="'Inter', system-ui, sans-serif"
                fontWeight={isSelected ? 600 : 400}
              >
                {LABELS[i]}
              </text>
            </g>
          );
        })}

        {/* Moving indicator */}
        <motion.circle
          animate={{ cx: indicatorPos.x, cy: indicatorPos.y }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          r="7" fill={colors.accent}
        />
        <motion.circle
          animate={{ cx: indicatorPos.x, cy: indicatorPos.y }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          r="3" fill={colors.bgPrimary}
        />
      </svg>

      {/* Time display */}
      <div className="flex flex-col items-center gap-1">
        <span
          className="text-3xl font-semibold text-text-primary tracking-wider"
          style={{ fontVariantNumeric: 'tabular-nums', fontFamily: "'Inter', monospace" }}
        >
          {formatTime(value)}
        </span>
        <span className="text-xs text-text-muted">
          {typedDigits ? 'typing...' : 'tap preset or type time'}
        </span>
      </div>

      <input
        ref={inputRef}
        className="sr-only"
        onKeyDown={handleKeyDown}
        aria-label="Time input"
        inputMode="numeric"
      />
    </div>
  );
}

function parseDigits(digits: string): number {
  if (digits.length === 1) return parseInt(digits[0]) * 60;
  if (digits.length === 2) return parseInt(digits[0]) * 60 + parseInt(digits[1]) * 10;
  if (digits.length === 3) {
    const m = parseInt(digits.slice(1));
    return m >= 60 ? 0 : parseInt(digits[0]) * 60 + m;
  }
  return 0;
}
