/**
 * Three-way merge primitives for reconciling Syncthing conflict copies.
 *
 * When two devices edit the same vault file while disconnected, Syncthing
 * keeps the losing side as `<name>.sync-conflict-<date>-<time>-<device>.<ext>`
 * and neither file is complete on its own. Merging them needs a common
 * ancestor: without one, "deleted over there" and "added over here" are
 * indistinguishable, so a plain union silently resurrects text the user
 * deliberately removed.
 *
 * `base` is that ancestor — the content this device last agreed on with the
 * vault (recorded by `vaultBase.ts` on every read and write). An item is
 * dropped only when it was in `base` and one side removed it; anything
 * absent from `base` is genuinely new on whichever side has it, and is kept.
 *
 * With `base === null` (nothing recorded yet, e.g. the first run after
 * upgrading) both helpers degrade to a plain union: no deletion can be
 * proven, so nothing is dropped. That errs toward keeping too much, which
 * is recoverable by hand — unlike losing text, which is not.
 */

/** Split a note body into paragraphs, dropping blank runs and edge whitespace. */
function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

/**
 * Identity of a paragraph for set comparison. Whitespace is normalized so a
 * re-wrapped or re-indented paragraph still counts as the same one — an app
 * that reformats on export must not make every paragraph look new.
 */
function paragraphKey(paragraph: string): string {
  return paragraph.split(/\s+/).join(' ');
}

export interface TextMergeResult {
  /** Merged body, paragraphs separated by a blank line. */
  body: string;
  /** Paragraphs taken from `theirs` that `ours` lacked. */
  added: number;
  /** Paragraphs dropped because one side deleted them since `base`. */
  removed: number;
  /** True when no `base` was available and the merge fell back to a union. */
  unionFallback: boolean;
}

/**
 * Merge two versions of a free-text note body against their common ancestor.
 *
 * `ours` order is preserved; paragraphs only `theirs` has are appended in
 * their original order. Paragraph-level granularity means an *edit* reads as
 * a delete plus an add, so an edited-on-both-sides paragraph keeps both
 * variants rather than picking a winner — deliberate, since for a note body
 * showing both is cheaper to fix than silently discarding one.
 */
export function mergeTextBodies(
  base: string | null,
  ours: string,
  theirs: string,
): TextMergeResult {
  const baseKeys = new Set(base === null ? [] : splitParagraphs(base).map(paragraphKey));
  const ourParagraphs = splitParagraphs(ours);
  const theirParagraphs = splitParagraphs(theirs);
  const ourKeys = new Set(ourParagraphs.map(paragraphKey));
  const theirKeys = new Set(theirParagraphs.map(paragraphKey));

  // Keep ours, minus anything the other side deleted since base.
  const merged: string[] = [];
  let removed = 0;
  for (const paragraph of ourParagraphs) {
    const k = paragraphKey(paragraph);
    if (baseKeys.has(k) && !theirKeys.has(k)) {
      removed++;
      continue;
    }
    merged.push(paragraph);
  }

  // Append what only they have — but skip what we deleted since base.
  let added = 0;
  for (const paragraph of theirParagraphs) {
    const k = paragraphKey(paragraph);
    if (ourKeys.has(k)) continue;
    if (baseKeys.has(k)) {
      removed++;
      continue;
    }
    merged.push(paragraph);
    added++;
  }

  return {
    body: merged.join('\n\n'),
    added,
    removed,
    unionFallback: base === null,
  };
}

export interface RowMergeResult<T> {
  /** Rows that should exist after the merge. */
  rows: T[];
  /** Ids present in `base` that one side removed — safe to soft-delete. */
  deletedIds: string[];
  added: number;
  unionFallback: boolean;
}

/**
 * Merge two id-keyed row collections (a project's task list, say) against
 * their common ancestor.
 *
 * Rows present on both sides resolve by `updatedAt` — the same last-write-wins
 * rule `vaultKinds.mergeEntity` already applies, kept identical so a conflict
 * copy can't resolve differently than an ordinary sync would. Absence is what
 * encodes deletion in the vault format, so a row missing from one side is a
 * deletion only if `base` proves it was there to begin with.
 */
export function mergeRowSets<T extends { id: string; updatedAt: string }>(
  base: T[] | null,
  ours: T[],
  theirs: T[],
): RowMergeResult<T> {
  const baseIds = new Set((base ?? []).map(r => r.id));
  const ourById = new Map(ours.map(r => [r.id, r]));
  const theirById = new Map(theirs.map(r => [r.id, r]));

  const rows: T[] = [];
  const deletedIds: string[] = [];
  let added = 0;

  for (const [id, ourRow] of ourById) {
    const theirRow = theirById.get(id);
    if (!theirRow) {
      // Gone on their side: a deletion only if base had it, else it's ours to keep.
      if (baseIds.has(id)) deletedIds.push(id);
      else rows.push(ourRow);
      continue;
    }
    rows.push(theirRow.updatedAt > ourRow.updatedAt ? theirRow : ourRow);
  }

  for (const [id, theirRow] of theirById) {
    if (ourById.has(id)) continue;
    if (baseIds.has(id)) {
      deletedIds.push(id); // we deleted it since base
      continue;
    }
    rows.push(theirRow);
    added++;
  }

  return { rows, deletedIds, added, unionFallback: base === null };
}
