import React from 'react';
import type { ProjectTask } from '@shared/types';

interface SelectableTaskRowProps {
  task: ProjectTask;
  onToggleToday: () => void;
  isInToday: boolean;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver?: 'above' | 'below' | null;
}

const LightningIcon = ({ className }: { className?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

export function SelectableTaskRow({
  task,
  onToggleToday,
  isInToday,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
}: SelectableTaskRowProps) {
  return (
    <div className="relative">
      {isDragOver === 'above' && (
        <div className="absolute -top-[2px] left-8 right-3 h-[2px] rounded-full bg-accent z-10" />
      )}
      <div
        className={`flex items-center gap-3 py-3 px-2 rounded-lg transition-colors ${
          isInToday ? 'bg-bg-elevated/50' : 'hover:bg-bg-elevated/30'
        }`}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* Checkbox */}
        <button
          onClick={onToggleToday}
          className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-[5px] border-2 transition-colors"
          style={{
            borderColor: isInToday ? '#8B5CF6' : 'var(--color-text-muted)',
            backgroundColor: isInToday ? '#8B5CF6' : 'transparent',
          }}
        >
          {isInToday && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* Task name */}
        <span className={`flex-1 text-[15px] leading-snug ${isInToday ? 'text-text-primary' : 'text-text-secondary'}`}>
          {task.title}
        </span>

        {/* Today indicator */}
        {isInToday && (
          <LightningIcon className="flex-shrink-0 text-green" />
        )}
      </div>
      {isDragOver === 'below' && (
        <div className="absolute -bottom-[2px] left-8 right-3 h-[2px] rounded-full bg-accent z-10" />
      )}
    </div>
  );
}
