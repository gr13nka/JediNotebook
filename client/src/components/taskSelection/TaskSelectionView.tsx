import React, { useMemo, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { useAllProjectTasks } from '../../hooks/useAllProjectTasks';
import { useTodayTasks } from '../../hooks/useTodayTasks';
import { useTranslation } from '../../i18n/useTranslation';
import { InfoTooltip } from '../ui/InfoTooltip';
import { PointsCounter } from './PointsCounter';
import { TaskGroupCard } from './TaskGroupCard';
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
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

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
                      onToggleToday={toggleToday}
                      todayTaskIds={todayTaskIds}
                      isCollapsed={collapsedProjects.has(group.project.id)}
                      onToggleCollapse={() => toggleProject(group.project.id)}
                    />
                  ))}
                </FolderGroupSection>
              </motion.div>
            );
          })
        ) : (
          groups.map((group) => (
            <motion.div key={group.project.id} variants={item}>
              <TaskGroupCard
                project={group.project}
                tasks={group.tasks}
                onToggleToday={toggleToday}
                todayTaskIds={todayTaskIds}
                isCollapsed={collapsedProjects.has(group.project.id)}
                onToggleCollapse={() => toggleProject(group.project.id)}
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
