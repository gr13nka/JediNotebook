import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { RecurrenceEditor } from './RecurrenceEditor';
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(task.title);
  }, [task.title]);

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
    if (trimmed && trimmed !== task.title) {
      onRename(trimmed);
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
    <>
    <div className="relative">
      {isDragOver === 'above' && (
        <div className="absolute -top-[2px] left-2 right-2 h-[2px] rounded-full bg-accent z-10" />
      )}
      <div
        className="flex items-center gap-1.5 py-1.5"
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
          onClick={onToggle}
          className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all duration-200"
          style={{
            boxShadow: task.isCompleted ? NEU.pressedSm : NEU.raisedSm,
            backgroundColor: task.isCompleted ? '#27AE60' : undefined,
          }}
        >
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
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm bg-transparent text-text-primary focus:outline-none border-none py-0"
          />
        ) : (
          <span
            onClick={() => !task.isCompleted && setEditing(true)}
            className={`flex-1 text-sm transition-colors duration-200 ${
              task.isCompleted
                ? 'line-through text-green cursor-default'
                : 'text-text-primary cursor-text'
            }`}
          >
            {task.title}
          </span>
        )}
        {onUpdateRecurrence && (
          <button
            onClick={() => setShowRecurrence(!showRecurrence)}
            className="p-0.5 transition-colors"
          >
            <RecurringIcon active={!!task.recurrenceRule} />
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-text-muted hover:text-red text-xs px-1 transition-colors"
        >
          &times;
        </button>
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
