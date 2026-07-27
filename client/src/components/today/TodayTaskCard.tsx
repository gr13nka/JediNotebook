import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { normalizeTaskText } from '../../utils/taskText';
import { CompletionBurst, useCompletionBurst } from '../ui/CompletionBurst';
import { TaskTextArea } from '../ui/TaskTextArea';
import type { EnrichedBoxTask } from '../../hooks/useTaskBox';
import type { TodayCardReorderProps } from '../../hooks/useTodayCardReorder';

interface TodayTaskCardProps {
  task: EnrichedBoxTask;
  onComplete: () => void;
  onEditTitle: (title: string) => void;
  isFirst: boolean;
  reorder?: TodayCardReorderProps;
}

export function TodayTaskCard({
  task, onComplete, onEditTitle, isFirst, reorder,
}: TodayTaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [burst, fireBurst] = useCompletionBurst();

  // `onComplete` is a toggle, so the celebration is gated on the direction of
  // this particular click — un-ticking a task is not an achievement.
  const handleComplete = () => {
    if (!task.isCompleted) fireBurst();
    onComplete();
  };

  useEffect(() => {
    setEditValue(task.title);
  }, [task.title]);

  const handleSave = () => {
    setEditing(false);
    const trimmed = normalizeTaskText(editValue);
    if (trimmed && trimmed !== task.title) {
      onEditTitle(trimmed);
      setEditValue(trimmed);
    } else {
      setEditValue(task.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditing(false);
      setEditValue(task.title);
    }
  };

  return (
    <motion.div
      ref={reorder?.setDragNode}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, scale: reorder?.isDragging ? 1.02 : editing ? 1.015 : 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={reorder?.isDragging ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
      className={`rounded-xl bg-bg-card p-3 sm:p-4 ${
        reorder ? (reorder.isDragging ? 'cursor-grabbing select-none' : 'cursor-grab') : ''
      }`}
      onClick={() => setEditing(true)}
      onPointerDown={reorder?.onPointerDown}
      onPointerMove={reorder?.onPointerMove}
      onPointerUp={reorder?.onPointerUp}
      onPointerCancel={reorder?.onPointerCancel}
      onClickCapture={reorder?.onClickCapture}
      style={{
        boxShadow: editing || reorder?.isDragging
          ? `${NEU.raised}, 0 12px 26px rgba(31, 41, 55, 0.14)`
          : NEU.raised,
        y: reorder?.dragY ?? 0,
        zIndex: reorder?.isDragging ? 20 : editing ? 10 : undefined,
        position: reorder?.isDragging || editing ? 'relative' : undefined,
        touchAction: reorder ? 'pan-y' : undefined,
        border: isFirst && !task.isCompleted
          ? `2px solid ${task.projectColor}4D`
          : task.isCompleted
            ? '2px solid #27AE6040'
            : '2px solid transparent',
      }}
    >
      {/* Top row: project info + reorder + complete */}
      <div className="flex items-center gap-2 mb-1.5">
        {task.projectIcon && !task.isCompleted ? (
          <span className="text-[12px] shrink-0 leading-none">{task.projectIcon}</span>
        ) : (
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: task.isCompleted ? '#27AE60' : task.projectColor }}
          />
        )}
        <span className={`text-xs truncate ${task.isCompleted ? 'text-green' : 'text-text-muted'}`}>
          {task.projectName}
        </span>
      </div>

      {/* Task row: complete + title */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-no-card-drag="true"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleComplete();
          }}
          className="relative -ml-1 shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{
            boxShadow: task.isCompleted ? NEU.pressedSm : NEU.raisedSm,
            backgroundColor: task.isCompleted ? '#27AE60' : undefined,
          }}
        >
          <CompletionBurst burst={burst} />
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
        {editing ? (
          <TaskTextArea
            data-no-card-drag="true"
            value={editValue}
            onValueChange={setEditValue}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            focusOnMount
            className="text-sm font-medium text-text-primary border-none py-0 leading-snug"
            style={isFirst && !task.isCompleted ? { fontSize: '0.9375rem' } : undefined}
          />
        ) : (
          <span
            className={`min-w-0 flex-1 text-sm font-medium leading-snug transition-colors duration-200 cursor-text break-words [overflow-wrap:anywhere] ${
              task.isCompleted ? 'line-through text-green' : 'text-text-primary'
            }`}
            style={isFirst && !task.isCompleted ? { fontSize: '0.9375rem' } : undefined}
          >
            {task.title}
          </span>
        )}
      </div>
    </motion.div>
  );
}
