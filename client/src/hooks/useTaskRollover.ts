import { useEffect } from 'react';
import { db } from '../db';
import { notDeleted, softDelete, updateRecord } from '../db/repository';
import { nextBoxOrder } from '../db/taskOps';
import { computeRollover } from '../db/rollover';
import { computeCleanup } from '../db/cleanup';
import { getLogicalDate } from '../utils/time';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Module-level (not component state) so it's shared across every mount of
 * this hook and survives the async gap inside `runRollover` — see that
 * function's own comment for the double-fire race this guards against.
 */
let rolloverInFlight = false;

/**
 * Fires the daily time-box rollover (see `computeRollover`'s doc comment for
 * the rules) plus the completed-task cleanup sweep (`computeCleanup`:
 * completed → archived → soft-deleted) on mount and whenever the tab
 * regains visibility — same trigger
 * pattern as `useRecurringTaskCheck`, chosen for the same reason: a plain
 * interval misses OS-suspended timers on mobile, but the app is guaranteed
 * to re-run this the moment the user actually looks at it again.
 *
 * Settings must be loaded before this can run (`lastRolloverDate` and
 * `dayStartHour` come from there) — `App.tsx` kicks off `settingsStore.load()`
 * on mount, and this hook waits for `loaded` to flip before doing anything,
 * re-triggering itself via the `loaded` effect dependency once it does.
 *
 * The move + the `lastRolloverDate` stamp apply together in one Dexie
 * transaction, so a crash mid-run can never leave tasks moved but the date
 * unstamped (which would replay the same rollover next launch) or vice versa.
 * `settingsStore`'s own `update()` can't be used for the stamp: it isn't
 * part of this transaction, and firing it separately would let the tab close
 * between the two writes. Instead this writes `db.settings` directly inside
 * the transaction (matching `vaultStore.switchVault`'s established pattern
 * for out-of-band settings writes) and then calls `settingsStore.load()`
 * afterward to pull the new value back into the store, keeping the two in
 * sync without duplicating settings' load/merge logic here.
 */
export function useTaskRollover() {
  const loaded = useSettingsStore((s) => s.loaded);

  useEffect(() => {
    if (!loaded) return;

    const runRollover = async () => {
      // Belt-and-braces guard: a run already in flight will (via the
      // in-transaction re-check below) no-op a concurrent caller anyway, but
      // bailing here first also skips the table scan + `computeRollover` call
      // that run would otherwise waste. Cleared in `finally` so a later,
      // genuinely-new run (next visibilitychange, next logical day) isn't
      // permanently locked out by a stuck flag.
      if (rolloverInFlight) return;
      rolloverInFlight = true;
      try {
        const {
          dayStartHour,
          lastRolloverDate,
          autoArchiveCompleted,
          archiveCompletedAfterDays,
          autoDeleteArchived,
          deleteArchivedAfterDays,
        } = useSettingsStore.getState();
        const today = getLogicalDate(dayStartHour);

        // Cheap fast path duplicated from computeRollover's own rule 1: skip
        // the table scan and transaction entirely once today's rollover has
        // already run. NOT sufficient on its own — see the in-transaction
        // re-check below for why — but avoids the scan for the overwhelmingly
        // common case (every visibilitychange after the first one each day).
        if (lastRolloverDate === today) return;

        const tasks = notDeleted(await db.projectTasks.toArray());
        const { toWeek, toLater, toToday } = computeRollover({ today, lastRolloverDate, tasks });

        // Completed-task cleanup sweep, piggybacking on the same once-per-
        // logical-day trigger and idempotency guard as the box rollover. A
        // toggled-off stage maps to a `null` threshold (= stage disabled in
        // `computeCleanup`). Settings changes take effect at the next
        // logical-day sweep; the immediate mode (`archiveCompletedAfterDays
        // === 0` archiving at completion time) is handled in
        // `toggleProjectTask`, not here — though this sweep also covers it
        // for tasks completed before the setting was switched on.
        const { toArchive, toDelete } = computeCleanup({
          today,
          dayStartHour,
          archiveCompletedAfterDays: autoArchiveCompleted ? archiveCompletedAfterDays : null,
          deleteArchivedAfterDays: autoDeleteArchived ? deleteArchivedAfterDays : null,
          tasks,
        });

        await db.transaction('rw', [db.projectTasks, db.settings], async () => {
          // Re-check against the DB's own `lastRolloverDate`, not the
          // (possibly stale) `lastRolloverDate` read from the store above.
          // `useSettingsStore`'s copy only refreshes AFTER this transaction
          // commits (via the `load()` call below) — so if a second
          // `runRollover()` call started, read the stale store value, and
          // reached this transaction while a first run's transaction was
          // still in flight, the fast-path check above wouldn't have caught
          // it. Dexie serializes 'rw' transactions that touch the same
          // tables, so by the time THIS callback body runs, any earlier
          // in-flight rollover's transaction has fully committed (including
          // its settings stamp) — making this read guaranteed fresh. Without
          // it, a second run would re-apply `computeRollover`'s moves
          // (computed from a pre-commit `tasks` snapshot) on top of the
          // first run's result, demoting a task the first run just promoted
          // into 'today' — whose `scheduledDate` the first run already
          // cleared, so it can never auto-promote again on its own.
          const settings = await db.settings.get('default');
          if (settings?.lastRolloverDate === today) return;

          // Rollover unconditionally empties 'today' via demotion (toWeek/toLater)
          // before promoting toToday's tasks into it, so the promoted tasks'
          // timeBoxOrder always starts fresh at 0 — nothing stays behind to order after.
          let weekOrder = await nextBoxOrder('week');
          let laterOrder = await nextBoxOrder('later');
          let todayOrder = 0;

          for (const id of toWeek) {
            await updateRecord(db.projectTasks, id, { timeBox: 'week', timeBoxOrder: weekOrder++ });
          }
          for (const id of toLater) {
            await updateRecord(db.projectTasks, id, { timeBox: 'later', timeBoxOrder: laterOrder++ });
          }
          for (const id of toToday) {
            await updateRecord(db.projectTasks, id, {
              timeBox: 'today',
              scheduledDate: null,
              timeBoxOrder: todayOrder++,
            });
          }

          // Cleanup writes, under the same in-transaction lastRolloverDate
          // guard as the box moves above. A completed task demoted by
          // rollover (toLater) can also archive in the same run — two
          // `updateRecord` calls on the same row, both fine. One shared
          // stamp so every task archived by this sweep carries the same
          // `archivedAt` instant.
          const archivedStamp = new Date().toISOString();
          for (const id of toArchive) {
            await updateRecord(db.projectTasks, id, { archivedAt: archivedStamp });
          }
          for (const id of toDelete) {
            await softDelete(db.projectTasks, id);
          }

          // Stamped unconditionally, even if every move/cleanup array above
          // was empty (e.g. 'today' was already clear and no pin was due) — otherwise
          // this same no-op rollover would re-run on every future visibilitychange
          // until something finally did move.
          await db.settings.update('default', {
            lastRolloverDate: today,
            updatedAt: new Date().toISOString(),
          });
        });

        await useSettingsStore.getState().load();
      } finally {
        rolloverInFlight = false;
      }
    };

    runRollover();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runRollover();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [loaded]);
}
