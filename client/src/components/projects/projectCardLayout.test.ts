import { describe, expect, it } from 'vitest';
import type { Project, ProjectFolder, ProjectGridLayout } from '@shared/types';
import {
  getProjectGridColumnCount,
  groupProjectsForGrid,
  placeProjectCardFrame,
  reconcileProjectGridLayout,
  sanitizeProjectCardFrame,
} from './projectCardLayout';

const makeProject = (id: string, sortOrder: number, folderId: string | null = null): Project => ({
  id,
  name: id,
  description: '',
  color: '#2BA89E',
  icon: '',
  sortOrder,
  isArchived: false,
  folderId,
  linkedActivityId: null,
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
  deletedAt: null,
  deviceId: 'test',
});

const makeFolder = (id: string, sortOrder: number): ProjectFolder => ({
  id,
  name: id,
  color: '#E04848',
  sortOrder,
  parentFolderId: null,
  isExpanded: true,
  createdAt: '2026-07-25T00:00:00.000Z',
  updatedAt: '2026-07-25T00:00:00.000Z',
  deletedAt: null,
  deviceId: 'test',
});

describe('project card layout', () => {
  it('uses two columns on mobile and scales desktop columns by width', () => {
    expect(getProjectGridColumnCount(360, 'mobile')).toBe(2);
    expect(getProjectGridColumnCount(700, 'desktop')).toBe(2);
    expect(getProjectGridColumnCount(900, 'desktop')).toBe(3);
    expect(getProjectGridColumnCount(1200, 'desktop')).toBe(4);
  });

  it('groups active projects by folder with unfiled projects last', () => {
    const folder = makeFolder('folder-a', 0);
    const archived = { ...makeProject('archived', 3), isArchived: true };

    const sections = groupProjectsForGrid([
      makeProject('unfiled', 0),
      makeProject('filed', 1, folder.id),
      archived,
    ], [folder]);

    expect(sections.map((section) => section.folder?.id ?? null)).toEqual([folder.id, null]);
    expect(sections.flatMap((section) => section.projects.map((project) => project.id))).toEqual(['filed', 'unfiled']);
  });

  it('clamps saved frames to the available grid', () => {
    expect(sanitizeProjectCardFrame({ col: 9, row: -4, colSpan: 4, rowSpan: 9 }, 3)).toEqual({
      col: 0,
      row: 0,
      colSpan: 3,
      rowSpan: 3,
    });
  });

  it('places a moved frame into the next open cell when it would collide', () => {
    const placed = placeProjectCardFrame(
      { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
      [{ col: 0, row: 0, colSpan: 1, rowSpan: 1 }],
      2,
    );

    expect(placed).toEqual({ col: 1, row: 0, colSpan: 1, rowSpan: 1 });
  });

  it('reconciles stale entries and appends missing projects without overlap', () => {
    const projects = [makeProject('a', 0), makeProject('b', 1), makeProject('c', 2)];
    const layout: ProjectGridLayout = {
      version: 1,
      desktop: {
        stale: { col: 0, row: 0, colSpan: 1, rowSpan: 1 },
        a: { col: 0, row: 0, colSpan: 2, rowSpan: 1 },
        b: { col: 1, row: 0, colSpan: 2, rowSpan: 1 },
      },
    };

    const next = reconcileProjectGridLayout(projects, [], layout, 3);

    expect(Object.keys(next.desktop).sort()).toEqual(['a', 'b', 'c']);
    expect(next.desktop.a).toEqual({ col: 0, row: 0, colSpan: 2, rowSpan: 1 });
    expect(next.desktop.b.row).toBeGreaterThanOrEqual(1);
    expect(next.desktop.c).toBeDefined();
  });
});

