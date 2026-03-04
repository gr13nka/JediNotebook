import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { ProcrastinationConfirmModal } from '../ui/ProcrastinationConfirmModal';
import { isProcrastinationRisky, getMatchedWords } from '../../utils/procrastinationCheck';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { EnrichedTodayTask } from '../../hooks/useTodayTasks';

interface TodayTaskCardProps {
  task: EnrichedTodayTask;
  onComplete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onEditTitle: (title: string) => void;
  isFirst: boolean;
  isTaskActive?: boolean;
  countdownDisplay?: string;
  countdownComplete?: boolean;
  isPaused?: boolean;
  onStartTask?: () => void;
  onStopTask?: () => void;
  onPauseTask?: () => void;
  onResumeTask?: () => void;
}

const ChevronUp = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const PlayIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const PauseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

const StopIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

export function TodayTaskCard({
  task, onComplete, onMoveUp, onMoveDown, onEditTitle, isFirst,
  isTaskActive, countdownDisplay, countdownComplete, isPaused: taskPaused,
  onStartTask, onStopTask, onPauseTask, onResumeTask,
}: TodayTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.taskTitle);
  const [showProcrastModal, setShowProcrastModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation();
  const procrastinationWords = useSettingsStore((s) => s.procrastinationWords);
  const dismissedIds = useSettingsStore((s) => s.dismissedProcrastinationTaskIds);
  const updateSettings = useSettingsStore((s) => s.update);

  const dismissKey = task.projectTaskId;
  const isRisky = !task.isCompleted
    && isProcrastinationRisky(task.taskTitle, procrastinationWords)
    && !dismissedIds.includes(dismissKey);
  const matchedWords = isRisky ? getMatchedWords(task.taskTitle, procrastinationWords) : [];

  useEffect(() => {
    setEditValue(task.taskTitle);
  }, [task.taskTitle]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const handleSave = () => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== task.taskTitle) {
      onEditTitle(trimmed);
    } else {
      setEditValue(task.taskTitle);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setEditValue(task.taskTitle);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="rounded-xl bg-bg-card p-3 sm:p-4"
      style={{
        boxShadow: NEU.raised,
        border: isTaskActive
          ? `2px solid ${task.projectColor}80`
          : isFirst && !task.isCompleted
            ? `2px solid ${task.projectColor}4D`
            : task.isCompleted
              ? '2px solid #27AE6040'
              : '2px solid transparent',
      }}
    >
      {/* Top row: project info + reorder + complete */}
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: task.isCompleted ? '#27AE60' : task.projectColor }}
        />
        <span className={`text-xs truncate ${task.isCompleted ? 'text-green' : 'text-text-muted'}`}>
          {task.projectName}
        </span>

        {/* Countdown display for active task */}
        {isTaskActive && countdownDisplay && (
          <span
            className={`text-xs font-mono font-semibold ml-auto ${
              countdownComplete ? 'text-amber-500' : 'text-accent'
            }`}
          >
            {countdownDisplay}
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto shrink-0">
          {/* Move up/down buttons */}
          {!task.isCompleted && !isTaskActive && (onMoveUp || onMoveDown) && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={onMoveUp}
                disabled={!onMoveUp}
                className="p-1 rounded text-text-muted active:text-text-primary disabled:opacity-20 transition-colors"
              >
                <ChevronUp />
              </button>
              <button
                onClick={onMoveDown}
                disabled={!onMoveDown}
                className="p-1 rounded text-text-muted active:text-text-primary disabled:opacity-20 transition-colors"
              >
                <ChevronDown />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Middle row: title */}
      <div className="mb-2">
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="text-sm font-medium w-full bg-transparent text-text-primary focus:outline-none border-none py-0"
            style={isFirst && !task.isCompleted ? { fontSize: '0.9375rem' } : undefined}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              onClick={() => setEditing(true)}
              className={`text-sm font-medium transition-colors duration-200 cursor-text ${
                task.isCompleted ? 'line-through text-green' : 'text-text-primary'
              }`}
              style={isFirst && !task.isCompleted ? { fontSize: '0.9375rem' } : undefined}
            >
              {task.taskTitle}
            </span>
            {isRisky && (
              <button
                onClick={() => setShowProcrastModal(true)}
                title={t('procrastination.matchedWords').replace('{words}', matchedWords.join(', '))}
                className="shrink-0 p-0.5 text-amber-500"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom row: timer controls + complete button */}
      <div className="flex items-center gap-2">
        {/* Timer controls */}
        {isTaskActive ? (
          <div className="flex items-center gap-1.5">
            {taskPaused ? (
              <button
                onClick={onResumeTask}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-accent transition-colors"
                style={{ boxShadow: NEU.raisedSm }}
                title={t('today.resumeTask')}
              >
                <PlayIcon />
              </button>
            ) : (
              <button
                onClick={onPauseTask}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted active:text-text-primary transition-colors"
                style={{ boxShadow: NEU.raisedSm }}
                title={t('today.pauseTask')}
              >
                <PauseIcon />
              </button>
            )}
            <button
              onClick={onStopTask}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-red transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
              title={t('today.stopTask')}
            >
              <StopIcon />
            </button>
          </div>
        ) : !task.isCompleted && onStartTask ? (
          <button
            onClick={onStartTask}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-text-muted active:text-accent transition-colors"
            style={{ boxShadow: NEU.raisedSm }}
            title={t('today.startTask')}
          >
            <PlayIcon />
          </button>
        ) : null}

        <button
          onClick={onComplete}
          className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ml-auto"
          style={{
            boxShadow: task.isCompleted ? NEU.pressedSm : NEU.raisedSm,
            backgroundColor: task.isCompleted ? '#27AE60' : undefined,
          }}
        >
          {task.isCompleted ? (
            <motion.svg
              width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              <polyline points="20 6 9 17 4 12" />
            </motion.svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted"
            >
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
        </button>
      </div>
      <ProcrastinationConfirmModal
        open={showProcrastModal}
        onClose={() => setShowProcrastModal(false)}
        onConfirm={() => {
          updateSettings({ dismissedProcrastinationTaskIds: [...dismissedIds, dismissKey] });
          setShowProcrastModal(false);
        }}
      />
    </motion.div>
  );
}
