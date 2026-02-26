import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useProjects } from '../../hooks/useProjects';
import { useProjectUIStore } from '../../stores/projectUIStore';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';
import { FileTree } from './FileTree';
import { ProjectTabs } from './ProjectTabs';
import { ProjectDraftEditor } from './ProjectDraftEditor';
import { ProjectTaskList } from './ProjectTaskList';

const MIN_SIDEBAR = 160;
const MAX_SIDEBAR = 400;
const MIN_TASK_PANEL = 200;
const MAX_TASK_PANEL = 500;

export function ProjectsView() {
  const { t } = useTranslation();
  const { projects, updateProject, deleteProject } = useProjects();
  const activeTabId = useProjectUIStore((s) => s.activeTabId);
  const closeTab = useProjectUIStore((s) => s.closeTab);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  // Resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const sidebarDragging = useRef(false);

  // Resizable task panel width
  const [taskPanelWidth, setTaskPanelWidth] = useState(288);
  const taskDragging = useRef(false);

  const activeProject = projects.find((p) => p.id === activeTabId) ?? null;

  const handleDelete = () => {
    if (!activeProject) return;
    if (confirm(t('projects.deleteConfirm'))) {
      closeTab(activeProject.id);
      deleteProject(activeProject.id);
    }
  };

  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarDragging.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!sidebarDragging.current) return;
      const newWidth = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth + (ev.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      sidebarDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  const handleTaskMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    taskDragging.current = true;
    const startX = e.clientX;
    const startWidth = taskPanelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      if (!taskDragging.current) return;
      // Dragging left increases task panel width
      const newWidth = Math.min(MAX_TASK_PANEL, Math.max(MIN_TASK_PANEL, startWidth - (ev.clientX - startX)));
      setTaskPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      taskDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [taskPanelWidth]);

  return (
    <div className="flex h-[calc(100vh-0px)] md:h-screen overflow-hidden">
      {/* Mobile tree toggle */}
      <button
        onClick={() => setMobileTreeOpen(!mobileTreeOpen)}
        className="md:hidden fixed top-3 left-2 z-30 px-2 py-1 rounded-lg text-xs text-text-muted bg-bg-primary"
        style={{ boxShadow: NEU.raisedSm }}
      >
        {mobileTreeOpen ? '✕' : '☰'}
      </button>

      {/* Mobile tree drawer overlay */}
      <AnimatePresence>
        {mobileTreeOpen && (
          <motion.div
            className="fixed inset-0 z-20 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileTreeOpen(false)}
          >
            <div className="absolute inset-0 bg-black/20" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* File tree sidebar - desktop: resizable */}
      <div
        className="hidden md:flex shrink-0 flex-col bg-bg-primary border-r border-border relative"
        style={{ width: sidebarWidth }}
      >
        <div className="px-3 pt-3 pb-1">
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted/70">
            {t('projects.title')}
          </h2>
        </div>
        <FileTree />
        {/* Resize handle */}
        <div
          onMouseDown={handleSidebarMouseDown}
          className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors z-10"
        />
      </div>

      {/* File tree sidebar - mobile drawer */}
      <AnimatePresence>
        {mobileTreeOpen && (
          <motion.div
            className="fixed top-0 left-0 bottom-0 z-20 w-[260px] bg-bg-primary md:hidden flex flex-col"
            style={{ boxShadow: NEU.sidebarRight }}
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          >
            <div className="px-3 pt-3 pb-1">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-text-muted/70">
                {t('projects.title')}
              </h2>
            </div>
            <FileTree />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Right panel - tabs + content, fills all remaining space */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Tab bar - compact, flush */}
        <div className="flex items-center border-b border-border px-2 py-1 shrink-0 bg-bg-primary">
          <ProjectTabs />
          {activeProject && (
            <button
              onClick={handleDelete}
              className="text-[11px] text-text-muted hover:text-red transition-colors ml-auto pl-2 shrink-0"
            >
              {t('projects.delete')}
            </button>
          )}
        </div>

        {/* Content area */}
        {activeProject ? (
          <motion.div
            key={activeProject.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden"
          >
            {/* Editor panel */}
            <div className="flex-1 min-w-0 overflow-y-auto p-3">
              <ProjectDraftEditor
                title={activeProject.name}
                description={activeProject.description}
                onSaveTitle={(name) => updateProject(activeProject.id, { name })}
                onSave={(description) => updateProject(activeProject.id, { description })}
              />
            </div>
            {/* Task panel resize handle */}
            <div
              onMouseDown={handleTaskMouseDown}
              className="hidden lg:block w-1 shrink-0 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors border-l border-border"
            />
            {/* Task panel - resizable right sidebar */}
            <div
              className="border-t lg:border-t-0 overflow-y-auto p-3"
              style={{ width: undefined }}
            >
              <div className="lg:hidden">
                <ProjectTaskList projectId={activeProject.id} />
              </div>
              <div className="hidden lg:block" style={{ width: taskPanelWidth }}>
                <ProjectTaskList projectId={activeProject.id} />
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
            {t('projects.empty')}
          </div>
        )}
      </div>
    </div>
  );
}
