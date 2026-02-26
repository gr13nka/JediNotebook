import { useState } from 'react';
import { motion } from 'motion/react';
import { HabitCard } from './HabitCard';
import { AddHabitModal } from './AddHabitModal';
import { Button } from '../ui/Button';
import { useHabits } from '../../hooks/useHabits';
import { useTranslation } from '../../i18n/useTranslation';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function HabitList() {
  const { habits, weekEntries, weekDates, today, streaks, createHabit, toggleBooleanHabit, logNumericHabit, deleteHabit } = useHabits();
  const [showModal, setShowModal] = useState(false);
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t('habits.title')}
        </h1>
        <Button size="sm" onClick={() => setShowModal(true)}>
          {t('habits.new')}
        </Button>
      </div>

      <motion.div
        className="flex flex-col gap-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {habits.map((habit) => {
          const habitEntries = weekEntries.filter((e) => e.habitId === habit.id);
          return (
            <motion.div key={habit.id} variants={item}>
              <HabitCard
                habit={habit}
                entries={habitEntries}
                weekDates={weekDates}
                today={today}
                streak={streaks[habit.id] ?? 0}
                onToggle={toggleBooleanHabit}
                onLog={logNumericHabit}
                onDelete={deleteHabit}
              />
            </motion.div>
          );
        })}
      </motion.div>

      {habits.length === 0 && (
        <div className="text-center text-text-muted text-sm py-12">
          {t('habits.empty')}
        </div>
      )}

      <AddHabitModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onAdd={createHabit}
      />
    </div>
  );
}
