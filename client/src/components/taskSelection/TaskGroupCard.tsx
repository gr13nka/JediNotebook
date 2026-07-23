import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SelectableTaskRow } from './SelectableTaskRow';
import { useProjectTasks } from '../../hooks/useProjectTasks';
import { useReorderList } from '../../hooks/useReorderList';
import { useTranslation } from '../../i18n/useTranslation';
import type { Project, ProjectTask, TimeBox } from '@shared/types';

export type TaskSortMode = 'custom' | 'created' | 'points' | 'created-asc' | 'created-desc';

interface TaskGroupCardProps {
  project: Project;
  tasks: ProjectTask[];
  completedTasks: ProjectTask[];
  onMoveToBox: (taskId: string, target: TimeBox) => void;
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
  onMoveToBox,
  sortMode,
  isCollapsed = false,
  onToggleCollapse,
  draggableProject,
  onProjectDragStart,
  onProjectDragOver,
  onProjectDrop,
  isProjectDragOver,
}: TaskGroupCardProps) {
  const { reorderTasks, toggleTask, deleteTask, updateTask } = useProjectTasks(project.id);
  const { t } = useTranslation();
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  const sortedTasks = useMemo(() => sortTasks(tasks, sortMode), [tasks, sortMode]);

  const isDragEnabled = sortMode === 'custom';

  // stopPropagation: this card's task rows sit inside a project row that is
  // itself draggable (for reordering projects) — without it, a task-row drag
  // would also register as a project-row drag on the ancestor.
  const reorder = useReorderList({
    items: sortedTasks,
    getId: (t: ProjectTask) => t.id,
    onReorder: reorderTasks,
    stopPropagation: true,
  });

  const selectedCount = tasks.filter((t) => t.timeBox === 'today').length;

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
        {(project as any).icon ? (
          <span className="text-base flex-shrink-0 leading-none">{(project as any).icon}</span>
        ) : (
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: project.color }}
          />
        )}
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
            <div className="pl-4" onDragEnd={reorder.handleDragEnd} onDragLeave={reorder.handleDragLeave}>
              {sortedTasks.map((task, i) => {
                const rowProps = reorder.getRowProps(i);
                return (
                  <SelectableTaskRow
                    key={task.id}
                    task={task}
                    onMoveToBox={onMoveToBox}
                    onToggleComplete={() => toggleTask(task.id)}
                    onDelete={() => deleteTask(task.id)}
                    onRename={(title) => updateTask(task.id, { title })}
                    draggable={isDragEnabled}
                    onDragStart={isDragEnabled ? rowProps.onDragStart : undefined}
                    onDragOver={isDragEnabled ? rowProps.onDragOver : undefined}
                    onDrop={isDragEnabled ? rowProps.onDrop : undefined}
                    isDragOver={rowProps.isDragOver}
                  />
                );
              })}

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
                            onMoveToBox={onMoveToBox}
                            onToggleComplete={() => toggleTask(task.id)}
                            onDelete={() => deleteTask(task.id)}
                            onRename={(title) => updateTask(task.id, { title })}
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
