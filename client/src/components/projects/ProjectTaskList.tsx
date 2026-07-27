import React, { useState } from 'react';
import { NEU } from '../../utils/shadows';
import { useProjectTasks } from '../../hooks/useProjectTasks';
import { useReorderList } from '../../hooks/useReorderList';
import { useSettingsStore } from '../../stores/settingsStore';
import { useProjectUIStore } from '../../stores/projectUIStore';
import { useTranslation } from '../../i18n/useTranslation';
import { normalizeTaskText } from '../../utils/taskText';
import { InfoTooltip } from '../ui/InfoTooltip';
import { TaskTextArea } from '../ui/TaskTextArea';
import { TaskItem } from './TaskItem';
import { RecurrenceEditor } from './RecurrenceEditor';
import { readPayload, hasPayload, isCopyModifier, setTaskPayload } from '../../utils/taskDnd';
import type { ProjectTask, RecurrenceRule } from '@shared/types';

interface ProjectTaskListProps {
  projectId: string;
  /** Removes [start, end) from the description after text becomes a task. */
  onCutDescriptionRange?: (start: number, end: number) => void;
}

export function ProjectTaskList({ projectId, onCutDescriptionRange }: ProjectTaskListProps) {
  const { t } = useTranslation();
  const { tasks, createTask, updateTask, toggleTask, deleteTask, reorderTasks, updateRecurrence } = useProjectTasks(projectId);
  const maxTasks = useSettingsStore((s) => s.maxTasksPerProject);
  // Draft lives in the store, not local state: this subtree is keyed by project
  // id in ProjectsView, so switching project or route would otherwise discard
  // whatever the user had typed.
  const newTitle = useProjectUIStore((s) => s.taskDrafts[projectId] ?? '');
  const setTaskDraft = useProjectUIStore((s) => s.setTaskDraft);
  const clearTaskDraft = useProjectUIStore((s) => s.clearTaskDraft);
  const setNewTitle = (text: string) => setTaskDraft(projectId, text);
  const [newTaskRule, setNewTaskRule] = useState<RecurrenceRule | null>(null);
  const [showNewRecurrence, setShowNewRecurrence] = useState(false);

  const incompleteTasks = tasks.filter((t) => !t.isCompleted);
  const completedTasks = tasks.filter((t) => t.isCompleted);
  const canAdd = incompleteTasks.length < maxTasks;

  const handleAdd = async () => {
    const title = normalizeTaskText(newTitle);
    if (!title || !canAdd) return;
    await createTask(title, newTaskRule);
    clearTaskDraft(projectId);
    setNewTaskRule(null);
    setShowNewRecurrence(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  // Also advertise the task payload on dragstart so the description editor can
  // accept it. setTaskPayload owns effectAllowed ('copyMove') — it has to
  // permit both this list's 'move' reorder and the editor's 'copy' drop.
  const reorder = useReorderList({
    items: incompleteTasks,
    getId: (t: ProjectTask) => t.id,
    onReorder: (ids) => reorderTasks([...ids, ...completedTasks.map((t) => t.id)]),
    onDragStart: (task, _index, e) => setTaskPayload(e, task.id, task.title),
  });

  const [isTextDropTarget, setIsTextDropTarget] = useState(false);

  const handleTextDragOver = (e: React.DragEvent) => {
    if (!hasPayload(e, 'text') || !canAdd) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsTextDropTarget(true);
  };

  const handleTextDragLeave = () => setIsTextDropTarget(false);

  const handleTextDrop = async (e: React.DragEvent) => {
    setIsTextDropTarget(false);
    const payload = readPayload(e);
    if (!payload || payload.kind !== 'text' || !canAdd) return;
    e.preventDefault();

    // One task per non-empty line, so dragging a multi-line block unloads the
    // whole block rather than creating one task with embedded newlines.
    const lines = payload.text
      .split('\n')
      .map((l) => l.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    for (const line of lines) {
      await createTask(line, null);
    }
    if (!isCopyModifier(e)) {
      onCutDescriptionRange?.(payload.start, payload.end);
    }
  };

  return (
    <div
      className={`flex flex-col rounded-xl transition-shadow ${
        isTextDropTarget ? 'ring-2 ring-accent' : ''
      }`}
      onDragOver={handleTextDragOver}
      onDragLeave={handleTextDragLeave}
      onDrop={handleTextDrop}
    >
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {t('projectTasks.title')}
        </h3>
        <span className="text-xs text-text-muted tabular-nums">
          {incompleteTasks.length}
        </span>
        <InfoTooltip text={t('projectTasks.tooltip')} />
      </div>

      <div className="flex flex-col gap-0.5" onDragEnd={reorder.handleDragEnd}>
        {incompleteTasks.map((task, i) => (
          <TaskItem
            key={task.id}
            task={task}
            onToggle={() => toggleTask(task.id)}
            onDelete={() => deleteTask(task.id)}
            onRename={(title) => updateTask(task.id, { title })}
            onUpdateRecurrence={(rule) => updateRecurrence(task.id, rule)}
            {...reorder.getRowProps(i)}
          />
        ))}
      </div>

      {canAdd && (
        <>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
            <TaskTextArea
              value={newTitle}
              onValueChange={setNewTitle}
              onCommit={handleAdd}
              onKeyDown={handleKeyDown}
              placeholder={t('projectTasks.addPlaceholder')}
              className="min-h-8 flex-1 rounded-lg px-3 py-1.5 text-sm leading-5 text-text-primary placeholder:text-text-muted/40"
              style={{ boxShadow: NEU.pressedSm }}
            />
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
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
                disabled={!normalizeTaskText(newTitle)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-lg text-text-primary disabled:opacity-40 transition-colors"
                style={{ boxShadow: NEU.raisedSm }}
              >
                +
              </button>
            </div>
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
