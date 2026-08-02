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

`serializeProjectTasksFile` was just the first one caught. `serializeTimeEntries`,
`serializeTodayTasks`, and `serializeInbox` had the identical bug and now share
the fix through the same helper, `maxUpdatedAt` (`serializers.ts`): the file's
stamp is the latest `updatedAt` actually present among the rows being written,
never the wall clock.

## No separate write-loop guard

A third fix might seem missing from the two above: something to suppress the
file-watcher event that fires when the app observes its *own* write. There
isn't one — `writeGuard.ts`, a per-path TTL map, was deleted rather than wired
in properly.

It was already dead code: `mark()`, the method that would have started a
path's TTL, was never called from anywhere, so the guard had been inert since
it shipped. It also could not have worked as designed even if it were wired
up — its 2-second TTL is shorter than `PollingWatcher`'s 5-second interval
(`POLL_INTERVAL_MS`), the fallback used wherever native file-watching isn't
available (e.g. Android external storage), so a slow poll cycle could let the
guard expire before the self-write's own event arrived. A timing-based guard
that expires too early lets the self-write back in; one that expires too late
can just as easily suppress a genuine external edit landing in the same
window. Either failure loses data, which a merge rule cannot.

The protections actually in place don't have that problem, because neither
depends on timing. `TauriVaultBackend.writeFile` skips a write whose content
already matches what's on disk, so the app's own re-write of unchanged data
never touches mtime and never looks like a change to begin with. And every
ordinary merge (`mergeEntity` in `vaultKinds.ts`, `SETTINGS_KIND.mergeRow`)
applies only on a strict `incoming.updatedAt > existing.updatedAt` — a
self-write that does get re-observed and re-imported ties on `updatedAt` and
simply fails to apply, correct no matter how the watcher and an export happen
to interleave. `vaultSync.test.ts` pins exactly this loop: re-importing the
file the app just wrote for an activity leaves Dexie byte-for-byte unchanged,
with no suppression involved at all.

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

With `base === null` — nothing recorded yet, because this device has never
synced this path before — both merges degrade to a union. That is not only a
one-time event: `vaultBase` is device-local and gets wiped along with every
other synced table by `switchVault`'s `clearAllTables` (`db/index.ts`), so a
device sees `base === null` again for a whole vault every time it switches to
a different one, not just on its first-ever sync. No deletion can be proven in
that state, so nothing is dropped. That errs toward keeping too much, which a
user can fix by hand, rather than losing text, which they cannot.

## Module layout

| Module | Responsibility |
|---|---|
| `threeWayMerge.ts` | Pure merge algorithms: `mergeTextBodies` (paragraphs), `mergeRowSets` (id-keyed rows). No I/O. |
| `vaultBase.ts` | Records, reads and prunes the agreed-state snapshot per path. |
| `conflictResolver.ts` | Finds conflict copies, plans the merge (`planMerge`, pure), persists it, deletes the copy. |
| `conflictPaths.ts` | Recognizes a conflict-copy path and the file it belongs to (`conflictTargetPath`) — the one place that owns the `.sync-conflict-<date>-<time>-<device>` naming convention. |

`resolveConflicts()` runs from `vaultStore.enable` and `vaultStore.syncNow`,
**before** the import — and against the *real* backend. The import reads from
`scanToMemoryBackend()`, a read-only snapshot that cannot delete the copies on
disk.

It is safe to run repeatedly: a copy is deleted only after its content has
reached Dexie, so an interrupted run leaves the rest for the next pass.

Discovery for a `perEntityDir` kind (projects, project tasks) does not depend
on the canonical file existing: `discoverPaths` alone only reports a project
directory once its `project.md`/`tasks.md` is present, so a directory whose
canonical file was renamed away as the conflict loser — or never arrived at
all — would otherwise be invisible to the scan. `conflictDirs` additionally
lists every directory under the kind's own `dir` via `backend.listDirs()` for
these two kinds, which finds a directory regardless of what's inside it, so
one holding only a conflict copy is still scanned and its data recovered.

