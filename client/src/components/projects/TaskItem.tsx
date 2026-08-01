import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { normalizeTaskText } from '../../utils/taskText';
import { RecurrenceEditor } from './RecurrenceEditor';
import { CompletionBurst, useCompletionBurst } from '../ui/CompletionBurst';
import { TaskTextArea } from '../ui/TaskTextArea';
import type { ProjectTask, RecurrenceRule } from '@shared/types';

interface TaskItemProps {
  task: ProjectTask;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onUpdateRecurrence?: (rule: RecurrenceRule | null) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: 'above' | 'below' | null;
}

const DragDotsIcon = () => (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-text-muted">
    <circle cx="5" cy="3" r="1.2" />
    <circle cx="11" cy="3" r="1.2" />
    <circle cx="5" cy="8" r="1.2" />
    <circle cx="11" cy="8" r="1.2" />
    <circle cx="5" cy="13" r="1.2" />
    <circle cx="11" cy="13" r="1.2" />
  </svg>
);

const RecurringIcon = ({ active }: { active: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={`shrink-0 ${active ? 'text-accent' : 'text-text-muted'}`}
  >
    <polyline points="1 4 1 10 7 10" />
    <polyline points="23 20 23 14 17 14" />
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
  </svg>
);

export function TaskItem({ task, onToggle, onDelete, onRename, onUpdateRecurrence, draggable, onDragStart, onDragOver, onDrop, isDragOver }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [burst, fireBurst] = useCompletionBurst();

  useEffect(() => {
    if (!editing) setEditValue(task.title);
  }, [editing, task.title]);

  // Celebrate only the incomplete -> complete direction of the toggle.
  const handleToggle = () => {
    if (!task.isCompleted) fireBurst();
    onToggle();
  };

  const startEditing = () => {
    if (task.isCompleted) return;
    setEditValue(task.title);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditValue(task.title);
    setEditing(false);
  };

  const commitEditing = () => {
    const trimmed = normalizeTaskText(editValue);
    if (trimmed && trimmed !== task.title) onRename(trimmed);
    setEditValue(trimmed || task.title);
    setEditing(false);
  };

  return (
    <>
    <div className="relative">
      {isDragOver === 'above' && (
        <div className="absolute -top-[2px] left-2 right-2 h-[2px] rounded-full bg-accent z-10" />
      )}
      <div
        className="group/task flex items-start gap-1.5 py-1.5"
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* Drag handle */}
        {draggable && !task.isCompleted && (
          <span className="cursor-grab active:cursor-grabbing select-none shrink-0 opacity-40 hover:opacity-100 transition-opacity">
            <DragDotsIcon />
          </span>
        )}

        <button
          onClick={handleToggle}
          className="relative w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all duration-200"
          style={{
            boxShadow: task.isCompleted ? NEU.pressedSm : NEU.raisedSm,
            backgroundColor: task.isCompleted ? '#27AE60' : undefined,
          }}
        >
          <CompletionBurst burst={burst} />
          {task.isCompleted && (
            <motion.svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              <polyline points="20 6 9 17 4 12" />
            </motion.svg>
          )}
        </button>
        {editing ? (
          <div className="min-w-0 flex-1">
            <TaskTextArea
              value={editValue}
              onValueChange={setEditValue}
              onCommit={commitEditing}
              onCancel={cancelEditing}
              onBlur={commitEditing}
              focusOnMount
              className="text-sm text-text-primary py-0 leading-snug"
            />
          </div>
        ) : (
          <span
            onClick={startEditing}
            className={`min-w-0 flex-1 text-sm leading-snug transition-colors duration-200 break-words [overflow-wrap:anywhere] ${
              task.isCompleted
                ? 'line-through text-green cursor-default'
                : 'text-text-primary cursor-text'
            }`}
          >
            {task.title}
          </span>
        )}
        {!editing && onUpdateRecurrence && (
          <button
            onClick={() => setShowRecurrence(!showRecurrence)}
            className="p-0.5 transition-opacity can-hover:opacity-0 can-hover:group-hover/task:opacity-100 focus-visible:opacity-100"
          >
            <RecurringIcon active={!!task.recurrenceRule} />
          </button>
        )}
        {!editing && (
          <button
            onClick={onDelete}
            className="text-text-muted hover:text-red text-xs px-1 transition-opacity can-hover:opacity-0 can-hover:group-hover/task:opacity-100 focus-visible:opacity-100"
          >
            &times;
          </button>
        )}
      </div>
      {isDragOver === 'below' && (
        <div className="absolute -bottom-[2px] left-2 right-2 h-[2px] rounded-full bg-accent z-10" />
      )}
    </div>
    {showRecurrence && onUpdateRecurrence && (
      <RecurrenceEditor
        rule={task.recurrenceRule}
        onChange={onUpdateRecurrence}
      />
    )}
  </>
  );
}
