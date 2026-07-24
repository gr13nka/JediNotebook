import type { Project, ProjectCardFrame, ProjectFolder, ProjectGridLayout } from '@shared/types';

export const PROJECT_CARD_GAP_PX = 12;
export const PROJECT_CARD_ROW_PX = 72;

export interface ProjectGridSectionModel {
  folder: ProjectFolder | null;
  projects: Project[];
}

export interface ProjectCardFrameInput {
  col?: number;
  row?: number;
  colSpan?: number;
  rowSpan?: number;
}

const MIN_COL_SPAN = 1;
const MAX_COL_SPAN = 4;
const MIN_ROW_SPAN = 1;
const MAX_ROW_SPAN = 3;

export function getProjectGridColumnCount(width: number, viewport: 'mobile' | 'desktop'): number {
  if (viewport === 'mobile') return 2;
  if (width >= 1120) return 4;
  if (width >= 820) return 3;
  return 2;
}

export function emptyProjectGridLayout(): ProjectGridLayout {
  return { version: 1, desktop: {} };
}

export function normalizeProjectGridLayout(value: ProjectGridLayout | null | undefined): ProjectGridLayout {
  if (!value || value.version !== 1 || typeof value.desktop !== 'object' || !value.desktop) {
    return emptyProjectGridLayout();
  }
  return { version: 1, desktop: { ...value.desktop } };
}

export function groupProjectsForGrid(projects: Project[], folders: ProjectFolder[]): ProjectGridSectionModel[] {
  const activeProjects = projects.filter((p) => !p.isArchived);
  const byFolder = new Map<string | null, Project[]>();
  for (const project of activeProjects) {
    const folderId = project.folderId ?? null;
    const existing = byFolder.get(folderId);
    if (existing) existing.push(project);
    else byFolder.set(folderId, [project]);
  }

  const sections: ProjectGridSectionModel[] = [];
  for (const folder of folders) {
    const items = byFolder.get(folder.id);
    if (items?.length) sections.push({ folder, projects: items });
  }

  const unfiled = byFolder.get(null);
  if (unfiled?.length) sections.push({ folder: null, projects: unfiled });

  return sections;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

export function sanitizeProjectCardFrame(frame: ProjectCardFrameInput | undefined, columns: number): ProjectCardFrame {
  const colSpan = clampNumber(Math.round(frame?.colSpan ?? 1), MIN_COL_SPAN, Math.min(MAX_COL_SPAN, columns)) as ProjectCardFrame['colSpan'];
  const rowSpan = clampNumber(Math.round(frame?.rowSpan ?? 1), MIN_ROW_SPAN, MAX_ROW_SPAN) as ProjectCardFrame['rowSpan'];
  return {
    col: clampNumber(Math.round(frame?.col ?? 0), 0, Math.max(0, columns - colSpan)),
    row: Math.max(0, Math.round(frame?.row ?? 0)),
    colSpan,
    rowSpan,
  };
}

export function projectCardFramesOverlap(a: ProjectCardFrame, b: ProjectCardFrame): boolean {
  return (
    a.col < b.col + b.colSpan &&
    a.col + a.colSpan > b.col &&
    a.row < b.row + b.rowSpan &&
    a.row + a.rowSpan > b.row
  );
}

function isOpen(frame: ProjectCardFrame, occupied: ProjectCardFrame[]): boolean {
  return !occupied.some((other) => projectCardFramesOverlap(frame, other));
}

export function placeProjectCardFrame(
  desired: ProjectCardFrame,
  occupied: ProjectCardFrame[],
  columns: number,
): ProjectCardFrame {
  const start = sanitizeProjectCardFrame(desired, columns);
  if (isOpen(start, occupied)) return start;

  for (let row = start.row; row < start.row + occupied.length + 24; row++) {
    for (let col = 0; col <= columns - start.colSpan; col++) {
      const candidate = { ...start, col, row };
      if (isOpen(candidate, occupied)) return candidate;
    }
  }

  const bottom = occupied.reduce((max, frame) => Math.max(max, frame.row + frame.rowSpan), 0);
  return { ...start, col: 0, row: bottom };
}

export function reconcileProjectGridLayout(
  projects: Project[],
  folders: ProjectFolder[],
  value: ProjectGridLayout | null | undefined,
  columns: number,
): ProjectGridLayout {
  const layout = normalizeProjectGridLayout(value);
  const sections = groupProjectsForGrid(projects, folders);
  const next: ProjectGridLayout = emptyProjectGridLayout();

  for (const section of sections) {
    const occupied: ProjectCardFrame[] = [];
    for (const project of section.projects) {
      const saved = layout.desktop[project.id];
      const desired = sanitizeProjectCardFrame(saved ?? { col: 0, row: occupied.length, colSpan: 1, rowSpan: 1 }, columns);
      const placed = placeProjectCardFrame(desired, occupied, columns);
      occupied.push(placed);
      next.desktop[project.id] = placed;
    }
  }

  return next;
}

export function updateProjectFrameInLayout(
  value: ProjectGridLayout | null | undefined,
  projectId: string,
  frame: ProjectCardFrame,
): ProjectGridLayout {
  const layout = normalizeProjectGridLayout(value);
  return {
    version: 1,
    desktop: {
      ...layout.desktop,
      [projectId]: frame,
    },
  };
}
