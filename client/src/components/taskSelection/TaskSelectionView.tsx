import React, { useMemo, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAllProjectTasks } from '../../hooks/useAllProjectTasks';
import { useTaskBox } from '../../hooks/useTaskBox';
import { useProjects } from '../../hooks/useProjects';
import { useReorderList } from '../../hooks/useReorderList';
import { useTranslation } from '../../i18n/useTranslation';
import { useProjectUIStore } from '../../stores/projectUIStore';
import { InfoTooltip } from '../ui/InfoTooltip';
import { StalenessCounter } from './StalenessCounter';
import { TaskGroupCard, type TaskSortMode } from './TaskGroupCard';
import { FolderGroupSection } from './FolderGroupSection';
import { SelectableTaskRow } from './SelectableTaskRow';
import { db } from '../../db';
import { createProjectTask, deleteProjectTaskCascade, toggleProjectTask } from '../../db/taskOps';
import type { ProjectTask } from '@shared/types';

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

type ViewMode = 'grouped' | 'flat';

function getStalenessScore(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / 86400000;
  return Math.round(ageDays * ageDays);
}

export function TaskSelectionView() {
  const { t } = useTranslation();
  const { groups, folderGroups } = useAllProjectTasks();
  // 5E replaces this: the box-tabs UI (plan 5.10) retires the today
  // pill/toggle entirely. Until then, this borrows useTaskBox('today') for
  // today-membership + its moveToBox op rather than re-deriving the
  // promote-clears-pin rule (see useTaskBox's doc comment) a second time here.
  const { tasks: todayTasks, moveToBox } = useTaskBox('today');
  const { projects, reorderProjects } = useProjects();
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<TaskSortMode>('custom');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');

  // Quick add task state
  const [addingTask, setAddingTask] = useState(false);
  // Draft lives in the store so navigating away from /tasks and back does not
  // discard it — same reason as the project task list.
  const newTaskTitle = useProjectUIStore((s) => s.quickAddDraft);
  const setNewTaskTitle = useProjectUIStore((s) => s.setQuickAddDraft);
  const [newTaskProjectId, setNewTaskProjectId] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  // Flat view custom order override (only 'custom' sort mode uses it)
  const [flatOrder, setFlatOrder] = useState<string[] | null>(null);

  // Flat view completed section
  const [flatCompletedCollapsed, setFlatCompletedCollapsed] = useState(true);

  const todayTaskIds = useMemo(
    () => new Set(todayTasks.map((t) => t.id)),
    [todayTasks],
  );

  // in-today → move to 'week' (demote back off the pill), not-in-today →
  // move to 'today' (the one-tap promote this view offers pre-5.10).
  const toggleToday = useCallback((taskId: string, _projectId: string) => {
    moveToBox(taskId, todayTaskIds.has(taskId) ? 'week' : 'today');
  }, [todayTaskIds, moveToBox]);

  // Build project lookup for flat view
  const projectMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string; icon: string }>();
    for (const g of groups) {
      map.set(g.project.id, { name: g.project.name, color: g.project.color, icon: (g.project as any).icon ?? '' });
    }
    return map;
  }, [groups]);

  // All incomplete tasks for flat view
  const allIncompleteTasks = useMemo(() => {
    const tasks: ProjectTask[] = [];
    for (const g of groups) {
      tasks.push(...g.incompleteTasks);
    }
    return tasks;
  }, [groups]);

  // All completed tasks for flat view
  const allCompletedTasks = useMemo(() => {
    const tasks: ProjectTask[] = [];
    for (const g of groups) {
      tasks.push(...g.completedTasks);
    }
    return tasks;
  }, [groups]);

  // Sorted flat tasks
  const sortedFlatTasks = useMemo(() => {
    const tasks = [...allIncompleteTasks];
    switch (sortMode) {
      case 'points':
        return tasks.sort((a, b) => getStalenessScore(b.createdAt) - getStalenessScore(a.createdAt));
      case 'created-asc':
        return tasks.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      case 'created-desc':
        return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      case 'custom': {
        if (flatOrder) {
          const orderMap = new Map(flatOrder.map((id, i) => [id, i]));
          return tasks.sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));
        }
        return tasks;
      }
      default:
        return tasks;
    }
  }, [allIncompleteTasks, sortMode, flatOrder]);

  const toggleFolder = useCallback((folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }, []);

  const toggleProject = useCallback((projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  // Project drag/drop (grouped mode, no folders)
  const projectReorder = useReorderList({
    items: groups,
    getId: (g) => g.project.id,
    onReorder: reorderProjects,
  });

  // Flat view drag/drop — reordering only sets the local override; it isn't persisted.
  const flatReorder = useReorderList({
    items: sortedFlatTasks,
    getId: (t: ProjectTask) => t.id,
    onReorder: setFlatOrder,
  });

  const sortedGroups = useMemo(() => {
    if (sortMode === 'created') {
      return [...groups].sort((a, b) => a.project.createdAt.localeCompare(b.project.createdAt));
    }
    return groups;
  }, [groups, sortMode]);

  const hasFolders = folderGroups.some((fg) => fg.folder !== null);

  // Quick add task
  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title || !newTaskProjectId) return;
    await createProjectTask(newTaskProjectId, title);
    setNewTaskTitle('');
    addInputRef.current?.focus();
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTask();
    } else if (e.key === 'Escape') {
      setAddingTask(false);
      setNewTaskTitle('');
    }
  };

  // Non-archived projects for the picker
  const availableProjects = useMemo(
    () => projects.filter((p) => !p.isArchived),
    [projects],
  );

  // Set default project when opening add bar
  const openAddBar = () => {
    setAddingTask(true);
    if (!newTaskProjectId && availableProjects.length > 0) {
      setNewTaskProjectId(availableProjects[0].id);
    }
    setTimeout(() => addInputRef.current?.focus(), 50);
  };

  // Reset flat order when switching sort modes
  const handleSortMode = (mode: TaskSortMode) => {
    setSortMode(mode);
    if (mode !== 'custom') setFlatOrder(null);
  };

  // Grouped sort mode (only custom/created for grouped view)
  const groupedSortMode: TaskSortMode = sortMode === 'custom' || sortMode === 'created' ? sortMode : 'custom';

  // Available sort options based on view mode
  const sortOptions: { value: TaskSortMode; label: string }[] = useMemo(() => {
    if (viewMode === 'flat') {
      return [
        { value: 'custom', label: t('taskSelection.sortCustom') },
        { value: 'points', label: t('taskSelection.sortPoints') },
        { value: 'created-desc', label: t('taskSelection.sortNewest') },
        { value: 'created-asc', label: t('taskSelection.sortOldest') },
      ];
    }
    return [
      { value: 'custom', label: t('taskSelection.sortCustom') },
      { value: 'created', label: t('taskSelection.sortCreated') },
    ];
  }, [viewMode, t]);

  return (
    <div>
      {/* Header row: title + points */}
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t('taskSelection.title')}
        </h1>
        <InfoTooltip
          text={t('taskSelection.tooltip')}
        />
        <StalenessCounter />
      </div>

      {/* Controls row: view toggle + sort dropdown */}
      <div className="flex items-center gap-2 mb-4">
        {/* View mode toggle */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'grouped'
                ? 'bg-accent/15 text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t('taskSelection.viewGrouped')}
          </button>
          <button
            onClick={() => setViewMode('flat')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'flat'
                ? 'bg-accent/15 text-accent'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t('taskSelection.viewFlat')}
          </button>
        </div>

        {/* Sort dropdown */}
        <select
          value={viewMode === 'grouped' ? groupedSortMode : sortMode}
          onChange={(e) => handleSortMode(e.target.value as TaskSortMode)}
          className="ml-auto text-xs bg-bg-primary text-text-secondary border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-accent appearance-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            paddingRight: '24px',
          }}
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Quick add task bar */}
      {availableProjects.length > 0 && (
        <div className="mb-4">
          {addingTask ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated/50">
              <input
                ref={addInputRef}
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleAddKeyDown}
                placeholder={t('taskSelection.addTask')}
                className="flex-1 text-sm bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none"
              />
              <select
                value={newTaskProjectId}
                onChange={(e) => setNewTaskProjectId(e.target.value)}
                className="text-xs bg-transparent text-text-secondary border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-accent max-w-[140px]"
              >
                {!newTaskProjectId && (
                  <option value="">{t('taskSelection.selectProject')}</option>
                )}
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim() || !newTaskProjectId}
                className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-accent text-white disabled:opacity-30 transition-opacity"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <button
                onClick={() => { setAddingTask(false); setNewTaskTitle(''); }}
                className="flex-shrink-0 text-text-muted hover:text-text-secondary text-sm px-1"
              >
                &times;
              </button>
            </div>
          ) : (
            <button
              onClick={openAddBar}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-text-muted hover:text-text-secondary hover:bg-bg-elevated/30 transition-colors text-sm w-full"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('taskSelection.addTask')}
            </button>
          )}
        </div>
      )}

      {todayTasks.length > 0 && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs font-medium">
          {todayTasks.filter((tk) => !tk.isCompleted).length} {todayTasks.filter((tk) => !tk.isCompleted).length !== 1 ? t('taskSelection.tasks') : t('taskSelection.task')} {t('taskSelection.selectedForToday')}
        </div>
      )}

      {viewMode === 'flat' ? (
        /* ---- FLAT VIEW ---- */
        <motion.div
          className="flex flex-col gap-0"
          variants={container}
          initial="hidden"
          animate="show"
          onDragEnd={flatReorder.handleDragEnd}
        >
          {sortedFlatTasks.map((task, i) => {
            const rowProps = flatReorder.getRowProps(i);
            return (
              <motion.div key={task.id} variants={item}>
                <SelectableTaskRow
                  task={task}
                  onToggleToday={() => toggleToday(task.id, task.projectId)}
                  onToggleComplete={() => toggleProjectTask(task.id)}
                  onDelete={() => deleteProjectTaskCascade(task.id)}
                  onRename={async (title) => {
                    await db.projectTasks.update(task.id, {
                      title,
                      updatedAt: new Date().toISOString(),
                    });
                  }}
                  isInToday={todayTaskIds.has(task.id)}
                  draggable={sortMode === 'custom'}
                  onDragStart={sortMode === 'custom' ? rowProps.onDragStart : undefined}
                  onDragOver={sortMode === 'custom' ? rowProps.onDragOver : undefined}
                  onDrop={sortMode === 'custom' ? rowProps.onDrop : undefined}
                  isDragOver={rowProps.isDragOver}
                  projectInfo={projectMap.get(task.projectId)}
                />
              </motion.div>
            );
          })}

          {/* Completed section */}
          {allCompletedTasks.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setFlatCompletedCollapsed((p) => !p)}
                className="flex items-center gap-2 py-2 px-1 text-xs text-text-muted hover:text-text-secondary transition-colors w-full"
              >
                <svg
                  className="w-3 h-3 transition-transform duration-200"
                  style={{ transform: flatCompletedCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
                <span>{t('taskSelection.completed')}</span>
                <span className="tabular-nums">{allCompletedTasks.length}</span>
              </button>
              <AnimatePresence initial={false}>
                {!flatCompletedCollapsed && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    {allCompletedTasks.map((task) => (
                      <SelectableTaskRow
                        key={task.id}
                        task={task}
                        onToggleToday={() => toggleToday(task.id, task.projectId)}
                        onToggleComplete={() => toggleProjectTask(task.id)}
                        onDelete={() => deleteProjectTaskCascade(task.id)}
                        onRename={async (title) => {
                          await db.projectTasks.update(task.id, {
                            title,
                            updatedAt: new Date().toISOString(),
                          });
                        }}
                        isInToday={todayTaskIds.has(task.id)}
                        draggable={false}
                        projectInfo={projectMap.get(task.projectId)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      ) : (
        /* ---- GROUPED VIEW ---- */
        <motion.div
          className="flex flex-col gap-4"
          variants={container}
          initial="hidden"
          animate="show"
          onDragEnd={projectReorder.handleDragEnd}
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
                        tasks={group.incompleteTasks}
                        completedTasks={group.completedTasks}
                        onToggleToday={toggleToday}
                        todayTaskIds={todayTaskIds}
                        sortMode={groupedSortMode}
                        isCollapsed={collapsedProjects.has(group.project.id)}
                        onToggleCollapse={() => toggleProject(group.project.id)}
                      />
                    ))}
                  </FolderGroupSection>
                </motion.div>
              );
            })
          ) : (
            sortedGroups.map((group, i) => {
              const rowProps = projectReorder.getRowProps(i);
              return (
                <motion.div
                  key={group.project.id}
                  variants={item}
                  onDragOver={groupedSortMode === 'custom' ? rowProps.onDragOver : undefined}
                  onDrop={groupedSortMode === 'custom' ? rowProps.onDrop : undefined}
                >
                  <TaskGroupCard
                    project={group.project}
                    tasks={group.incompleteTasks}
                    completedTasks={group.completedTasks}
                    onToggleToday={toggleToday}
                    todayTaskIds={todayTaskIds}
                    sortMode={groupedSortMode}
                    isCollapsed={collapsedProjects.has(group.project.id)}
                    onToggleCollapse={() => toggleProject(group.project.id)}
                    draggableProject={groupedSortMode === 'custom'}
                    onProjectDragStart={rowProps.onDragStart}
                    onProjectDragOver={rowProps.onDragOver}
                    onProjectDrop={rowProps.onDrop}
                    isProjectDragOver={rowProps.isDragOver}
                  />
                </motion.div>
              );
            })
          )}
        </motion.div>
      )}

      {groups.length === 0 && (
        <div className="text-center text-text-muted text-sm py-12">
          {t('taskSelection.empty')}
        </div>
      )}
    </div>
  );
}
