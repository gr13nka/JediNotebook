import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TimerDisplay } from '../components/timer/TimerDisplay';
import { TodayTaskCard } from '../components/today/TodayTaskCard';
import { useTaskBox } from '../hooks/useTaskBox';
import { db } from '../db';
import { updateRecord } from '../db/repository';
import { useTranslation } from '../i18n/useTranslation';
import { NEU } from '../utils/shadows';
import { useSettingsStore } from '../stores/settingsStore';

const EyeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const FocusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

export function TodayPage() {
  const { t } = useTranslation();
  const timeTrackingVisible = useSettingsStore((s) => s.timeTrackingVisible);
  const { tasks: todayTasks, toggleComplete, reorderBox } = useTaskBox('today');
  // Title editing isn't part of useTaskBox's contract (it's a plain field
  // edit, not a box operation) — same inline-repository pattern Task
  // Selection's row rename already uses.
  const updateTaskTitle = (taskId: string, title: string) =>
    updateRecord(db.projectTasks, taskId, { title });
  const [hideCompleted, setHideCompleted] = useState(false);
  const [focusMode, setFocusMode] = useState(false);

  // Android back button / browser back exits focus mode
  useEffect(() => {
    if (!focusMode) return;
    // Push a dummy history entry so "back" pops it instead of leaving the page
    window.history.pushState({ focusMode: true }, '');
    const handlePop = () => setFocusMode(false);
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
    };
  }, [focusMode]);

  const incompleteTasks = todayTasks.filter((t) => !t.isCompleted);
  const completedTasks = todayTasks.filter((t) => t.isCompleted);
  const allDone = todayTasks.length > 0 && incompleteTasks.length === 0;

  const handleMoveUp = useCallback((taskId: string) => {
    const idx = incompleteTasks.findIndex((t) => t.id === taskId);
    if (idx <= 0) return;
    const ids = incompleteTasks.map((t) => t.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    // Append completed task ids to preserve their order
    const completedIds = completedTasks.map((t) => t.id);
    reorderBox([...ids, ...completedIds]);
  }, [incompleteTasks, completedTasks, reorderBox]);

  const handleMoveDown = useCallback((taskId: string) => {
    const idx = incompleteTasks.findIndex((t) => t.id === taskId);
    if (idx < 0 || idx >= incompleteTasks.length - 1) return;
    const ids = incompleteTasks.map((t) => t.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    const completedIds = completedTasks.map((t) => t.id);
    reorderBox([...ids, ...completedIds]);
  }, [incompleteTasks, completedTasks, reorderBox]);

  const handleComplete = useCallback((taskId: string) => {
    toggleComplete(taskId);
  }, [toggleComplete]);

  const renderTaskCard = (task: typeof todayTasks[0], i: number, list: typeof todayTasks) => (
    <TodayTaskCard
      key={task.id}
      task={task}
      onComplete={() => handleComplete(task.id)}
      onMoveUp={!task.isCompleted && i > 0 ? () => handleMoveUp(task.id) : undefined}
      onMoveDown={!task.isCompleted && i < list.length - 1 ? () => handleMoveDown(task.id) : undefined}
      onEditTitle={(title) => updateTaskTitle(task.id, title)}
      isFirst={i === 0}
    />
  );

  // Normal mode: renders in-flow inside AppShell (sidebar visible)
  // Focus mode: fixed full-screen overlay on top of everything
  return (
    <>
      {/* Focus mode full-screen overlay */}
      <AnimatePresence>
        {focusMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-bg-primary flex flex-col"
          >
            {/* Vignette overlay */}
            <div
              className="fixed inset-0 pointer-events-none z-[51]"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)',
              }}
            />

            {/* Top bar with exit button — safe area aware */}
            <div
              className="shrink-0 flex items-center justify-between px-4 z-[53]"
              style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
            >
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                onClick={() => setFocusMode(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-card text-text-secondary active:text-text-primary transition-colors"
                style={{ boxShadow: NEU.raisedSm }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span className="text-sm font-medium">{t('today.exitFocus')}</span>
              </motion.button>
            </div>

            {/* Centered incomplete tasks only — safe area bottom */}
            <div
              className="flex-1 overflow-auto px-4 py-4 max-w-2xl mx-auto w-full relative z-[52] flex flex-col justify-center"
              style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex flex-col gap-3">
                <AnimatePresence mode="popLayout">
                  {incompleteTasks.map((task, i) => renderTaskCard(task, i, incompleteTasks))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Normal mode content (rendered in-flow inside AppShell) */}
      <div>
        {/* Top bar */}
        <div
          className="flex items-center gap-3 mb-4"
        >
          <h1 className="text-lg font-bold text-text-primary">{t('today.title')}</h1>
          <button
            onClick={() => setFocusMode(true)}
            className="ml-auto p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
            style={{ boxShadow: NEU.raisedSm }}
            title={t('today.focusMode')}
          >
            <FocusIcon />
          </button>
        </div>

        {timeTrackingVisible && <TimerDisplay />}

        {/* All done celebration */}
        <AnimatePresence>
          {allDone && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="text-center py-8"
            >
              <p className="text-2xl font-bold text-accent mb-1">{t('today.allDone')}</p>
              <p className="text-sm text-text-muted">
                {t('today.allDoneDesc')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Incomplete tasks */}
        <div className="flex flex-col gap-3 mb-6">
          <AnimatePresence mode="popLayout">
            {incompleteTasks.map((task, i) => renderTaskCard(task, i, incompleteTasks))}
          </AnimatePresence>
        </div>

        {/* Completed tasks section */}
        {completedTasks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
                {t('today.completed')} ({completedTasks.length})
              </p>
              <button
                onClick={() => setHideCompleted(!hideCompleted)}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors ml-auto px-3 py-1 rounded-lg"
                style={{ boxShadow: NEU.raisedSm }}
              >
                {hideCompleted ? <EyeIcon /> : <EyeOffIcon />}
                {hideCompleted ? t('today.showCompleted') : t('today.hideCompleted')}
              </button>
            </div>
            <AnimatePresence initial={false}>
              {!hideCompleted && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="flex flex-col gap-3">
                    <AnimatePresence mode="popLayout">
                      {completedTasks.map((task) => (
                        <TodayTaskCard
                          key={task.id}
                          task={task}
                          onComplete={() => handleComplete(task.id)}
                          onEditTitle={(title) => updateTaskTitle(task.id, title)}
                          isFirst={false}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Empty state */}
        {todayTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-text-muted">
              {t('today.empty')}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