`conflictTargetPath` lives in its own module rather than in
`conflictResolver.ts` (which still re-exports it for existing callers) because
`vaultSync.ts` needs it too, and `conflictResolver.ts` already imports
`writeEntityToDisk` from `vaultSync.ts` — importing it back the other way
would make the two modules mutually dependent.

**A conflict copy is never treated as an ordinary file.** Both
`importAllFromDisk` and `handleExternalChange` (`vaultSync.ts`) check
`conflictTargetPath` before touching a path. Without that check, a kind's
loose prefix/extension matching (`discoverPaths`) would happily import a
`.sync-conflict-*` copy as an extra row of the same kind — bypassing the
three-way merge entirely and polluting `fileIndex`/`vaultBase` with a path
that `resolveConflicts()` is about to delete. `resolveConflicts()` is the only
code allowed to read and then delete a conflict copy. One that arrives while
the app is already running — via the file watcher started in
`vaultStore.enable` — skips the 60-second periodic reconcile and triggers
`syncNow()` immediately instead (unless a sync is already in flight), so it
gets folded in within moments rather than sitting on disk until the next
scheduled pass.

**A failed resolution leaves everything exactly as it found it.** If the copy
is unreadable, its content doesn't parse, or the rewrite-to-disk step below
throws, `resolveOne` returns early without deleting the copy or touching the
recorded base — the next pass retries against the same ancestor. There used
to be a `forgetBase` call in this failure path; dropping the base made the
*next* attempt after a real failure degrade to a union merge (see "Three-way
merge" above) instead of retrying with the same information it already had.

**Every successful merge is written back to disk and its base recorded before
`resolveOne` returns — for every kind, not only the entity-scoped ones**
(activities, projects) whose file is named directly after the row. An
aggregate kind's target (`tasks.md`, a time-log date, the inbox, folders, even
`settings.json`'s non-keyed branch below) is re-resolved through the same
`writeEntityToDisk` a live edit would use, keyed off any row the merge left
standing — or, if the merge deleted every row, one of the ids it just proved
deleted. This works because `gatherWriteSet` already knows how to turn any one
row's id into "regenerate the whole owning file" for these kinds. Without it,
a merge could be correct in Dexie yet never reach disk until an unrelated
write happened to trigger a re-export — leaving the conflict copy deleted and
the merged content nowhere a peer's next sync could see it.

`vault.json` is the one vault-relative path with no `VaultKind` at all:
`exportAllToDisk` writes it once, guarded by an `exists` check, and nothing
ever reads its content back. `resolveConflicts()` handles it separately, after
the per-kind loop — it lists the vault root directly and deletes any
`vault.json.sync-conflict-*` copy outright. Deleting the copy *is* the
resolution; there is no target to merge into.

## Per-kind behaviour

Three optional members on `VaultKind` carry the per-kind differences, keeping
the logic in the registry rather than in the resolver:

- **`textField`** — names a row field holding free-form prose. Rows present on
  both sides get that field merged paragraph-wise instead of resolved by
  last-write-wins. Only `PROJECTS_KIND` sets it (`'description'`, the project
  note): two devices appending to one note produce two equally valid bodies, and
  LWW would discard one wholesale. Kinds whose rows are entirely structured omit
  it — per-row LWW is already correct for them.
- **`softDeleteRow`** — for kinds whose file can lose an individual row while the
  file itself survives. `PROJECT_TASKS_KIND`, `TIME_LOG_KIND`, `TODAY_KIND`,
  `INBOX_KIND`, and `FOLDERS_KIND` all set it: each aggregates several rows
  into one file (a project's tasks, a day's time entries or today-tasks, the
  whole inbox, the whole folder list), so one row can vanish from an otherwise
  intact file — and without a handler, the merge correctly proves the
  deletion but has nowhere to record it, leaving the local row active until
  the next export resurrects it in the file. `ACTIVITIES_KIND` and
  `PROJECTS_KIND` omit it because they are per-entity files: a row's deletion
  *is* the file's deletion, handled by `gatherWriteSet`'s `deletes` list
  rather than a row-level soft-delete. `SETTINGS_KIND` omits it because its
  file has no keyed rows at all — its one row is merged field-by-field
  instead (below), not soft-deleted a row at a time.
- **`rowBelongsTo`** — a membership check for a kind whose rows can move to a
  DIFFERENT file of the same kind: `moveTaskToProject` (`db/taskOps.ts`)
  reassigns a `ProjectTask`'s `projectId`, relocating it from one project's
  `tasks.md` to another's, and a `TimeEntry`/`TodayTask`'s `date` can move it
  between per-date files the same way. `PROJECT_TASKS_KIND`, `TIME_LOG_KIND`,
  and `TODAY_KIND` set it; `INBOX_KIND`/`FOLDERS_KIND` don't need it (a single
  file, nothing for a row to move to). See below for why it exists and how the
  base-diff rule calls it.

