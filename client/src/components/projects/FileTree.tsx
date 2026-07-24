import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFolders } from '../../hooks/useFolders';
import { useProjects } from '../../hooks/useProjects';
import { useProjectUIStore } from '../../stores/projectUIStore';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';
import { AddProjectModal } from './AddProjectModal';
import { AddFolderModal } from './AddFolderModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useProjectTypography } from '../settings/ProjectTypographySettings';
import type { ProjectFolder, Project } from '@shared/types';

interface ContextMenuState {
  x: number;
  y: number;
  project: Project;
}

interface DragState {
  projectId: string;
  projectName: string;
  projectColor: string;
  projectIcon: string;
  startX: number;
  startY: number;
  active: boolean;
}

const DRAG_THRESHOLD = 5;

export function FileTree() {
  const { t } = useTranslation();
  const { folders, createFolder, deleteFolder, toggleExpanded } = useFolders();
  const { projects, createProject, deleteProject, moveProject, updateProject } = useProjects();
  const { projectListFontPx } = useProjectTypography();
  const openTab = useProjectUIStore((s) => s.openTab);
  const closeTab = useProjectUIStore((s) => s.closeTab);
  const activeTabId = useProjectUIStore((s) => s.activeTabId);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [addProjectFolderId, setAddProjectFolderId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<Project | null>(null);
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  // Mouse-based drag state (replaces HTML5 DnD which is broken in WKWebView)
  const dragRef = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [ghostInfo, setGhostInfo] = useState<{ name: string; color: string; icon: string } | null>(null);

  const activeProjects = projects.filter((p) => !p.isArchived);
  const inactiveProjects = projects.filter((p) => p.isArchived);
  const visibleProjects = showInactive ? projects : activeProjects;

  const projectsByFolder = (folderId: string) =>
    visibleProjects.filter((p) => p.folderId === folderId);

  const unfiledProjects = visibleProjects.filter((p) => !p.folderId);

  const handleNewFolder = async (data: { name: string; color: string }) => {
    await createFolder(data.name, data.color);
  };

  const handleDeleteFolder = (id: string) => {
    setConfirmDeleteFolderId(id);
  };

  const handleAddProject = async (data: { name: string; color: string; icon?: string }) => {
    const p = await createProject({ ...data, folderId: addProjectFolderId });
    openTab(p.id);
  };

  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, project });
  };

  const handleDeleteProject = (project: Project) => {
    setContextMenu(null);
    setConfirmDeleteProject(project);
  };

  const handleMoveToRoot = (project: Project) => {
    moveProject(project.id, null);
    setContextMenu(null);
  };

  const handleToggleActive = (project: Project) => {
    updateProject(project.id, { isArchived: !project.isArchived });
    setContextMenu(null);
  };

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

  // Find which folder (or root) the cursor is over using data attributes
  const findDropTarget = useCallback((x: number, y: number): string | null | undefined => {
    // undefined = not over any drop zone, null = root zone, string = folder id
    const el = document.elementFromPoint(x, y);
    if (!el) return undefined;
    // Walk up to find a folder drop target
    let node: Element | null = el;
    while (node) {
      if (node instanceof HTMLElement) {
        const folderId = node.dataset.dropFolderId;
        if (folderId) return folderId;
        if (node.dataset.dropRoot !== undefined) return null;
      }
      node = node.parentElement;
    }
    return undefined;
  }, []);

  // Mouse-based drag: mousedown on project
  const handleProjectMouseDown = useCallback((project: Project) => (e: React.MouseEvent) => {
    // Only left mouse button, ignore if context menu action
    if (e.button !== 0) return;
    dragRef.current = {
      projectId: project.id,
      projectName: project.name,
      projectColor: project.color,
      projectIcon: (project as any).icon ?? '',
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (!drag.active) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
        drag.active = true;
        setIsDragging(true);
        setGhostInfo({ name: drag.projectName, color: drag.projectColor, icon: drag.projectIcon });
      }

      setGhostPos({ x: e.clientX, y: e.clientY });

      // Hit-test for drop target
      const target = findDropTarget(e.clientX, e.clientY);
      if (target === undefined) {
        setDragOverFolderId(null);
        setDragOverRoot(false);
      } else if (target === null) {
        setDragOverFolderId(null);
        setDragOverRoot(true);
      } else {
        setDragOverFolderId(target);
        setDragOverRoot(false);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;

      if (drag.active) {
        const target = findDropTarget(e.clientX, e.clientY);
        if (target !== undefined) {
          // target is null (root) or string (folderId)
          moveProject(drag.projectId, target);
        }
      }

      setIsDragging(false);
      setGhostInfo(null);
      setDragOverFolderId(null);
      setDragOverRoot(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [findDropTarget, moveProject]);

  return (
    <div className="flex flex-col h-full">
      {/* Action buttons at top */}
      <div className="flex gap-1 px-1.5 py-1.5 border-b border-border justify-start">
        <button
          onClick={() => setShowAddFolder(true)}
          className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-secondary rounded-md transition-colors"
          style={{ boxShadow: NEU.raisedSm }}
          title={t('folders.newFolder')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </button>
        <button
          onClick={() => {
            setAddProjectFolderId(null);
            setShowAddProject(true);
          }}
          className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-secondary rounded-md transition-colors"
          style={{ boxShadow: NEU.raisedSm }}
          title={t('projects.newProject')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </button>
        {inactiveProjects.length > 0 && (
          <button
            onClick={() => setShowInactive((s) => !s)}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ml-auto ${
              showInactive ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
            style={{ boxShadow: showInactive ? NEU.pressedSm : NEU.raisedSm }}
            title={t('projects.showInactive')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        )}
      </div>

      {/* Scrollable tree */}
      <div
        ref={treeRef}
        className={`flex-1 overflow-y-auto pt-1 px-1 ${dragOverRoot ? 'bg-accent/10' : ''} transition-colors`}
        data-drop-root
      >
        {folders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            projects={projectsByFolder(folder.id)}
            fontPx={projectListFontPx}
            activeTabId={activeTabId}
            onToggle={() => toggleExpanded(folder.id)}
            onProjectClick={openTab}
            onDelete={() => handleDeleteFolder(folder.id)}
            onContextMenu={handleContextMenu}
            onProjectMouseDown={handleProjectMouseDown}
            isDragOver={dragOverFolderId === folder.id}
            isDragging={isDragging}
          />
        ))}

        {unfiledProjects.length > 0 && folders.length > 0 && (
          <div className="flex items-center gap-2 px-2 my-1">
            <div className="flex-1 h-px bg-text-muted/15" />
            <span className="text-[9px] uppercase tracking-wider text-text-muted/50">
              {t('folders.unfiled')}
            </span>
            <div className="flex-1 h-px bg-text-muted/15" />
          </div>
        )}

        {unfiledProjects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            fontPx={projectListFontPx}
            isActive={project.id === activeTabId}
            onClick={() => {
              if (!isDragging) openTab(project.id);
            }}
            onContextMenu={(e) => handleContextMenu(e, project)}
            onMouseDown={handleProjectMouseDown(project)}
          />
        ))}
      </div>

      {/* Drag ghost */}
      {isDragging && ghostInfo && (
        <div
          className="fixed z-[100] pointer-events-none flex items-center gap-1.5 px-2 py-1 rounded-md bg-bg-card border border-border"
          style={{
            left: ghostPos.x + 12,
            top: ghostPos.y - 10,
            boxShadow: NEU.modal,
            opacity: 0.9,
          }}
        >
          {ghostInfo.icon ? (
            <span className="text-[12px] shrink-0">{ghostInfo.icon}</span>
          ) : (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: ghostInfo.color }}
            />
          )}
          <span className="text-[12px] text-text-primary whitespace-nowrap">
            {ghostInfo.name}
          </span>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 min-w-[140px] rounded-lg py-1 bg-bg-card"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            boxShadow: NEU.modal,
          }}
        >
          {contextMenu.project.folderId && (
            <button
              onClick={() => handleMoveToRoot(contextMenu.project)}
              className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-elevated transition-colors"
            >
              {t('projects.moveToRoot')}
            </button>
          )}
          <button
            onClick={() => handleToggleActive(contextMenu.project)}
            className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-elevated transition-colors"
          >
            {contextMenu.project.isArchived ? t('projects.activate') : t('projects.deactivate')}
          </button>
          <button
            onClick={() => handleDeleteProject(contextMenu.project)}
            className="w-full text-left px-3 py-1.5 text-[12px] text-red hover:bg-bg-elevated transition-colors"
          >
            {t('projects.delete')}
          </button>
        </div>
      )}

      <AddFolderModal
        open={showAddFolder}
        onClose={() => setShowAddFolder(false)}
        onAdd={handleNewFolder}
      />

      <AddProjectModal
        open={showAddProject}
        onClose={() => setShowAddProject(false)}
        onAdd={handleAddProject}
      />

      <ConfirmModal
        open={!!confirmDeleteProject}
        onClose={() => setConfirmDeleteProject(null)}
        onConfirm={() => {
          if (confirmDeleteProject) {
            closeTab(confirmDeleteProject.id);
            deleteProject(confirmDeleteProject.id);
          }
        }}
        title={t('projects.delete')}
        message={t('projects.deleteConfirm')}
      />

      <ConfirmModal
        open={!!confirmDeleteFolderId}
        onClose={() => setConfirmDeleteFolderId(null)}
        onConfirm={() => {
          if (confirmDeleteFolderId) {
            deleteFolder(confirmDeleteFolderId);
          }
        }}
        title={t('folders.delete')}
        message={t('folders.deleteConfirm')}
      />
    </div>
  );
}

