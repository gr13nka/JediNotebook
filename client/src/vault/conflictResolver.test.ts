import { describe, it, expect } from 'vitest';
import { conflictTargetPath, planMerge } from './conflictResolver';

describe('conflictTargetPath', () => {
  it('maps a conflict copy back to the file it came from', () => {
    expect(conflictTargetPath('projects/Проект (019ca9)/project.sync-conflict-20260724-153258-YZWMYOO.md'))
      .toBe('projects/Проект (019ca9)/project.md');
  });

  it('handles the vault-root singletons', () => {
    expect(conflictTargetPath('settings.sync-conflict-20260724-143259-YZWMYOO.json'))
      .toBe('settings.json');
    expect(conflictTargetPath('folders.sync-conflict-20260320-154334-NMMZEQI.json'))
      .toBe('folders.json');
  });

  it('handles per-date files whose stem contains dashes', () => {
    expect(conflictTargetPath('time-log/2026-03-12.sync-conflict-20260724-143259-YZWMYOO.md'))
      .toBe('time-log/2026-03-12.md');
  });

  it('returns null for ordinary files', () => {
    expect(conflictTargetPath('projects/Проект (019ca9)/project.md')).toBeNull();
    expect(conflictTargetPath('settings.json')).toBeNull();
    expect(conflictTargetPath('time-log/2026-03-12.md')).toBeNull();
  });

  it('ignores a file that merely mentions the marker', () => {
    expect(conflictTargetPath('notes/about-sync-conflict-handling.md')).toBeNull();
  });
});

describe('planMerge', () => {
  const project = (updatedAt: string, description: string) =>
    ({ id: 'p1', updatedAt, description });

  it('advances updatedAt so a merge our side won still gets stored', () => {
    // The target file is serialized from our own row, so ours.updatedAt equals
    // what the store already holds. `mergeEntity` writes only on a strict `>`,
    // so without a bump the merged body would be computed and then dropped —
    // and the conflict copy is deleted right after. Regression guard.
    const ours = project('2026-07-24T11:50:57.348Z', 'Общее\n\nПравка с ПК');
    const theirs = project('2026-07-24T01:46:16.069Z', 'Общее\n\nПравка с телефона');

    const plan = planMerge('description', [project('2026-07-24T01:00:00.000Z', 'Общее')], [ours], [theirs]);

    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].description).toContain('Правка с ПК');
    expect(plan.rows[0].description).toContain('Правка с телефона');
    expect(plan.rows[0].updatedAt > ours.updatedAt).toBe(true);
  });

  it('advances updatedAt when their side won but text still merged', () => {
    const ours = project('2026-07-24T01:46:16.069Z', 'Общее\n\nПравка с ПК');
    const theirs = project('2026-07-24T11:50:57.348Z', 'Общее\n\nПравка с телефона');

    const plan = planMerge('description', [project('2026-07-24T01:00:00.000Z', 'Общее')], [ours], [theirs]);

    expect(plan.rows[0].description).toContain('Правка с ПК');
    expect(plan.rows[0].description).toContain('Правка с телефона');
    expect(plan.rows[0].updatedAt > theirs.updatedAt).toBe(true);
  });

  it('leaves updatedAt alone when the merge changed nothing', () => {
    const ours = project('2026-07-24T11:50:57.348Z', 'Общее');
    const theirs = project('2026-07-24T01:46:16.069Z', 'Общее');

    const plan = planMerge('description', [project('2026-07-24T01:00:00.000Z', 'Общее')], [ours], [theirs]);

    expect(plan.rows[0].updatedAt).toBe(ours.updatedAt);
  });

  it('does not resurrect a paragraph deleted on the other side', () => {
    const base = [project('2026-07-24T01:00:00.000Z', 'Общее\n\nУдалить')];
    const ours = project('2026-07-24T11:50:57.348Z', 'Общее\n\nУдалить');
    const theirs = project('2026-07-24T01:46:16.069Z', 'Общее');

    const plan = planMerge('description', base, [ours], [theirs]);

    expect(plan.rows[0].description).not.toContain('Удалить');
    expect(plan.removed).toBe(1);
  });

  it('merges structured rows without a text field', () => {
    const plan = planMerge(
      undefined,
      [{ id: 't1', updatedAt: '2026-07-01' }],
      [{ id: 't1', updatedAt: '2026-07-01' }, { id: 't2', updatedAt: '2026-07-02' }],
      [{ id: 't1', updatedAt: '2026-07-03' }],
    );

    expect(plan.rows.map(r => r.id).sort()).toEqual(['t1', 't2']);
    expect(plan.rows.find(r => r.id === 't1').updatedAt).toBe('2026-07-03');
    expect(plan.deletedIds).toEqual([]);
  });
});