A kind that sets `softDeleteRow` needs it for more than an actual Syncthing
conflict — **the identical rule also runs on an ordinary file change**, via a
shared helper, `applyBaseDiffDeletions` (`vaultSync.ts`). It diffs an incoming
file's row ids against this device's last recorded base for that path; an id
that was in the base but is missing from the file is soft-deleted, with no
comparison to the local row's own `updatedAt`. Deletion wins over a concurrent
local edit unconditionally — deliberate, and consistent with `mergeRowSets`,
which already resolves a base-had-it, now-missing row as a deletion the same
way, so an ordinary file must resolve identically whether or not it happens to
arrive alongside an actual conflict copy. The cost is that editing a row at
the same moment another device deletes it can lose the edit outright;
Syncthing's own file versioning (see `docs/vault-sync.md`) is the recovery net
for that case, not the app.

The helper runs from **both** places a rewritten file can reach this device:
`importAllFromDisk`'s whole-vault scan, and `handleExternalChange`'s
create/modify branch — the file watcher delivering a peer's change while the
app is already running. Both call it before recording the file's new content
as the base; recording first would erase the very evidence ("what did this id
look like last time we agreed") the inference needs, so a deletion missed on
one path could never be recovered on the other.

Before soft-deleting an id the base-diff proves missing, every call site
(the helper, and `resolveOne`'s own `plan.deletedIds` loop, for the
conflict-copy path) checks `rowBelongsTo`, when the kind sets it: the id
vanished from THIS file, but a base-diff scoped to one path can't tell that
apart from the row having simply moved to a different file of the same
kind — a task reassigned to another project, a time entry re-dated to
another day. `rowBelongsTo` reads the LIVE Dexie row for that id and asks
whether its current scope (`projectId`, `date`) still matches this file's
own scope (`ParsedFile.ownerId`, read from the file's own frontmatter/JSON
so it survives a file with zero rows left). A mismatch means the row
migrated, not deleted — the soft-delete is skipped and the row is left
exactly as it is, wherever it actually lives now.

**The live-row check alone is order-dependent, and was not enough on its
own.** It's only correct once THIS device already knows about the move —
i.e. Dexie's row already reflects the new `projectId`/`date`. A device
learning about a cross-file move via the very same sync batch it's
currently processing has a live row that's still PRE-move at the moment the
source file's deletion is decided, so `rowBelongsTo` reports "still belongs
here," the row gets soft-deleted with `updatedAt` stamped to now, and the
destination file's own (older-timestamped) copy then loses the LWW race
outright — happening deterministically whenever the source file's path
happens to sort or arrive before the destination's. A second, independent
signal closes this without depending on Dexie having caught up:

- **`importAllFromDisk`** restructures its per-kind loop into two phases —
  read+parse+merge every path of the kind first, collecting the union of
  every row id seen anywhere in that batch, and only THEN decide deletions
  per path. An id present in another file of the kind THIS RUN is treated as
  moved regardless of what Dexie's live row says, closing the batch-order
  race completely: the full picture is known before any path's decision is
  made.
- **`handleExternalChange`** (the watcher, one file per call) and
  **`resolveOne`**'s `plan.deletedIds` loop (the conflict-copy path,
  pre-import) don't have a batch to draw that union from, so both consult
  `idsInOtherFilesOfKind` (`vaultSync.ts`) instead: an on-demand scan of the
  kind's OTHER files straight off the backend's CURRENT disk contents.
  Lazy and memoized (computed at most once, only once a soft-delete is
  actually being considered) so it costs nothing on an ordinary edit.

