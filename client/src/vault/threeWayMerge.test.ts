import { describe, it, expect } from 'vitest';
import { mergeTextBodies, mergeRowSets } from './threeWayMerge';

const paragraphs = (body: string) => body.split(/\n{2,}/).filter(Boolean);

describe('mergeTextBodies', () => {
  it('keeps additions from both sides', () => {
    const base = 'Общая идея';
    const ours = 'Общая идея\n\nПравка с ПК';
    const theirs = 'Общая идея\n\nПравка с телефона';

    const result = mergeTextBodies(base, ours, theirs);

    expect(paragraphs(result.body)).toEqual([
      'Общая идея',
      'Правка с ПК',
      'Правка с телефона',
    ]);
    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);
  });

  it('does not resurrect a paragraph the other side deleted', () => {
    const base = 'Оставить\n\nУдалить на телефоне';
    const ours = 'Оставить\n\nУдалить на телефоне';
    const theirs = 'Оставить';

    const result = mergeTextBodies(base, ours, theirs);

    expect(paragraphs(result.body)).toEqual(['Оставить']);
    expect(result.removed).toBe(1);
  });

  it('does not resurrect a paragraph we deleted ourselves', () => {
    const base = 'Оставить\n\nУдалить на ПК';
    const ours = 'Оставить';
    const theirs = 'Оставить\n\nУдалить на ПК';

    const result = mergeTextBodies(base, ours, theirs);

    expect(paragraphs(result.body)).toEqual(['Оставить']);
    expect(result.removed).toBe(1);
  });

  it('keeps a deletion on one side and an addition on the other', () => {
    const base = 'Общее\n\nСтарое';
    const ours = 'Общее\n\nСтарое\n\nНовое с ПК';
    const theirs = 'Общее';

    const result = mergeTextBodies(base, ours, theirs);

    expect(paragraphs(result.body)).toEqual(['Общее', 'Новое с ПК']);
  });

  it('treats whitespace-only reformatting as the same paragraph', () => {
    const base = 'Идея про    вольт';
    const ours = 'Идея про вольт';
    const theirs = 'Идея про\nвольт';

    const result = mergeTextBodies(base, ours, theirs);

    expect(paragraphs(result.body)).toHaveLength(1);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
  });

  it('falls back to a union when no base is known, losing nothing', () => {
    const ours = 'A\n\nB';
    const theirs = 'A\n\nC';

    const result = mergeTextBodies(null, ours, theirs);

    expect(paragraphs(result.body)).toEqual(['A', 'B', 'C']);
    expect(result.unionFallback).toBe(true);
    expect(result.removed).toBe(0);
  });

  it('reproduces the real Jedi-notebook divergence as a full union', () => {
    // Both devices appended to the note while disconnected; neither deleted
    // anything, so every paragraph must survive. Regression guard for the
    // 2026-07-24 conflict that lost the desktop half of this note.
    const ours = 'Попробовать ковырять тебя кодексом\n\nдобавить возможность переименовывать папку';
    const theirs = 'Попробовать ковырять тебя кодексом\n\nНадо чтобы была добавлять свои любые коробочки для задач';

    const result = mergeTextBodies('Попробовать ковырять тебя кодексом', ours, theirs);

    expect(paragraphs(result.body)).toEqual([
      'Попробовать ковырять тебя кодексом',
      'добавить возможность переименовывать папку',
      'Надо чтобы была добавлять свои любые коробочки для задач',
    ]);
    expect(result.removed).toBe(0);
  });
});

describe('mergeRowSets', () => {
  const row = (id: string, updatedAt: string, title = id) => ({ id, updatedAt, title });

  it('unions rows added on either side', () => {
    const result = mergeRowSets(
      [row('a', '2026-07-01')],
      [row('a', '2026-07-01'), row('b', '2026-07-02')],
      [row('a', '2026-07-01'), row('c', '2026-07-03')],
    );

    expect(result.rows.map(r => r.id).sort()).toEqual(['a', 'b', 'c']);
    expect(result.deletedIds).toEqual([]);
    expect(result.added).toBe(1);
  });

  it('resolves rows present on both sides by updatedAt', () => {
    const result = mergeRowSets(
      [row('a', '2026-07-01', 'старое')],
      [row('a', '2026-07-02', 'с ПК')],
      [row('a', '2026-07-03', 'с телефона')],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe('с телефона');
  });

  it('reports a row deleted on the other side instead of resurrecting it', () => {
    const result = mergeRowSets(
      [row('a', '2026-07-01'), row('b', '2026-07-01')],
      [row('a', '2026-07-01'), row('b', '2026-07-01')],
      [row('a', '2026-07-01')],
    );

    expect(result.rows.map(r => r.id)).toEqual(['a']);
    expect(result.deletedIds).toEqual(['b']);
  });

  it('keeps a row we added that the other side never saw', () => {
    const result = mergeRowSets(
      [row('a', '2026-07-01')],
      [row('a', '2026-07-01'), row('new', '2026-07-05')],
      [row('a', '2026-07-01')],
    );

    expect(result.rows.map(r => r.id).sort()).toEqual(['a', 'new']);
    expect(result.deletedIds).toEqual([]);
  });

  it('keeps everything when no base is known', () => {
    const result = mergeRowSets(
      null,
      [row('a', '2026-07-01')],
      [row('b', '2026-07-02')],
    );

    expect(result.rows.map(r => r.id).sort()).toEqual(['a', 'b']);
    expect(result.deletedIds).toEqual([]);
    expect(result.unionFallback).toBe(true);
  });
});
