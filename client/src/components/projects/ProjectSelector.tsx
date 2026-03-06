import React from 'react';
import type { Project } from '@shared/types';
import { NEU } from '../../utils/shadows';

interface ProjectSelectorProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ProjectSelector({ projects, selectedId, onSelect, onAdd }: ProjectSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {projects.map((p) => {
        const isActive = p.id === selectedId;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              isActive
                ? 'text-text-primary bg-bg-elevated'
                : 'text-text-secondary'
            }`}
            style={{ boxShadow: isActive ? NEU.pressedSm : NEU.raisedSm }}
          >
            {(p as any).icon ? (
              <span className="text-[14px] shrink-0 leading-none">{(p as any).icon}</span>
            ) : (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
            )}
            {p.name}
          </button>
        );
      })}
      <button
        onClick={onAdd}
        className="px-3 py-1.5 rounded-xl text-sm font-medium text-text-muted whitespace-nowrap transition-colors hover:text-text-secondary"
        style={{ boxShadow: NEU.raisedSm }}
      >
        + New
      </button>
    </div>
  );
}
