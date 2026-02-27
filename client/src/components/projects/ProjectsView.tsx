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
const MIN_TASK_PANEL_HEIGHT = 80;
const MAX_TASK_PANEL_HEIGHT_RATIO = 0.7;

export function ProjectsView() {
  const { t } = useTranslation();
  const { projects, updateProject, deleteProject } = useProjects();
  const activeTabId = useProjectUIStore((s) => s.activeTabId);
  const closeTab = useProjectUIStore((s) => s.closeTab);
  const sidebarCollapsed = useProjectUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useProjectUIStore((s) => s.toggleSidebar);
  const splitDirection = useProjectUIStore((s) => s.splitDirection);
  const setSplitDirection = useProjectUIStore((s) => s.setSplitDirection);
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  // Resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const sidebarDragging = useRef(false);

  // Resizable task panel width (vertical split)
  const [taskPanelWidth, setTaskPanelWidth] = useState(288);
  const taskDragging = useRef(false);

  // Resizable task panel height (horizontal split)
  const [taskPanelHeight, setTaskPanelHeight] = useState(240);
  const taskHeightDragging = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

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

  const handleTaskHeightMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    taskHeightDragging.current = true;
    const startY = e.clientY;
    const startHeight = taskPanelHeight;
    const containerHeight = contentRef.current?.clientHeight ?? 600;
    const maxHeight = containerHeight * MAX_TASK_PANEL_HEIGHT_RATIO;

    const onMouseMove = (ev: MouseEvent) => {
      if (!taskHeightDragging.current) return;
      // Dragging up increases task panel height
      const newHeight = Math.min(maxHeight, Math.max(MIN_TASK_PANEL_HEIGHT, startHeight - (ev.clientY - startY)));
      setTaskPanelHeight(newHeight);
    };

    const onMouseUp = () => {
      taskHeightDragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [taskPanelHeight]);

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

      {/* File tree sidebar - desktop: resizable, collapsible */}
      {!sidebarCollapsed && (
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
      )}

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
          {/* Sidebar toggle button (desktop only) */}
          <button
            onClick={toggleSidebar}
            className="hidden md:flex w-6 h-6 items-center justify-center text-text-muted hover:text-text-secondary rounded transition-colors shrink-0 mr-1"
            title={t('projects.toggleSidebar')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              {sidebarCollapsed ? (
                <polyline points="14 9 17 12 14 15" />
              ) : (
                <polyline points="17 9 14 12 17 15" />
              )}
            </svg>
          </button>

          <ProjectTabs />

          <div className="flex items-center gap-1 ml-auto pl-2 shrink-0">
            {/* Split direction toggle (desktop only) */}
            <button
              onClick={() => setSplitDirection(splitDirection === 'vertical' ? 'horizontal' : 'vertical')}
              className="hidden lg:flex w-6 h-6 items-center justify-center text-text-muted hover:text-text-secondary rounded transition-colors"
              title={splitDirection === 'vertical' ? t('projects.splitHorizontal') : t('projects.splitVertical')}
            >
              {splitDirection === 'vertical' ? (
                // Currently side-by-side, icon shows "stack" option
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                </svg>
              ) : (
                // Currently stacked, icon shows "side-by-side" option
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                </svg>
              )}
            </button>

            {activeProject && (
              <button
                onClick={handleDelete}
                className="text-[11px] text-text-muted hover:text-red transition-colors"
              >
                {t('projects.delete')}
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        {activeProject ? (
          <motion.div
            ref={contentRef}
            key={activeProject.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className={`flex-1 flex min-h-0 overflow-hidden ${
              splitDirection === 'vertical' ? 'flex-col lg:flex-row' : 'flex-col'
            }`}
          >
            {/* Editor panel */}
            <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-3">
              <ProjectDraftEditor
                title={activeProject.name}
                description={activeProject.description}
                onSaveTitle={(name) => updateProject(activeProject.id, { name })}
                onSave={(description) => updateProject(activeProject.id, { description })}
              />
            </div>
            {/* Task panel resize handle — vertical (col-resize) or horizontal (row-resize) */}
            {splitDirection === 'vertical' ? (
              <div
                onMouseDown={handleTaskMouseDown}
                className="hidden lg:block w-1 shrink-0 cursor-col-resize hover:bg-accent/30 active:bg-accent/50 transition-colors border-l border-border"
              />
            ) : (
              <div
                onMouseDown={handleTaskHeightMouseDown}
                className="h-1 shrink-0 cursor-row-resize hover:bg-accent/30 active:bg-accent/50 transition-colors border-t border-border"
              />
            )}
            {/* Task panel */}
            <div
              className={`overflow-y-auto p-3 ${
                splitDirection === 'vertical' ? 'border-t lg:border-t-0' : ''
              }`}
              style={splitDirection === 'horizontal' ? { height: taskPanelHeight, flexShrink: 0 } : undefined}
            >
              {splitDirection === 'vertical' ? (
                <>
                  <div className="lg:hidden">
                    <ProjectTaskList projectId={activeProject.id} />
                  </div>
                  <div className="hidden lg:block" style={{ width: taskPanelWidth }}>
                    <ProjectTaskList projectId={activeProject.id} />
                  </div>
                </>
              ) : (
                <ProjectTaskList projectId={activeProject.id} />
              )}
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
