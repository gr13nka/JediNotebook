import React, { useMemo, useState, useCallback } from 'react';
import type { ProjectTask, TimeBox } from '@shared/types';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';
import type { TranslationKey } from '../../i18n/translations';
import { ContextMenu } from '../ui/ContextMenu';
import { InlineTextEdit } from '../ui/InlineTextEdit';

/** Canonical box order; each row offers the two entries that aren't its current box. */
const MOVE_TARGETS: TimeBox[] = ['today', 'week', 'later'];
const MOVE_LABEL_KEYS: Record<TimeBox, TranslationKey> = {
  today: 'taskSelection.toToday',
  week: 'taskSelection.toWeek',
  later: 'taskSelection.toLater',
};

interface SelectableTaskRowProps {
  task: ProjectTask;
  /** Moves the task to any box; the row offers the two boxes it is not currently in. */
  onMoveToBox: (taskId: string, target: TimeBox) => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  onRename?: (title: string) => void;
  draggable: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: 'above' | 'below' | null;
  projectInfo?: { name: string; color: string; icon?: string };
}

function getStalenessScore(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / 86400000;
  return Math.round(ageDays * ageDays);
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

function getStalenessColor(score: number, fixed: boolean): string {
  if (fixed) return 'text-text-muted';
  if (score < 9) return 'text-green-500';
  if (score < 49) return 'text-amber-500';
  return 'text-red-500';
}

export function SelectableTaskRow({
  task,
  onMoveToBox,
  onToggleComplete,
  onDelete,
  onRename,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  projectInfo,
}: SelectableTaskRowProps) {
  const isCompleted = task.isCompleted;
  const isInToday = task.timeBox === 'today';
  const stalenessVisible = useSettingsStore((s) => s.pointsCounterVisible);
  const colorFixed = useSettingsStore((s) => s.pointsColorFixed);
  const { t } = useTranslation();

  const score = useMemo(() => getStalenessScore(task.createdAt), [task.createdAt]);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState(false);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const contextMenuItems = useMemo(() => {
    const items: { label: string; onClick: () => void; danger?: boolean }[] = [];
    if (onRename) {
      items.push({ label: t('common.rename'), onClick: () => setRenaming(true) });
    }
    items.push({ label: t('common.delete'), onClick: onDelete, danger: true });
    return items;
  }, [t, onDelete, onRename]);

  return (
    <>
      <div className="relative">
        {isDragOver === 'above' && (
          <div className="absolute -top-[2px] left-8 right-3 h-[2px] rounded-full bg-accent z-10" />
        )}
        <div
          className={`flex items-center gap-3 py-3 px-2 rounded-lg transition-colors ${
            isCompleted
              ? 'opacity-50'
              : isInToday
                ? 'bg-bg-elevated/50'
                : 'hover:bg-bg-elevated/30'
          }`}
          draggable={draggable}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onContextMenu={handleContextMenu}
        >
          {/* Drag handle */}
          {draggable && !isCompleted && (
            <span className="cursor-grab active:cursor-grabbing select-none flex-shrink-0 opacity-40 hover:opacity-100 transition-opacity">
              <DragDotsIcon />
            </span>
          )}

          {/* Complete checkbox */}
          <button
            onClick={onToggleComplete}
            className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-[5px] border-2 transition-colors hover:border-green hover:bg-green/10"
            style={{
              borderColor: isCompleted ? 'var(--color-green)' : 'var(--color-text-muted)',
              backgroundColor: isCompleted ? 'var(--color-green)' : 'transparent',
            }}
          >
            {isCompleted && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          {/* Task name + project info */}
          <div className="flex-1 min-w-0">
            {projectInfo && (
              <div className="flex items-center gap-1.5 mb-0.5">
                {projectInfo.icon ? (
                  <span className="text-[12px] flex-shrink-0 leading-none">{projectInfo.icon}</span>
                ) : (
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: projectInfo.color }} />
                )}
                <span className="text-[11px] text-text-muted truncate">{projectInfo.name}</span>
              </div>
            )}
            {renaming && onRename ? (
              <InlineTextEdit
                value={task.title}
                editing={renaming}
                onCommit={(title) => { onRename(title); setRenaming(false); }}
                onCancel={() => setRenaming(false)}
                className="block text-[15px] leading-snug text-text-primary"
              />
            ) : (
              <span
                onDoubleClick={() => onRename && setRenaming(true)}
                className={`block text-[15px] leading-snug ${
                  isCompleted
                    ? 'line-through text-text-muted'
                    : isInToday
                      ? 'text-text-primary'
                      : 'text-text-secondary'
                }`}
              >
                {task.title}
              </span>
            )}
          </div>

          {/* Per-task score */}
          {stalenessVisible && !isCompleted && score > 0 && (
            <span className={`flex-shrink-0 text-xs font-medium tabular-nums ${getStalenessColor(score, colorFixed)}`}>
              {score}
            </span>
          )}

          {/* Quick-move buttons: the two boxes this task is not currently in */}
          {!isCompleted && (
            <div className="flex-shrink-0 flex items-center gap-1">
              {MOVE_TARGETS.filter((target) => target !== task.timeBox).map((target) => (
                <button
                  key={target}
                  onClick={() => onMoveToBox(task.id, target)}
                  className="flex items-center justify-center h-6 px-2 rounded-full text-[11px] font-medium whitespace-nowrap text-text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                >
                  {t(MOVE_LABEL_KEYS[target])}
                </button>
              ))}
            </div>
          )}
        </div>
        {isDragOver === 'below' && (
          <div className="absolute -bottom-[2px] left-8 right-3 h-[2px] rounded-full bg-accent z-10" />
        )}

        <ContextMenu items={contextMenuItems} position={ctxMenu} onClose={closeCtxMenu} />
      </div>
    </>
  );
}
