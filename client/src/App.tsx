import React, { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './pages/HomePage';
import { HabitsPage } from './pages/HabitsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { NotesPage } from './pages/NotesPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { TaskSelectionPage } from './pages/TaskSelectionPage';
import { TodayPage } from './pages/TodayPage';
import { useSettingsStore } from './stores/settingsStore';
import { useRecurringTaskCheck } from './hooks/useRecurringTaskCheck';

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load);
  const location = useLocation();

  useEffect(() => {
    loadSettings();
  }, []);

  useRecurringTaskCheck();

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Routes location={location}>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/tasks" element={<TaskSelectionPage />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
