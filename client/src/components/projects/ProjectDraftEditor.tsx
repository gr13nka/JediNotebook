import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NEU } from '../../utils/shadows';
import { renderLineMd } from '../../utils/markdown';
import { useTranslation } from '../../i18n/useTranslation';
import { EditProjectModal } from './EditProjectModal';
import {
  setTextPayload,
  readPayload,
  hasPayload,
  caretOffsetFromPoint,
  cutRange,
  insertLine,
} from '../../utils/taskDnd';
import type { Activity } from '@shared/types';

interface ProjectDraftEditorProps {
  title: string;
  description: string;
  color: string;
  icon?: string;
  onSaveProject: (data: { name: string; color: string; icon: string }) => void;
  onSave: (description: string) => void;
  linkedActivityId?: string | null;
  onLinkActivity?: (activityId: string | null) => void;
  activities?: Activity[];
  /** Called when a task row is dropped into the description. */
  onConsumeTask?: (taskId: string) => void;
  /** Registers the range-cutter so the task panel can remove dragged-out text. */
  onRegisterCut?: (cut: (start: number, end: number) => void) => void;
}

// Shared typography for the description box. The preview and the textarea must
// resolve to identical line boxes, otherwise text shifts when they swap.
const EDITOR_TEXT = 'text-sm leading-relaxed';