function FolderRow({
  folder,
  projects,
  fontPx,
  activeTabId,
  onToggle,
  onProjectClick,
  onDelete,
  onContextMenu,
  onProjectMouseDown,
  isDragOver,
  isDragging,
}: {
  folder: ProjectFolder;
  projects: Project[];
  fontPx: number;
  activeTabId: string | null;
  onToggle: () => void;
  onProjectClick: (id: string) => void;
  onDelete: () => void;
  onContextMenu: (e: React.MouseEvent, project: Project) => void;
  onProjectMouseDown: (project: Project) => (e: React.MouseEvent) => void;
  isDragOver: boolean;
  isDragging: boolean;
}) {
  return (
    <div>
      <div
        className={`flex items-center gap-1 px-1.5 py-[3px] rounded-md cursor-pointer group transition-colors ${
          isDragOver ? 'bg-accent/15' : 'hover:bg-bg-elevated/50'
        }`}
        data-drop-folder-id={folder.id}
        onClick={onToggle}
      >
        <motion.span
          animate={{ rotate: folder.isExpanded ? 90 : 0 }}
          transition={{ duration: 0.12 }}
          className="text-[9px] text-text-muted w-3 h-3 flex items-center justify-center shrink-0"
        >
          &#9654;
        </motion.span>
        <span
          className="w-2.5 h-2.5 rounded-sm shrink-0"
          style={{ backgroundColor: folder.color }}
        />
        <span className="flex-1 text-text-primary truncate" style={{ fontSize: `${fontPx}px` }}>
          {folder.name}
        </span>
        <span className="text-[10px] text-text-muted/60 tabular-nums">
          {projects.length}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red text-[11px] ml-0.5 transition-opacity"
        >
          &times;
        </button>
      </div>

      <AnimatePresence initial={false}>
        {folder.isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="pl-3">
              {projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  fontPx={fontPx}
                  isActive={project.id === activeTabId}
                  onClick={() => {
                    if (!isDragging) onProjectClick(project.id);
                  }}
                  onContextMenu={(e) => onContextMenu(e, project)}
                  onMouseDown={onProjectMouseDown(project)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProjectRow({
  project,
  fontPx,
  isActive,
  onClick,
  onContextMenu,
  onMouseDown,
}: {
  project: Project;
  fontPx: number;
  isActive: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}
      className={`w-full flex items-center gap-1.5 px-1.5 py-[3px] rounded-md text-left transition-colors ${
        isActive ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-elevated/30'
      } ${project.isArchived ? 'opacity-50' : ''}`}
    >
      {(project as any).icon ? (
        <span className="text-[14px] shrink-0 leading-none">{(project as any).icon}</span>
      ) : (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: project.color }}
        />
      )}
      <span className="truncate" style={{ fontSize: `${fontPx}px` }}>{project.name}</span>
    </button>
  );
}
