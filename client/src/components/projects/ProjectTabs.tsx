import React from 'react';
import { useProjectUIStore } from '../../stores/projectUIStore';
import { useProjects } from '../../hooks/useProjects';
import { NEU } from '../../utils/shadows';

export function ProjectTabs() {
  const openTabs = useProjectUIStore((s) => s.openTabs);
  const activeTabId = useProjectUIStore((s) => s.activeTabId);
  const setActiveTab = useProjectUIStore((s) => s.setActiveTab);
  const closeTab = useProjectUIStore((s) => s.closeTab);
  const { projects } = useProjects();

  if (openTabs.length === 0) return null;

  return (
    <div className="flex gap-0.5 overflow-x-auto scrollbar-hide">
      {openTabs.map((tabId) => {
        const project = projects.find((p) => p.id === tabId);
        if (!project) return null;
        const isActive = tabId === activeTabId;

        return (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium whitespace-nowrap transition-all duration-150 shrink-0 group ${
              isActive
                ? 'text-text-primary bg-bg-elevated'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            style={{ boxShadow: isActive ? NEU.pressedSm : undefined }}
          >
            {(project as any).icon ? (
              <span className="text-[11px] shrink-0 leading-none">{(project as any).icon}</span>
            ) : (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: project.color }}
              />
            )}
            <span className="truncate max-w-[100px]">{project.name}</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tabId);
              }}
              className="text-text-muted hover:text-text-primary text-[11px] opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
            >
              &times;
            </span>
          </button>
        );
      })}
    </div>
  );
}