export function ProjectDraftEditor({ title, description, color, icon, onSaveProject, onSave, linkedActivityId, onLinkActivity, activities, onConsumeTask, onRegisterCut }: ProjectDraftEditorProps) {
  const [localDesc, setLocalDesc] = useState(description);
  const [isEditing, setIsEditing] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    setLocalDesc(description);
  }, [description]);

  const autoResize = useCallback(() => {
    if (textareaRef.current) {
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, []);

  // Keep the textarea sized to its content at all times — not just while
  // editing. It shares a grid cell with the preview, so its height is part of
  // what holds the container steady across mode switches.
  useEffect(() => {
    autoResize();
  }, [localDesc, autoResize]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalDesc(e.target.value);
    autoResize();
  };

  const handleDescBlur = () => {
    setIsEditing(false);
    if (localDesc !== description) {
      onSave(localDesc);
    }
  };

  // Enter edit mode on mouse-up, and only when nothing is selected. Using
  // `click` here meant a drag-select immediately entered edit mode and threw
  // the selection away.
  const handleContainerMouseUp = () => {
    if (isEditing) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    setIsEditing(true);
  };

  const [isTaskDropTarget, setIsTaskDropTarget] = useState(false);

  // Drag OUT: stamp the exact selected range so the drop side can cut it.
  const handleTextDragStart = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart, selectionEnd } = ta;
    if (selectionStart === selectionEnd) {
      e.preventDefault();
      return;
    }
    setTextPayload(e, ta.value.slice(selectionStart, selectionEnd), selectionStart, selectionEnd);
  };

  /**
   * Cut a range that the task panel has just turned into a task.
   *
   * `localDescRef` rather than `localDesc` so this callback stays stable and
   * does not re-register on every keystroke, and so the save happens outside a
   * state updater — React may invoke updaters twice under StrictMode, which
   * would double-save.
   */
  const localDescRef = useRef(localDesc);
  useEffect(() => {
    localDescRef.current = localDesc;
  }, [localDesc]);

  const cutRangeFromDescription = useCallback((start: number, end: number) => {
    const next = cutRange(localDescRef.current, start, end);
    localDescRef.current = next;
    setLocalDesc(next);
    onSave(next);
  }, [onSave]);

  useEffect(() => {
    onRegisterCut?.(cutRangeFromDescription);
  }, [onRegisterCut, cutRangeFromDescription]);

  // Drag IN: a task row becomes a line of description.
  const handleEditorDragOver = (e: React.DragEvent) => {
    if (!hasPayload(e, 'task')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsTaskDropTarget(true);
  };

  const handleEditorDragLeave = () => setIsTaskDropTarget(false);

  const handleEditorDrop = (e: React.DragEvent) => {
    setIsTaskDropTarget(false);
    const payload = readPayload(e);
    if (!payload || payload.kind !== 'task') return;
    e.preventDefault();

    const ta = textareaRef.current;
    const offset = ta ? caretOffsetFromPoint(ta, e.clientX, e.clientY) : localDesc.length;
    const next = insertLine(localDesc, offset, payload.title);
    setLocalDesc(next);
    onSave(next);
    onConsumeTask?.(payload.taskId);
  };

  const hasContent = localDesc.trim().length > 0;

  // One <div> per source line, each exactly one line box tall — matching how the
  // textarea lays the same text out. Blank lines render as a non-breaking space
  // rather than a fixed-height spacer.
  const renderPreview = () =>
    localDesc.split('\n').map((line, i) => (
      <div
        key={i}
        className="markdown-preview"
        dangerouslySetInnerHTML={{
          __html: line.trim() === '' ? '&nbsp;' : renderLineMd(line),
        }}
      />
    ));

  const nonBreakActivities = activities?.filter((a) => !a.isBreak) ?? [];

  return (
    <div className="flex flex-col h-full">
      {/* Clickable header row — opens edit modal */}
      <button
        type="button"
        onClick={() => setEditModalOpen(true)}
        className="flex items-center gap-2 mb-2 px-1 py-1 rounded-lg hover:bg-bg-elevated/50 transition-colors cursor-pointer text-left w-full group"
      >
        {icon ? (
          <span className="text-2xl leading-none shrink-0">{icon}</span>
        ) : (
          <span
            className="w-5 h-5 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-xl font-bold text-text-primary truncate flex-1">
          {title}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-text-muted/0 group-hover:text-text-muted transition-colors shrink-0"
        >
          <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      </button>

      <EditProjectModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        name={title}
        color={color}
        icon={icon ?? ''}
        onSave={onSaveProject}
      />

      {/* Activity link selector */}
      {onLinkActivity && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <select
            value={linkedActivityId ?? ''}
            onChange={(e) => onLinkActivity(e.target.value || null)}
            className="text-xs bg-transparent text-text-secondary border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-accent cursor-pointer"
            style={{ boxShadow: NEU.pressedSm }}
          >
            <option value="">{t('projects.noLinkedActivity')}</option>
            {nonBreakActivities.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mx-auto w-full max-w-prose">
        {/* Preview and textarea occupy the SAME grid cell, so the container is
            as tall as the taller of the two and switching modes moves nothing. */}
        <div
          ref={containerRef}
          onMouseUp={handleContainerMouseUp}
          onDragOver={handleEditorDragOver}
          onDragLeave={handleEditorDragLeave}
          onDrop={handleEditorDrop}
          className={`grid rounded-xl p-4 text-text-primary cursor-text overflow-y-auto no-scrollbar ${isTaskDropTarget ? 'ring-2 ring-accent' : ''}`}
          style={{ boxShadow: NEU.pressedSm, minHeight: '300px' }}
        >
          <div
            style={{ gridArea: '1 / 1' }}
            className={`${EDITOR_TEXT} min-w-0 ${isEditing ? 'invisible' : ''}`}
          >
            {hasContent ? (
              renderPreview()
            ) : (
              <span className="text-text-muted/40">{t('projects.notePlaceholder')}</span>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={localDesc}
            onChange={handleDescChange}
            onBlur={handleDescBlur}
            draggable
            onDragStart={handleTextDragStart}
            style={{ gridArea: '1 / 1' }}
            className={`${EDITOR_TEXT} w-full min-w-0 bg-transparent text-text-primary focus:outline-none border-none resize-none overflow-hidden whitespace-pre-wrap selection:bg-accent/30 selection:text-text-primary ${
              isEditing ? '' : 'invisible pointer-events-none'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
