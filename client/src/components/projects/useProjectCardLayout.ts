import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Project, ProjectCardFrame, ProjectFolder, ProjectGridLayout } from '@shared/types';
import {
  PROJECT_CARD_GAP_PX,
  PROJECT_CARD_ROW_PX,
  emptyProjectGridLayout,
  getProjectGridColumnCount,
  groupProjectsForGrid,
  placeProjectCardFrame,
  reconcileProjectGridLayout,
  sanitizeProjectCardFrame,
  updateProjectFrameInLayout,
} from './projectCardLayout';

type ProjectGridViewport = 'mobile' | 'desktop';
type InteractionKind = 'move' | 'resize';

interface ActiveInteraction {
  kind: InteractionKind;
  projectId: string;
  pointerId: number;
  startX: number;
  startY: number;
  startFrame: ProjectCardFrame;
  moved: boolean;
}

export interface ProjectGridCardModel {
  project: Project;
  rootProps: ProjectCardRootProps;
  resizeHandleProps: ProjectResizeHandleProps;
  frame: ProjectCardFrame;
  isDragging: boolean;
  isResizing: boolean;
}

export interface ProjectCardRootProps {
  role: 'button';
  tabIndex: number;
  style: React.CSSProperties;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
  onClick: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

export interface ProjectResizeHandleProps {
  type: 'button';
  'aria-label': string;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
}

export interface ProjectGridSection {
  folder: ProjectFolder | null;
  cards: ProjectGridCardModel[];
}

interface UseProjectCardLayoutOptions {
  projects: Project[];
  folders: ProjectFolder[];
  value: ProjectGridLayout | null | undefined;
  onChange: (next: ProjectGridLayout) => void | Promise<void>;
  viewport: ProjectGridViewport;
  editable: boolean;
  onActivate: (projectId: string) => void;
}

const DRAG_THRESHOLD_PX = 4;

function sameLayout(a: ProjectGridLayout, b: ProjectGridLayout): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useProjectCardLayout({
  projects,
  folders,
  value,
  onChange,
  viewport,
  editable,
  onActivate,
}: UseProjectCardLayoutOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<ActiveInteraction | null>(null);
  const draftRef = useRef<ProjectGridLayout>(value ?? emptyProjectGridLayout());
  const suppressClickRef = useRef(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [draftLayout, setDraftLayout] = useState<ProjectGridLayout>(value ?? emptyProjectGridLayout());
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeKind, setActiveKind] = useState<InteractionKind | null>(null);

  const columns = getProjectGridColumnCount(containerWidth, viewport);

  useEffect(() => {
    const next = value ?? emptyProjectGridLayout();
    draftRef.current = next;
    setDraftLayout(next);
  }, [value]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const arrangedLayout = useMemo(
    () => reconcileProjectGridLayout(projects, folders, draftLayout, columns),
    [projects, folders, draftLayout, columns],
  );

  const commitLayout = useCallback((next: ProjectGridLayout) => {
    draftRef.current = next;
    setDraftLayout(next);
  }, []);

  const getSectionProjects = useCallback((projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return [];
    const folderId = project.folderId ?? null;
    return projects.filter((item) => !item.isArchived && (item.folderId ?? null) === folderId);
  }, [projects]);

  const resolveFrame = useCallback((
    projectId: string,
    desired: ProjectCardFrame,
  ): ProjectCardFrame => {
    const sectionProjects = getSectionProjects(projectId);
    const occupied = sectionProjects
      .filter((project) => project.id !== projectId)
      .map((project) => arrangedLayout.desktop[project.id])
      .filter(Boolean)
      .map((frame) => sanitizeProjectCardFrame(frame, columns));

    return placeProjectCardFrame(desired, occupied, columns);
  }, [arrangedLayout.desktop, columns, getSectionProjects]);

  const getGridMetrics = useCallback((target: HTMLElement) => {
    const section = target.closest('[data-project-grid-section]') as HTMLElement | null;
    const width = section?.clientWidth || containerRef.current?.clientWidth || 1;
    const colWidth = (width - PROJECT_CARD_GAP_PX * (columns - 1)) / columns;
    return { colWidth, rowHeight: PROJECT_CARD_ROW_PX };
  }, [columns]);

  const beginInteraction = useCallback((
    kind: InteractionKind,
    projectId: string,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (!editable || viewport !== 'desktop') return;
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const frame = arrangedLayout.desktop[projectId] ?? { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
    activeRef.current = {
      kind,
      projectId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startFrame: frame,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveProjectId(projectId);
    setActiveKind(kind);
  }, [arrangedLayout.desktop, editable, viewport]);

  const updateInteraction = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - active.startX;
    const deltaY = event.clientY - active.startY;
    if (!active.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) return;
    active.moved = true;

    const { colWidth, rowHeight } = getGridMetrics(event.currentTarget);
    const colDelta = Math.round(deltaX / (colWidth + PROJECT_CARD_GAP_PX));
    const rowDelta = Math.round(deltaY / (rowHeight + PROJECT_CARD_GAP_PX));

    const desired = active.kind === 'move'
      ? {
          ...active.startFrame,
          col: active.startFrame.col + colDelta,
          row: active.startFrame.row + rowDelta,
        }
      : {
          ...active.startFrame,
          colSpan: active.startFrame.colSpan + colDelta,
          rowSpan: active.startFrame.rowSpan + rowDelta,
        };

    const nextFrame = resolveFrame(active.projectId, sanitizeProjectCardFrame(desired, columns));
    commitLayout(updateProjectFrameInLayout(draftRef.current, active.projectId, nextFrame));
  }, [columns, commitLayout, getGridMetrics, resolveFrame]);

  const endInteraction = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (active.moved) {
      suppressClickRef.current = true;
      const next = reconcileProjectGridLayout(projects, folders, draftRef.current, columns);
      commitLayout(next);
      void onChange(next);
    }

    activeRef.current = null;
    setActiveProjectId(null);
    setActiveKind(null);
  }, [columns, commitLayout, folders, onChange, projects]);

