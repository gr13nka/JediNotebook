import React, { useMemo, useState, useCallback } from 'react';
import type { ProjectTask } from '@shared/types';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';
import { isProcrastinationRisky, getMatchedWords } from '../../utils/procrastinationCheck';
import { ProcrastinationConfirmModal } from '../ui/ProcrastinationConfirmModal';
import { ContextMenu } from '../ui/ContextMenu';

interface SelectableTaskRowProps {
  task: ProjectTask;
  onToggleToday: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  isInToday: boolean;
  draggable: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  isDragOver?: 'above' | 'below' | null;
  projectInfo?: { name: string; color: string; icon?: string };
}

function getTaskScore(createdAt: string): number {
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

function getScoreColor(score: number, fixed: boolean): string {
  if (fixed) return 'text-text-muted';
  if (score < 9) return 'text-green-500';
  if (score < 49) return 'text-amber-500';
  return 'text-red-500';
}

export function SelectableTaskRow({
  task,
  onToggleToday,
  onToggleComplete,
  onDelete,
  isInToday,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver,
  projectInfo,
}: SelectableTaskRowProps) {
  const isCompleted = task.isCompleted;
  const pointsVisible = useSettingsStore((s) => s.pointsCounterVisible);
  const colorFixed = useSettingsStore((s) => s.pointsColorFixed);
  const procrastinationWords = useSettingsStore((s) => s.procrastinationWords);
  const dismissedIds = useSettingsStore((s) => s.dismissedProcrastinationTaskIds);
  const updateSettings = useSettingsStore((s) => s.update);
  const { t } = useTranslation();

  const score = useMemo(() => getTaskScore(task.createdAt), [task.createdAt]);

  const isRisky = !isCompleted
    && isProcrastinationRisky(task.title, procrastinationWords)
    && !dismissedIds.includes(task.id);
  const matchedWords = isRisky ? getMatchedWords(task.title, procrastinationWords) : [];

  const [showProcrastModal, setShowProcrastModal] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const contextMenuItems = useMemo(() => [
    { label: t('common.delete'), onClick: onDelete, danger: true },
  ], [t, onDelete]);

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
            <span className={`block text-[15px] leading-snug truncate ${
              isCompleted
                ? 'line-through text-text-muted'
                : isInToday
                  ? 'text-text-primary'
                  : 'text-text-secondary'
            }`}>
              {task.title}
            </span>
          </div>

          {/* Procrastination warning */}
          {isRisky && (
            <button
              onClick={() => setShowProcrastModal(true)}
              title={t('procrastination.matchedWords').replace('{words}', matchedWords.join(', '))}
              className="flex-shrink-0 p-0.5 text-amber-500"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
            </button>
          )}

          {/* Per-task score */}
          {pointsVisible && !isCompleted && score > 0 && (
            <span className={`flex-shrink-0 text-xs font-medium tabular-nums ${getScoreColor(score, colorFixed)}`}>
              {score}
            </span>
          )}

          {/* Add to today button */}
          {!isCompleted && (
            <button
              onClick={onToggleToday}
              className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full transition-colors ${
                isInToday
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-accent hover:bg-accent/10'
              }`}
            >
              {isInToday ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              )}
            </button>
          )}
        </div>
        {isDragOver === 'below' && (
          <div className="absolute -bottom-[2px] left-8 right-3 h-[2px] rounded-full bg-accent z-10" />
        )}

        <ContextMenu items={contextMenuItems} position={ctxMenu} onClose={closeCtxMenu} />
      </div>

      <ProcrastinationConfirmModal
        open={showProcrastModal}
        onClose={() => setShowProcrastModal(false)}
        onConfirm={() => {
          updateSettings({ dismissedProcrastinationTaskIds: [...dismissedIds, task.id] });
          setShowProcrastModal(false);
        }}
      />
    </>
  );
}