Both call sites pass whichever signal they have BEFORE consulting
`rowBelongsTo`'s live-row check — cheaper when precomputed (import), and
strictly more informative than Dexie's possibly-stale state either way.

**Residual risk (accepted, not fully closable from application code):** the
on-demand scan only helps if the move's destination file has already
reached the backend by the time the scan runs. The same limit applies to
`importAllFromDisk`'s batch union: the evidence in every path is whatever
is locally on disk at scan time, so a destination file Syncthing has not
yet delivered leaves all three paths equally exposed — "closing the
batch-order race" above refers to the processing order of files already
present, not to files still in transit from a peer. In the ordinary case it has —
a real move writes both files together, and neither Syncthing nor the local
filesystem waits for one device to finish reacting to one file before
delivering the next — but a genuine write-timing race (the destination file
still landing on disk at the exact moment the scan runs) remains possible
and is not something a single-file watcher event or a pre-import conflict
resolve can fully rule out. If that race is lost, the wrongful soft-delete
still happens and stamps `updatedAt` to now; because `mergeRow`'s LWW is
strict `>`, the later-arriving destination-file row (carrying the move's own,
older `updatedAt`) can never outrank it, so even the now order-independent
60-second reconcile cannot undo it — the deletion has already won. Sequential
watcher-event dispatch (`vaultStore.ts`) makes the outcome deterministic
rather than additionally racy, but does not by itself close this window.

`pruneBases` — the sweep that drops a `vaultBase` entry once its path is no
longer live — is skipped for the whole import whenever any kind errored.
`importAllFromDisk` only marks a path as `seen` once it fully imports; a kind
that failed partway leaves some of its live paths unmarked even though the
files on disk are untouched, and pruning on that run would forget their
recorded bases for no reason. Pruning simply resumes on the next clean run.

`inbox.md` relies on the same base-diff rule to express the one case a plain
file-delete can't: deleting the last inbox item no longer deletes the file.
`INBOX_KIND.collectFiles` keeps writing an empty-list `inbox.md` once the
inbox has ever held a row (soft-deleted rows count), mirroring the same
"ever had rows" rule `FOLDERS_KIND` already applies. An aggregate file has no
`fileIndex` entry, so if the file itself vanished, a peer's external-change
handler would have no id to soft-delete and its own next export would simply
resurrect the item. An empty file, by contrast, is an ordinary MODIFY — a row
missing from a file that still exists — which the base-diff rule above
already reads correctly as a deletion.

Structured rows always resolve by `id` + `updatedAt` — the same rule
`mergeEntity` applies — so a conflict copy can never resolve differently than
the file would have if it had arrived without conflicting.

Settings is the one kind with no keyed rows: `settings.json` is a single flat
record of a dozen or so scalar behavior settings, so id+updatedAt row merging
doesn't apply. When target, copy, and (if recorded) base each parse to exactly
one row, `resolveOne`'s non-keyed branch merges them field by field
(`mergeFlatRecord` in `threeWayMerge.ts`) instead of swapping the whole row:
each field takes whichever side changed it since `base`, and only a field
changed on *both* sides falls back to the same strict-`>` LWW rule as
everywhere else. This is what lets two devices that toggled different
settings while disconnected converge with both changes intact, instead of one
device's entire settings row winning and silently discarding the other's
edit. Any shape the merge can't reason about (no target file yet, more than
one row on some side) falls back to the previous whole-row LWW hand-off.