  const sections = useMemo<ProjectGridSection[]>(() => {
    const grouped = groupProjectsForGrid(projects, folders);
    return grouped.map((section) => ({
      folder: section.folder,
      cards: section.projects.map((project) => {
        const frame = arrangedLayout.desktop[project.id] ?? { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
        const isDragging = activeProjectId === project.id && activeKind === 'move';
        const isResizing = activeProjectId === project.id && activeKind === 'resize';
        const desktopStyle: React.CSSProperties = viewport === 'desktop'
          ? {
              gridColumn: `${frame.col + 1} / span ${frame.colSpan}`,
              gridRow: `${frame.row + 1} / span ${frame.rowSpan}`,
              minHeight: frame.rowSpan * PROJECT_CARD_ROW_PX + (frame.rowSpan - 1) * PROJECT_CARD_GAP_PX,
            }
          : {};

        return {
          project,
          frame,
          isDragging,
          isResizing,
          rootProps: {
            role: 'button',
            tabIndex: 0,
            style: desktopStyle,
            onPointerDown: (event) => beginInteraction('move', project.id, event),
            onPointerMove: updateInteraction,
            onPointerUp: endInteraction,
            onPointerCancel: endInteraction,
            onClick: () => {
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              onActivate(project.id);
            },
            onKeyDown: (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onActivate(project.id);
              }
            },
          },
          resizeHandleProps: {
            type: 'button',
            'aria-label': 'Resize project card',
            onPointerDown: (event) => beginInteraction('resize', project.id, event),
            onPointerMove: updateInteraction,
            onPointerUp: endInteraction,
            onPointerCancel: endInteraction,
            onClick: (event) => event.stopPropagation(),
          },
        };
      }),
    }));
  }, [activeKind, activeProjectId, arrangedLayout.desktop, beginInteraction, endInteraction, folders, onActivate, projects, updateInteraction, viewport]);

  const resetLayout = useCallback((projectId?: string) => {
    const current = { ...draftRef.current.desktop };
    if (projectId) delete current[projectId];
    else {
      for (const key of Object.keys(current)) delete current[key];
    }
    const next = reconcileProjectGridLayout(projects, folders, { version: 1, desktop: current }, columns);
    if (!sameLayout(next, draftRef.current)) {
      commitLayout(next);
      void onChange(next);
    }
  }, [columns, commitLayout, folders, onChange, projects]);

  return {
    containerProps: {
      ref: containerRef,
    },
    sections,
    columns,
    resetLayout,
  };
}
