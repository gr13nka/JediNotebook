import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useEffect } from 'react';
import { db } from '../db';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Sum of every incomplete task's age² (in days), recomputed every minute.
 * Rises the longer a task sits undone — a staleness penalty, not a reward:
 * despite the persisted setting names (`pointsCounterVisible`/
 * `pointsColorFixed`, kept as-is), a higher number is worse.
 */
export function useStalenessScore() {
  const [stalenessScore, setStalenessScore] = useState(0);
  const isVisible = useSettingsStore(s => s.pointsCounterVisible);
  const update = useSettingsStore(s => s.update);

  const incompleteTasks = useLiveQuery(
    () => db.projectTasks.filter(t => !t.deletedAt && !t.isCompleted).toArray(),
    [],
  );

  useEffect(() => {
    const compute = () => {
      if (!incompleteTasks) return;
      const now = Date.now();
      let score = 0;
      for (const task of incompleteTasks) {
        const ageMs = now - new Date(task.createdAt).getTime();
        const ageDays = ageMs / 86400000;
        score += ageDays * ageDays;
      }
      setStalenessScore(Math.round(score));
    };
    compute();
    const interval = setInterval(compute, 60000);
    return () => clearInterval(interval);
  }, [incompleteTasks]);

  const toggleVisibility = () => {
    update({ pointsCounterVisible: !isVisible });
  };

  return { stalenessScore, isVisible, toggleVisibility };
}