That field-wise reconciliation only happens inside an actual conflict
resolution, where a base is available to arbitrate. Outside one,
`SETTINGS_KIND.mergeRow` handles both whole-vault import and a live external
file-change event with one single rule: apply the incoming row only if no
local row exists yet or the incoming row's `updatedAt` is strictly newer. The
two call sites used to differ — the external-change path did an unconditional
`put`, selected via a `MergeSource` parameter threaded through `mergeRow` —
which let a stale file delivered late, or the app's own just-written file
re-observed by the watcher, clobber newer local settings. Both sources are
strict now, `MergeSource` has been deleted along with the distinction it
existed to carry, and a self-re-imported file is a provable no-op: its
`updatedAt` equals the stored row's, so it never re-applies.

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

The non-keyed (settings) branch bumps for the identical reason: `resolveOne`
advances `updatedAt` whenever the field-wise merge (`mergeFlatRecord`)
produces a row that differs from `ours`, using the same `changedFromOurs`
signal the merge already returns. Without it, a settings conflict this
device's values happen to win would compute correctly and then fail to
persist for the same tie-on-`updatedAt` reason as above.

## Testing

`planMerge` is pure and exported precisely so the shipped decision logic can be
tested without IndexedDB (the suite runs in vitest's `node` environment and the
project has no `fake-indexeddb`). Merge behaviour changes belong in
`threeWayMerge.test.ts` (algorithms) and `conflictResolver.test.ts` (planning
and path parsing).

Orchestration in `resolveOne`/`resolveConflicts` — backend reads, Dexie writes,
copy deletion, base recording — is covered end-to-end by
`conflictResolver.e2e.test.ts`, running against `MemoryBackend` and the
`fake-indexeddb` harness (`testSupport.ts`). It always produces on-disk bytes
through the real serializers rather than hand-written frontmatter/JSON, so a
scenario also pins format fidelity, and it exercises the discovery path (a
kind's directories, the vault root for singletons) rather than only the merge
decision. Subsequent fix-tasks extend this suite with a regression scenario
each rather than adding a parallel one.

Two narrower contract tests guard failure modes that don't look like a
merge-logic bug at all, which is exactly why they need their own test rather
than relying on the scenarios above to catch them. `backendContract.test.ts`
runs a shared listing contract — `listFiles`/`listDirs` return clean,
leading-slash-free, direct-children-only paths — against `MemoryBackend`; the
test file's own comment defers running the same suite against
`TauriVaultBackend` to a future task, so that backend isn't exercised
directly here. What actually pins the Tauri side today is narrower but real:
both backends build child paths through the same `joinChildPath` helper
(`vaultBackend.ts`), and the file's separate `joinChildPath` tests pin its
root case — `joinChildPath('', name)` must not produce a leading slash —
which is exactly what `TauriVaultBackend.listFiles`/`listDirs` call for every
entry. A leading slash at the vault root once made `conflictTargetPath` never
match a root singleton's conflict copy on a real Tauri backend, so
`settings.json`/`folders.json`/`inbox.md` conflict copies silently piled up
while `MemoryBackend`-only tests stayed green throughout. `capabilities.test.ts`
reads the Tauri capability file's granted `fs:allow-*` permissions directly —
not through Tauri — and checks it against every permission the vault layer
actually calls, including `fs:allow-stat`: `PollingWatcher`'s mtime snapshot
depends on `stat()`, and an ungranted permission used to fail silently (a
caught exception, frozen mtimes, no visible symptom) rather than surface as
the missing-permission bug it was. The watcher now also warns once via
`console.warn` when `stat()` fails, so the degradation is visible instead of
silent even before the permission is fixed.
