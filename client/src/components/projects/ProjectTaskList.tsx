import React, { useState, useRef } from 'react';
import { NEU } from '../../utils/shadows';
import { useProjectTasks } from '../../hooks/useProjectTasks';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';
import { InfoTooltip } from '../ui/InfoTooltip';
import { TaskItem } from './TaskItem';
import { RecurrenceEditor } from './RecurrenceEditor';
import type { RecurrenceRule } from '@shared/types';

interface ProjectTaskListProps {
  projectId: string;
}

export function ProjectTaskList({ projectId }: ProjectTaskListProps) {
  const { t } = useTranslation();
  const { tasks, createTask, updateTask, toggleTask, deleteTask, reorderTasks, updateRecurrence } = useProjectTasks(projectId);
  const maxTasks = useSettingsStore((s) => s.maxTasksPerProject);
  const [newTitle, setNewTitle] = useState('');
  const [newTaskRule, setNewTaskRule] = useState<RecurrenceRule | null>(null);
  const [showNewRecurrence, setShowNewRecurrence] = useState(false);

  const incompleteTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);
  const canAdd = incompleteTasks.length < maxTasks;

  const handleAdd = async () => {
    if (!newTitle.trim() || !canAdd) return;
    await createTask(newTitle.trim(), newTaskRule);
    setNewTitle('');
    setNewTaskRule(null);
    setShowNewRecurrence(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const dragIdx = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'above' | 'below' } | null>(null);

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragIdx.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx.current === null || dragIdx.current === index) {
      setDropTarget(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const position = e.clientY < midY ? 'above' : 'below';
    setDropTarget({ index, position });
  };

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === index) {
      dragIdx.current = null;
      setDropTarget(null);
      return;
    }
    const ids = incompleteTasks.map((t) => t.id);
    const [moved] = ids.splice(from, 1);
    const targetIdx = from < index ? index : index;
    const insertAt = dropTarget?.position === 'below' ? targetIdx + (from < index ? 0 : 1) : targetIdx - (from < index ? 1 : 0);
    ids.splice(Math.max(0, insertAt), 0, moved);
    const completedIds = completedTasks.map((t) => t.id);
    reorderTasks([...ids, ...completedIds]);
    dragIdx.current = null;
    setDropTarget(null);
  };

  const handleDragEnd = () => {
    setDropTarget(null);
    dragIdx.current = null;
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t('projectTasks.title')}
        </h3>
        <span className="text-xs text-text-muted">
          {incompleteTasks.length}/{maxTasks}
        </span>
        <InfoTooltip text={t('projectTasks.tooltip')} />
      </div>

      <div className="flex flex-col gap-0.5" onDragEnd={handleDragEnd}>
        {incompleteTasks.map((task, i) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={() => toggleTask(task.id)}
            onDelete={() => deleteTask(task.id)}
            onRename={(title) => updateTask(task.id, { title })}
            onUpdateRecurrence={(rule) => updateRecurrence(task.id, rule)}
            draggable
            onDragStart={handleDragStart(i)}
            onDragOver={handleDragOver(i)}
            onDrop={handleDrop(i)}
            isDragOver={dropTarget?.index === i ? dropTarget.position : null}
          />
        ))}
      </div>

      {canAdd && (
        <>
          <div className="flex gap-2 mt-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('projectTasks.addPlaceholder')}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted/40 focus:outline-none rounded-lg px-3 py-1.5"
              style={{ boxShadow: NEU.pressedSm }}
            />
            <button
              onClick={() => setShowNewRecurrence(!showNewRecurrence)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ boxShadow: newTaskRule ? NEU.pressedSm : NEU.raisedSm }}
              title={t('recurrence.repeat')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={newTaskRule ? 'text-accent' : 'text-text-muted'}
              >
                <polyline points="1 4 1 10 7 10" />
                <polyline points="23 20 23 14 17 14" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            </button>
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim()}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-lg text-text-primary disabled:opacity-40 transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
            >
              +
            </button>
          </div>
          {showNewRecurrence && (
            <RecurrenceEditor rule={newTaskRule} onChange={setNewTaskRule} />
          )}
        </>
      )}

      {completedTasks.length > 0 && (
        <div className="mt-4 pt-3 border-t border-text-muted/10">
          <span className="text-[10px] uppercase tracking-wider text-text-muted/60 mb-1 block">
            {t('projectTasks.completed')}
          </span>
          {completedTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={() => toggleTask(task.id)}
              onDelete={() => deleteTask(task.id)}
              onRename={(title) => updateTask(task.id, { title })}
              onUpdateRecurrence={(rule) => updateRecurrence(task.id, rule)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
