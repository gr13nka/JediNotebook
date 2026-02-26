import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useEffect } from 'react';
import { db } from '../db';
import { useSettingsStore } from '../stores/settingsStore';

export function usePointsCounter() {
  const [totalScore, setTotalScore] = useState(0);
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
      setTotalScore(Math.round(score));
    };
    compute();
    const interval = setInterval(compute, 60000);
    return () => clearInterval(interval);
  }, [incompleteTasks]);

  const toggleVisibility = () => {
    update({ pointsCounterVisible: !isVisible });
  };

  return { totalScore, isVisible, toggleVisibility };
}
