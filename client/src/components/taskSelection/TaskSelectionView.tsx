import React, { useMemo, useState, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { useAllProjectTasks } from '../../hooks/useAllProjectTasks';
import { useTodayTasks } from '../../hooks/useTodayTasks';
import { useProjects } from '../../hooks/useProjects';
import { useTranslation } from '../../i18n/useTranslation';
import { InfoTooltip } from '../ui/InfoTooltip';
import { PointsCounter } from './PointsCounter';
import { TaskGroupCard, type TaskSortMode } from './TaskGroupCard';
import { FolderGroupSection } from './FolderGroupSection';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function TaskSelectionView() {
  const { t } = useTranslation();
  const { groups, folderGroups } = useAllProjectTasks();
  const { todayTasks, toggleToday } = useTodayTasks();
  const { reorderProjects } = useProjects();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<TaskSortMode>('custom');

  // Project drag state
  const projectDragIdx = useRef<number | null>(null);
  const [projectDropTarget, setProjectDropTarget] = useState<{ index: number; position: 'above' | 'below' } | null>(null);

  const todayTaskIds = useMemo(
    () => new Set(todayTasks.map((t) => t.projectTaskId)),
    [todayTasks],
  );

  const toggleFolder = useCallback((folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  const toggleProject = useCallback((projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  // Project drag handlers (flat mode only, no folders)
  const handleProjectDragStart = (index: number) => (e: React.DragEvent) => {
    projectDragIdx.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProjectDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (projectDragIdx.current === null || projectDragIdx.current === index) {
      setProjectDropTarget(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';
    setProjectDropTarget({ index, position });
  };

  const handleProjectDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = projectDragIdx.current;
    if (from === null || from === index) {
      projectDragIdx.current = null;
      setProjectDropTarget(null);
      return;
    }
    const ordered = groups.map((g) => g.project.id);
    const [moved] = ordered.splice(from, 1);
    const insertAt = projectDropTarget?.position === 'below'
      ? index + (from < index ? 0 : 1)
      : index - (from < index ? 1 : 0);
    ordered.splice(Math.max(0, insertAt), 0, moved);
    reorderProjects(ordered);
    projectDragIdx.current = null;
    setProjectDropTarget(null);
  };

  const handleProjectDragEnd = () => {
    setProjectDropTarget(null);
    projectDragIdx.current = null;
  };

  const sortedGroups = useMemo(() => {
    if (sortMode === 'created') {
      return [...groups].sort((a, b) => a.project.createdAt.localeCompare(b.project.createdAt));
    }
    return groups;
  }, [groups, sortMode]);

  const hasFolders = folderGroups.some((fg) => fg.folder !== null);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t('taskSelection.title')}
        </h1>
        <InfoTooltip
          text={t('taskSelection.tooltip')}
        />
        <PointsCounter />

        {/* Sort toggle */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setSortMode('custom')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              sortMode === 'custom'
                ? 'bg-accent/15 text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            title={t('taskSelection.sortCustom')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="9" y2="18" />
            </svg>
          </button>
          <button
            onClick={() => setSortMode('created')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              sortMode === 'created'
                ? 'bg-accent/15 text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            title={t('taskSelection.sortCreated')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        </div>
      </div>

      {todayTasks.length > 0 && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs font-medium">
          {todayTasks.filter((tk) => !tk.isCompleted).length} {todayTasks.filter((tk) => !tk.isCompleted).length !== 1 ? t('taskSelection.tasks') : t('taskSelection.task')} {t('taskSelection.selectedForToday')}
        </div>
      )}

      <motion.div
        className="flex flex-col gap-4"
        variants={container}
        initial="hidden"
        animate="show"
        onDragEnd={handleProjectDragEnd}
      >
        {hasFolders ? (
          folderGroups.map((folderGroup) => {
            const folderId = folderGroup.folder?.id ?? '__unfiled__';
            return (
              <motion.div key={folderId} variants={item}>
                <FolderGroupSection
                  folder={folderGroup.folder}
                  isCollapsed={collapsedFolders.has(folderId)}
                  onToggle={() => toggleFolder(folderId)}
                  projectCount={folderGroup.projects.length}
                >
                  {folderGroup.projects.map((group) => (
                    <TaskGroupCard
                      key={group.project.id}
                      project={group.project}
                      tasks={group.tasks}
                      completedTasks={group.completedTasks}
                      onToggleToday={toggleToday}
                      todayTaskIds={todayTaskIds}
                      sortMode={sortMode}
                      isCollapsed={collapsedProjects.has(group.project.id)}
                      onToggleCollapse={() => toggleProject(group.project.id)}
                    />
                  ))}
                </FolderGroupSection>
              </motion.div>
            );
          })
        ) : (
          sortedGroups.map((group, i) => (
            <motion.div
              key={group.project.id}
              variants={item}
              onDragOver={sortMode === 'custom' ? handleProjectDragOver(i) : undefined}
              onDrop={sortMode === 'custom' ? handleProjectDrop(i) : undefined}
            >
              <TaskGroupCard
                project={group.project}
                tasks={group.tasks}
                completedTasks={group.completedTasks}
                onToggleToday={toggleToday}
                todayTaskIds={todayTaskIds}
                sortMode={sortMode}
                isCollapsed={collapsedProjects.has(group.project.id)}
                onToggleCollapse={() => toggleProject(group.project.id)}
                draggableProject={sortMode === 'custom'}
                onProjectDragStart={handleProjectDragStart(i)}
                onProjectDragOver={handleProjectDragOver(i)}
                onProjectDrop={handleProjectDrop(i)}
                isProjectDragOver={projectDropTarget?.index === i ? projectDropTarget.position : null}
              />
            </motion.div>
          ))
        )}
      </motion.div>

      {groups.length === 0 && (
        <div className="text-center text-text-muted text-sm py-12">
          {t('taskSelection.empty')}
        </div>
      )}
    </div>
  );
}
