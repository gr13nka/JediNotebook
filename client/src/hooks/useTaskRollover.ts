import { useEffect } from 'react';
import { db } from '../db';
import { notDeleted, updateRecord } from '../db/repository';
import { countActiveInBox } from '../db/taskOps';
import { computeRollover } from '../db/rollover';
import { getLogicalDate } from '../utils/time';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Fires the daily time-box rollover (see `computeRollover`'s doc comment for
 * the rules) on mount and whenever the tab regains visibility — same trigger
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
      const { dayStartHour, lastRolloverDate } = useSettingsStore.getState();
      const today = getLogicalDate(dayStartHour);

      // Idempotency guard duplicated from computeRollover's own rule 1: skip
      // the table scan and transaction entirely once today's rollover has
      // already run, since mount + every subsequent visibilitychange during
      // the same logical day would otherwise re-query for nothing.
      if (lastRolloverDate === today) return;

      const tasks = notDeleted(await db.projectTasks.toArray());
      const { toWeek, toLater, toToday } = computeRollover({ today, lastRolloverDate, tasks });

      await db.transaction('rw', [db.projectTasks, db.settings], async () => {
        // Rollover unconditionally empties 'today' via demotion (toWeek/toLater)
        // before promoting toToday's tasks into it, so the promoted tasks'
        // timeBoxOrder always starts fresh at 0 — nothing stays behind to order after.
        let weekOrder = await countActiveInBox('week');
        let laterOrder = await countActiveInBox('later');
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

        // Stamped unconditionally, even if all three arrays above were empty
        // (e.g. 'today' was already clear and no pin was due) — otherwise
        // this same no-op rollover would re-run on every future visibilitychange
        // until something finally did move.
        await db.settings.update('default', {
          lastRolloverDate: today,
          updatedAt: new Date().toISOString(),
        });
      });

      await useSettingsStore.getState().load();
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
