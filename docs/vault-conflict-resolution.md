# Vault conflict resolution

How JediNotebook reconciles Syncthing conflict copies, and the constraints that
shape the design. Written for anyone changing `client/src/vault/`.

## The problem

Syncthing synchronizes files; it does not merge them. When two devices edit the
same vault file while disconnected, one version wins and the other is renamed to
`<stem>.sync-conflict-<date>-<time>-<device><ext>`. The app reads only the main
file, so without extra work the losing side's edits are invisible forever, and
the copies accumulate.

Worse, the *winner* is chosen by modification time — which is not the same thing
as "the newer edit", as the next section shows.

## Two bugs that manufactured conflicts

Both were real, and together they inverted the outcome: the **stale** side won.

**1. A wall-clock stamp in serialized output.** `serializeProjectTasksFile` set
`updatedAt: new Date().toISOString()` on every call, so `tasks.md` differed
byte-for-byte on every export even when no task had changed. Every export
therefore looked like a modification worth propagating.

**2. Unconditional writes.** `TauriVaultBackend.writeFile` rewrote files whose
content already matched. Rewriting identical bytes still updates mtime, and a
file-syncing peer reads mtime as "this changed".

A full export announced the whole vault as modified. When a device re-exported
its own database — which happens after an import — it stamped a *fresh* mtime
onto *stale* content. Two devices doing that while disconnected produced one
conflict copy per file with no edit behind either version, and the older content
won on timestamp.

> **Rule: never put `Date.now()` into serialized vault output.** Derive any
> timestamp from the data being serialized. A serializer must be a pure function
> of its input, or the sync layer sees changes that never happened.

## Three-way merge

Combining two versions requires a common ancestor. Without one, "the other
device deleted this paragraph" and "I added this paragraph" are the same
observation — a plain union cannot tell them apart, so it resurrects deleted
text.

`vaultBase` (Dexie, schema v14) stores the content of each vault file as this
device last agreed on it, recorded on every accepted read and every write. It is
**device-local and deliberately not in `vaultLayout`**: a synced base would be
rewritten by the very peer it is meant to be compared against, which is exactly
the ancestor a three-way merge cannot use.

Given `base`, an item is dropped only when `base` proves it existed and one side
removed it. Anything absent from `base` is genuinely new on whichever side has
it, and is kept.

With `base === null` — nothing recorded yet, e.g. the first run after upgrading
— both merges degrade to a union. No deletion can be proven, so nothing is
dropped. That errs toward keeping too much, which a user can fix by hand, rather
than losing text, which they cannot.

## Module layout

| Module | Responsibility |
|---|---|
| `threeWayMerge.ts` | Pure merge algorithms: `mergeTextBodies` (paragraphs), `mergeRowSets` (id-keyed rows). No I/O. |
| `vaultBase.ts` | Records, reads and prunes the agreed-state snapshot per path. |
| `conflictResolver.ts` | Finds conflict copies, plans the merge (`planMerge`, pure), persists it, deletes the copy. |

`resolveConflicts()` runs from `vaultStore.enable` and `vaultStore.syncNow`,
**before** the import — and against the *real* backend. The import reads from
`scanToMemoryBackend()`, a read-only snapshot that cannot delete the copies on
disk.

It is safe to run repeatedly: a copy is deleted only after its content has
reached Dexie, so an interrupted run leaves the rest for the next pass.

## Per-kind behaviour

Two optional members on `VaultKind` carry the per-kind differences, keeping the
logic in the registry rather than in the resolver:

- **`textField`** — names a row field holding free-form prose. Rows present on
  both sides get that field merged paragraph-wise instead of resolved by
  last-write-wins. Only `PROJECTS_KIND` sets it (`'description'`, the project
  note): two devices appending to one note produce two equally valid bodies, and
  LWW would discard one wholesale. Kinds whose rows are entirely structured omit
  it — per-row LWW is already correct for them.
- **`softDeleteRow`** — for kinds whose file can lose an individual row while the
  file itself survives. Only `PROJECT_TASKS_KIND` sets it: `tasks.md` lists a
  whole project's tasks, so one task can vanish from an otherwise intact file.
  Elsewhere deletion is encoded by a file's absence, which needs no row-level
  handler.

Structured rows always resolve by `id` + `updatedAt` — the same rule
`mergeEntity` applies — so a conflict copy can never resolve differently than
the file would have if it had arrived without conflicting.

## The `updatedAt` bump

`planMerge` advances `updatedAt` on a row whose text field actually changed.
This is load-bearing and easy to remove by mistake:

`mergeEntity` writes only on a strict `incoming.updatedAt > existing.updatedAt`.
The target file was serialized from this device's own Dexie row, so its
timestamp **equals** the stored one. Without the bump, every conflict our side
wins would compute a correct merged body and then silently fail to store it —
and the conflict copy is deleted immediately after, so the other device's text
would be gone for good.

Advancing the timestamp also carries the merged result out to the other devices,
which is what lets them converge instead of resending their half forever.

This does not contradict the no-`Date.now()` rule above. That rule forbids
spurious stamps on *unchanged* data; here the content genuinely changed.

`conflictResolver.test.ts` guards this specific failure. Both bump assertions
fail if the bump is removed — verified by removing it.

## Testing

`planMerge` is pure and exported precisely so the shipped decision logic can be
tested without IndexedDB (the suite runs in vitest's `node` environment and the
project has no `fake-indexeddb`). Merge behaviour changes belong in
`threeWayMerge.test.ts` (algorithms) and `conflictResolver.test.ts` (planning
and path parsing).

Orchestration in `resolveOne`/`resolveConflicts` — backend reads, Dexie writes,
copy deletion — is not currently covered. Adding `fake-indexeddb` would allow an
end-to-end test through `memoryBackend`; until then, changes there deserve
manual verification against a real vault.
