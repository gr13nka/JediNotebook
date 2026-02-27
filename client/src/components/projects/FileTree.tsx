import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useFolders } from '../../hooks/useFolders';
import { useProjects } from '../../hooks/useProjects';
import { useProjectUIStore } from '../../stores/projectUIStore';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';
import { AddProjectModal } from './AddProjectModal';
import { AddFolderModal } from './AddFolderModal';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { ProjectFolder, Project } from '@shared/types';

interface ContextMenuState {
  x: number;
  y: number;
  project: Project;
}

export function FileTree() {
  const { t } = useTranslation();
  const { folders, createFolder, deleteFolder, toggleExpanded } = useFolders();
  const { projects, createProject, deleteProject, moveProject } = useProjects();
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
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const projectsByFolder = (folderId: string) =>
    projects.filter((p) => p.folderId === folderId);

  const unfiledProjects = projects.filter((p) => !p.folderId);

  const handleNewFolder = async (data: { name: string; color: string }) => {
    await createFolder(data.name, data.color);
  };

  const handleDeleteFolder = (id: string) => {
    setConfirmDeleteFolderId(id);
  };

  const handleAddProject = async (data: { name: string; color: string }) => {
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

  // Drag handlers for projects
  const handleProjectDragStart = (projectId: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDragOverFolderId(null);
    setDragOverRoot(false);
  };

  const handleFolderDragOver = (folderId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
  };

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null);
  };

  const handleFolderDrop = (folderId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const projectId = e.dataTransfer.getData('text/plain');
    if (projectId) {
      moveProject(projectId, folderId);
    }
    setDragOverFolderId(null);
  };

  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverRoot(true);
  };

  const handleRootDragLeave = () => {
    setDragOverRoot(false);
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const projectId = e.dataTransfer.getData('text/plain');
    if (projectId) {
      moveProject(projectId, null);
    }
    setDragOverRoot(false);
  };

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
      </div>

      {/* Scrollable tree */}
      <div
        className={`flex-1 overflow-y-auto pt-1 px-1 ${dragOverRoot ? 'bg-accent/10' : ''} transition-colors`}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        {folders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            projects={projectsByFolder(folder.id)}
            activeTabId={activeTabId}
            onToggle={() => toggleExpanded(folder.id)}
            onProjectClick={openTab}
            onDelete={() => handleDeleteFolder(folder.id)}
            onContextMenu={handleContextMenu}
            onProjectDragStart={handleProjectDragStart}
            onProjectDragEnd={handleDragEnd}
            isDragOver={dragOverFolderId === folder.id}
            onDragOver={handleFolderDragOver(folder.id)}
            onDragLeave={handleFolderDragLeave}
            onDrop={handleFolderDrop(folder.id)}
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
            isActive={project.id === activeTabId}
            onClick={() => openTab(project.id)}
            onContextMenu={(e) => handleContextMenu(e, project)}
            draggable
            onDragStart={handleProjectDragStart(project.id)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

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
  activeTabId,
  onToggle,
  onProjectClick,
  onDelete,
  onContextMenu,
  onProjectDragStart,
  onProjectDragEnd,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  folder: ProjectFolder;
  projects: Project[];
  activeTabId: string | null;
  onToggle: () => void;
  onProjectClick: (id: string) => void;
  onDelete: () => void;
  onContextMenu: (e: React.MouseEvent, project: Project) => void;
  onProjectDragStart: (projectId: string) => (e: React.DragEvent) => void;
  onProjectDragEnd: () => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div>
      <div
        className={`flex items-center gap-1 px-1.5 py-[3px] rounded-md cursor-pointer group transition-colors ${
          isDragOver ? 'bg-accent/15' : 'hover:bg-bg-elevated/50'
        }`}
        onClick={onToggle}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
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
        <span className="flex-1 text-[13px] text-text-primary truncate">
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
                  isActive={project.id === activeTabId}
                  onClick={() => onProjectClick(project.id)}
                  onContextMenu={(e) => onContextMenu(e, project)}
                  draggable
                  onDragStart={onProjectDragStart(project.id)}
                  onDragEnd={onProjectDragEnd}
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
  isActive,
  onClick,
  onContextMenu,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  project: Project;
  isActive: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`w-full flex items-center gap-1.5 px-1.5 py-[3px] rounded-md text-left transition-colors ${
        isActive ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-elevated/30'
      }`}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: project.color }}
      />
      <span className="text-[13px] truncate">{project.name}</span>
    </button>
  );
}
