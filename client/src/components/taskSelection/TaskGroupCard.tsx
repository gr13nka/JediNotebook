import React, { useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SelectableTaskRow } from './SelectableTaskRow';
import { useProjectTasks } from '../../hooks/useProjectTasks';
import { useTranslation } from '../../i18n/useTranslation';
import type { Project, ProjectTask } from '@shared/types';

export type TaskSortMode = 'custom' | 'created' | 'points' | 'suspicious' | 'created-asc' | 'created-desc';

interface TaskGroupCardProps {
  project: Project;
  tasks: ProjectTask[];
  completedTasks: ProjectTask[];
  onToggleToday: (projectTaskId: string, projectId: string) => void;
  todayTaskIds: Set<string>;
  sortMode: TaskSortMode;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  draggableProject?: boolean;
  onProjectDragStart?: (e: React.DragEvent) => void;
  onProjectDragOver?: (e: React.DragEvent) => void;
  onProjectDrop?: (e: React.DragEvent) => void;
  isProjectDragOver?: 'above' | 'below' | null;
}

function sortTasks(tasks: ProjectTask[], mode: TaskSortMode): ProjectTask[] {
  if (mode === 'created') {
    return [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  return tasks; // 'custom' — already sorted by sortOrder from the hook
}

export function TaskGroupCard({
  project,
  tasks,
  completedTasks,
  onToggleToday,
  todayTaskIds,
  sortMode,
  isCollapsed = false,
  onToggleCollapse,
  draggableProject,
  onProjectDragStart,
  onProjectDragOver,
  onProjectDrop,
  isProjectDragOver,
}: TaskGroupCardProps) {
  const { reorderTasks, toggleTask, deleteTask } = useProjectTasks(project.id);
  const { t } = useTranslation();
  const dragIdx = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'above' | 'below' } | null>(null);
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  const sortedTasks = useMemo(() => sortTasks(tasks, sortMode), [tasks, sortMode]);

  const isDragEnabled = sortMode === 'custom';

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    e.stopPropagation();
    dragIdx.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx.current === null || dragIdx.current === index) {
      setDropTarget(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';
    setDropTarget({ index, position });
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const from = dragIdx.current;
    if (from === null || from === index) {
      dragIdx.current = null;
      setDropTarget(null);
      return;
    }
    const ordered = sortedTasks.map((t) => t.id);
    const [moved] = ordered.splice(from, 1);
    const targetIdx = index;
    const insertAt = dropTarget?.position === 'below' ? targetIdx + (from < index ? 0 : 1) : targetIdx - (from < index ? 1 : 0);
    ordered.splice(Math.max(0, insertAt), 0, moved);
    reorderTasks(ordered);
    dragIdx.current = null;
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDropTarget(null);
    dragIdx.current = null;
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const selectedCount = tasks.filter((t) => todayTaskIds.has(t.id)).length;

  return (
    <div className="relative">
      {isProjectDragOver === 'above' && (
        <div className="absolute -top-[2px] left-2 right-2 h-[2px] rounded-full bg-accent z-10" />
      )}

      {/* Project header row */}
      <div
        className={`flex items-center gap-3 py-3 px-2 rounded-lg ${onToggleCollapse ? 'cursor-pointer hover:bg-bg-elevated/30' : ''} transition-colors`}
        onClick={onToggleCollapse}
        draggable={draggableProject && isDragEnabled}
        onDragStart={onProjectDragStart}
        onDragOver={onProjectDragOver}
        onDrop={onProjectDrop}
      >
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: project.color }}
        />
        <span className="flex-1 text-[15px] font-semibold text-text-primary">{project.name}</span>
        {selectedCount > 0 && (
          <span className="text-xs text-green font-medium">{selectedCount}</span>
        )}
        {isCollapsed && (
          <span className="text-xs text-text-muted tabular-nums">
            {tasks.length}
          </span>
        )}
        {onToggleCollapse && (
          <svg
            className="w-4 h-4 text-text-muted transition-transform duration-200 flex-shrink-0"
            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {/* Task rows — indented */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="pl-4" onDragEnd={handleDragEnd} onDragLeave={handleDragLeave}>
              {sortedTasks.map((task, i) => (
                <SelectableTaskRow
                  key={task.id}
                  task={task}
                  onToggleToday={() => onToggleToday(task.id, project.id)}
                  onToggleComplete={() => toggleTask(task.id)}
                  onDelete={() => deleteTask(task.id)}
                  isInToday={todayTaskIds.has(task.id)}
                  draggable={isDragEnabled}
                  onDragStart={isDragEnabled ? handleDragStart(i) : undefined}
                  onDragOver={isDragEnabled ? handleDragOver(i) : undefined}
                  onDrop={isDragEnabled ? handleDrop(i) : undefined}
                  isDragOver={dropTarget?.index === i ? dropTarget.position : null}
                />
              ))}

              {/* Completed section */}
              {completedTasks.length > 0 && (
                <div className="mt-1">
                  <button
                    onClick={() => setCompletedCollapsed((p) => !p)}
                    className="flex items-center gap-2 py-2 px-1 text-xs text-text-muted hover:text-text-secondary transition-colors w-full"
                  >
                    <svg
                      className="w-3 h-3 transition-transform duration-200"
                      style={{ transform: completedCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                    <span>{t('taskSelection.completed')}</span>
                    <span className="tabular-nums">{completedTasks.length}</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {!completedCollapsed && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        {completedTasks.map((task) => (
                          <SelectableTaskRow
                            key={task.id}
                            task={task}
                            onToggleToday={() => onToggleToday(task.id, project.id)}
                            onToggleComplete={() => toggleTask(task.id)}
                            onDelete={() => deleteTask(task.id)}
                            isInToday={todayTaskIds.has(task.id)}
                            draggable={false}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isProjectDragOver === 'below' && (
        <div className="absolute -bottom-[2px] left-2 right-2 h-[2px] rounded-full bg-accent z-10" />
      )}
    </div>
  );
}
