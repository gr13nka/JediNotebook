import React from 'react';
import { NEU } from '../../utils/shadows';
import type { PomodoroPreset } from '@shared/types';

interface PresetSelectorProps {
  presets: PomodoroPreset[];
  selectedId: string | null;
  onSelect: (preset: PomodoroPreset) => void;
  onAdd: () => void;
  onEdit?: (preset: PomodoroPreset) => void;
  disabled?: boolean;
}

export function PresetSelector({
  presets,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  disabled,
}: PresetSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {presets.map((preset) => {
        const isSelected = preset.id === selectedId;
        return (
          <button
            key={preset.id}
            onClick={() => onSelect(preset)}
            disabled={disabled}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors duration-200 ${
              isSelected
                ? 'text-accent border border-accent/40'
                : 'text-text-secondary hover:text-text-primary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{
              boxShadow: isSelected ? NEU.pressed : NEU.raisedSm,
            }}
          >
            <span>{preset.name}</span>
            <span className="text-text-muted">
              {preset.workMinutes}/{preset.breakMinutes}
            </span>
            {onEdit && !preset.isDefault && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(preset);
                }}
                className="ml-0.5 text-text-muted hover:text-text-primary"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
      <button
        onClick={onAdd}
        disabled={disabled}
        className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl text-text-muted hover:text-accent transition-colors duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{ boxShadow: NEU.raisedSm }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
