import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { renderLineMd } from '../../utils/markdown';
import { useTranslation } from '../../i18n/useTranslation';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { DragDotsIcon } from '../ui/DragDotsIcon';
import { EditProjectModal } from './EditProjectModal';
import { useSettingsStore } from '../../stores/settingsStore';
import { adjustProjectNoteFontPx, useProjectTypography } from '../settings/projectTypography';
import {
  setTextPayload,
  setLineBlockPayload,
  readPayload,
  hasPayload,
  lineIndexFromNode,
  lineIndexFromPoint,
  wholeLineRange,
  offsetAfterLine,
  cutRange,
  insertLine,
  moveLineBlock,
} from '../../utils/taskDnd';
import {
  recordTyping,
  recordSnapshot as pushSnapshot,
  undo,
  redo,
  getProjectHistory,
  setProjectHistory,
  type UndoEntry,
} from '../../utils/textUndo';
import type { Activity } from '@shared/types';

interface ProjectDraftEditorProps {
  /** Keys the per-project undo history, which survives editor remounts. */
  projectId: string;
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
const EDITOR_TEXT = 'project-note leading-relaxed';

/**
 * Left gutter holding the per-line drag grips, in px.
 *
 * Applied to the preview AND the textarea, never to one alone: they share a
 * grid cell and any difference in their text origin makes the note jump when
 * the two swap. The grips live inside this gutter rather than outside the
 * container, which clips (its `overflow-y-auto` forces overflow-x to `auto`).
 */
const LINE_GUTTER_PX = 24;

export function ProjectDraftEditor({ projectId, title, description, color, icon, onSaveProject, onSave, linkedActivityId, onLinkActivity, activities, onConsumeTask, onRegisterCut }: ProjectDraftEditorProps) {
  const [localDesc, setLocalDesc] = useState(description);
  const [isEditing, setIsEditing] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { projectNoteFontPx } = useProjectTypography();
  const setProjectNoteFontOverride = useSettingsStore((s) => s.setProjectNoteFontOverride);
  const projectNoteFontPxRef = useRef(projectNoteFontPx);

  useEffect(() => {
    projectNoteFontPxRef.current = projectNoteFontPx;
  }, [projectNoteFontPx]);

  /**
   * `localDesc` mirrored into a ref so stable callbacks (cut registration,
   * undo snapshots) can read the current text without re-creating on every
   * keystroke, and so saves happen outside state updaters — React may invoke
   * updaters twice under StrictMode, which would double-save.
   */
  const localDescRef = useRef(localDesc);
  useEffect(() => {
    localDescRef.current = localDesc;
  }, [localDesc]);

  /** The editor's state right now — text plus textarea selection. */
  const currentEntry = useCallback((): UndoEntry => {
    const text = localDescRef.current;
    const ta = textareaRef.current;
    return ta
      ? { text, caretStart: ta.selectionStart, caretEnd: ta.selectionEnd }
      : { text, caretStart: text.length, caretEnd: text.length };
  }, []);

  /**
   * Pushes the current state as its own undo step. Called before every
   * discrete mutation (DnD cut/drop, an external overwrite landing) so the
   * pre-mutation text stays one Ctrl+Z away. Only ever reached from event
   * handlers or a real `description` change — never from a mount effect, so
   * a StrictMode double-mount records nothing into the module-level history.
   */
  const recordSnapshot = useCallback(() => {
    setProjectHistory(
      projectId,
      pushSnapshot(getProjectHistory(projectId), currentEntry(), Date.now())
    );
  }, [projectId, currentEntry]);

  /**
   * External-overwrite bookkeeping. `lastAppliedDescRef` is the last
   * `description` value this editor produced or accepted — a live-query
   * re-emit equal to it (our own save echo, or a title/color save) is
   * ignored. `pendingExternalRef` stashes a genuinely-foreign value that
   * arrived mid-edit (textarea focused) so in-progress typing is never
   * clobbered; handleDescBlur settles it.
   */
  const lastAppliedDescRef = useRef(description);
  const pendingExternalRef = useRef<string | null>(null);

  /** Persists `next` as our own — the next live-query echo must be ignored. */
  const saveDesc = useCallback(
    (next: string) => {
      lastAppliedDescRef.current = next;
      pendingExternalRef.current = null;
      onSave(next);
    },
    [onSave]
  );

  /** Accepts a foreign description, keeping the overwritten text undoable. */
  const applyExternalDesc = useCallback(
    (next: string) => {
      if (next !== localDescRef.current) {
        recordSnapshot();
        localDescRef.current = next;
        setLocalDesc(next);
      }
      lastAppliedDescRef.current = next;
      pendingExternalRef.current = null;
    },
    [recordSnapshot]
  );

  useEffect(() => {
    if (description === lastAppliedDescRef.current) return; // our own echo
    if (document.activeElement === textareaRef.current) {
      pendingExternalRef.current = description;
      return;
    }
    applyExternalDesc(description);
  }, [description, applyExternalDesc]);

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

  // Caret target for entering edit mode — end of the clicked preview line,
  // set by handleContainerMouseUp and consumed exactly once here.
  const entryCaretRef = useRef<number | null>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      const caret = entryCaretRef.current ?? ta.value.length;
      entryCaretRef.current = null;
      ta.setSelectionRange(caret, caret);
    }
  }, [isEditing]);

  const handleDescChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const prevText = localDescRef.current;
    // The textarea's selection at onChange time is already post-edit; clamped
    // to the pre-change text it lands within a character of the true pre-edit
    // caret — close enough for a typing-run boundary.
    const caretStart = Math.min(e.target.selectionStart, prevText.length);
    const caretEnd = Math.min(e.target.selectionEnd, prevText.length);
    setProjectHistory(
      projectId,
      recordTyping(
        getProjectHistory(projectId),
        { text: prevText, caretStart, caretEnd },
        e.target.value,
        Date.now()
      )
    );
    localDescRef.current = e.target.value;
    setLocalDesc(e.target.value);
    autoResize();
  };

  const handleDescBlur = () => {
    setIsEditing(false);
    const pending = pendingExternalRef.current;
    if (localDesc !== lastAppliedDescRef.current) {
      // Local edits win over anything stashed mid-edit — both sides carry an
      // updatedAt, and last-write-wins settles it downstream.
      saveDesc(localDesc);
    } else if (pending !== null) {
      applyExternalDesc(pending);
    }
  };

  const adjustProjectNoteFont = useCallback((deltaPx: number) => {
    const next = adjustProjectNoteFontPx(projectNoteFontPxRef.current, deltaPx);
    if (next === projectNoteFontPxRef.current) return;
    projectNoteFontPxRef.current = next;
    void setProjectNoteFontOverride(next);
  }, [setProjectNoteFontOverride]);

  /** Applies one undo/redo step, restoring its caret once the value lands. */
  const applyHistoryStep = (step: typeof undo) => {
    const result = step(getProjectHistory(projectId), currentEntry());
    if (!result) return;
    setProjectHistory(projectId, result.history);
    const { text, caretStart, caretEnd } = result.restored;
    localDescRef.current = text;
    setLocalDesc(text);
    // The textarea is controlled — the restored value applies on the
    // re-render this discrete event flushes, so the caret must wait a frame.
    requestAnimationFrame(() => {
      textareaRef.current?.setSelectionRange(caretStart, caretEnd);
    });
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // App-level undo/redo. The native stack stays suppressed even when there
    // is nothing to restore — programmatic value replacements (sync merges,
    // DnD cut/drop) leave it pointing at stale text. `altKey` is excluded so
    // AltGr layouts (reported as Ctrl+Alt) keep typing characters.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        applyHistoryStep(e.shiftKey ? redo : undo);
        return;
      }
      if (key === 'y' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        applyHistoryStep(redo);
        return;
      }
    }

    if (!e.ctrlKey || !e.shiftKey) return;

    const wantsIncrease = e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd';
    const wantsDecrease = e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract';
    if (!wantsIncrease && !wantsDecrease) return;

    e.preventDefault();
    adjustProjectNoteFont(wantsIncrease ? 1 : -1);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || e.deltaY === 0) return;
      e.preventDefault();
      adjustProjectNoteFont(e.deltaY < 0 ? 1 : -1);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [adjustProjectNoteFont]);

  // Enter edit mode on mouse-up, and only when nothing is selected. Using
  // `click` here meant a drag-select immediately entered edit mode and threw
  // the selection away. The clicked preview line (located via its
  // data-line-index) becomes the caret target — end of that source line;
  // clicks outside any line fall back to end-of-text in the focus effect.
  const handleContainerMouseUp = (e: React.MouseEvent) => {
    if (isEditing) return;
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) return;
    const lineIndex = lineIndexFromPoint(e.clientX, e.clientY);
    entryCaretRef.current =
      lineIndex === null ? null : offsetAfterLine(localDesc, lineIndex);
    setIsEditing(true);
  };

  /**
   * Focus mode — the note alone, full screen, everything else gone.
   *
   * It re-styles this component's own root instead of rendering a second tree
   * inside a portal: the same DOM nodes stay mounted, so the textarea keeps its
   * focus and selection, and `localDesc`/the undo history are untouched. The
   * cost is that entering and leaving cannot be animated (it is a layout change
   * on one node, not a mount) — a deliberate trade for not remounting the editor.
   *
   * There is no exit button by design; Escape and the Android back button are
   * the only ways out, so a hint is shown briefly on entry.
   */
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    if (!focusMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false);
    };
    // A dummy history entry so the Android back button pops focus mode rather
    // than leaving the page — same trick TodayPage's focus mode uses.
    window.history.pushState({ projectNoteFocus: true }, '');
    const handlePop = () => setFocusMode(false);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePop);
    };
  }, [focusMode]);

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
   * Drag OUT of the rendered preview — the common case, since reading the
   * description is what you do before deciding a line should be a task.
   *
   * A selection is natively draggable, so no `draggable` attribute is needed
   * (and adding one would break selecting in the first place). Rendered markup
   * cannot be mapped back to source columns, so a selection takes the whole
   * lines it touches, which is also the useful granularity here.
   */
  const handlePreviewDragStart = (e: React.DragEvent) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const from = lineIndexFromNode(range.startContainer);
    const to = lineIndexFromNode(range.endContainer);
    if (from === null || to === null) return;

    const { start, end } = wholeLineRange(localDesc, Math.min(from, to), Math.max(from, to));
    setTextPayload(e, localDesc.slice(start, end), start, end);
  };

  // Cut a range that the task panel has just turned into a task. Reads
  // through localDescRef so the callback stays stable across keystrokes.
  const cutRangeFromDescription = useCallback(
    (start: number, end: number) => {
      recordSnapshot();
      const next = cutRange(localDescRef.current, start, end);
      localDescRef.current = next;
      setLocalDesc(next);
      saveDesc(next);
    },
    [recordSnapshot, saveDesc]
  );

  useEffect(() => {
    onRegisterCut?.(cutRangeFromDescription);
  }, [onRegisterCut, cutRangeFromDescription]);

  /**
   * Where a line being dragged inside the note would land. Feedback for this
   * lives on the individual line (an insertion rule), not on the container —
   * unlike a task drop, which can land anywhere and so rings the whole box.
   */
  const [dropLine, setDropLine] = useState<{ index: number; position: 'above' | 'below' } | null>(null);

  const isHoverPointer = useMediaQuery('(hover: hover) and (pointer: fine)');

  /**
   * Drag OUT by a line's grip. The grip carries the `draggable` attribute, not
   * the line — making the line itself draggable would turn every mousedown-drag
   * into a drag instead of a text selection, the same trap documented on the
   * textarea below.
   */
  const handleLineDragStart = (e: React.DragEvent, lineIndex: number) => {
    const { start, end } = wholeLineRange(localDesc, lineIndex, lineIndex);
    setLineBlockPayload(e, localDesc.slice(start, end), start, end, lineIndex, lineIndex);
    // Drag the line itself rather than the grip icon, so what follows the
    // cursor is what is being moved.
    const lineEl = (e.currentTarget as HTMLElement).parentElement;
    if (lineEl) e.dataTransfer.setDragImage(lineEl, LINE_GUTTER_PX, lineEl.clientHeight / 2);
  };

  const handleLineDragOver = (e: React.DragEvent, lineIndex: number) => {
    if (!hasPayload(e, 'text')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
    setDropLine({ index: lineIndex, position });
  };

  // Drag IN: a task row becomes a line of description, or a note line moves.
  const handleEditorDragOver = (e: React.DragEvent) => {
    if (hasPayload(e, 'text')) {
      // Over the container's padding, past any line. Accept the drop so it
      // does not fall through to the browser, but leave the insertion rule to
      // whichever line was last hovered.
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      return;
    }
    if (!hasPayload(e, 'task')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsTaskDropTarget(true);
  };

  const handleEditorDragLeave = (e: React.DragEvent) => {
    setIsTaskDropTarget(false);
    // dragleave bubbles, so crossing from one line to the next fires it on the
    // container too. Clearing the insertion rule there would make it strobe as
    // the cursor moves down the note — only clear when the drag has actually
    // left the container.
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDropLine(null);
  };

  const handleEditorDragEnd = () => setDropLine(null);

  const handleEditorDrop = (e: React.DragEvent) => {
    setIsTaskDropTarget(false);
    const target = dropLine;
    setDropLine(null);
    const payload = readPayload(e);
    if (!payload) return;

    if (payload.kind === 'text') {
      // Only a whole-line block can be re-ordered; a partial selection dragged
      // out of the textarea has no line range and is ignored here.
      if (payload.lineStart === undefined || payload.lineEnd === undefined || !target) return;
      e.preventDefault();
      const next = moveLineBlock(
        localDesc,
        payload.lineStart,
        payload.lineEnd,
        target.index,
        target.position,
      );
      if (next === localDesc) return;
      recordSnapshot();
      localDescRef.current = next;
      setLocalDesc(next);
      saveDesc(next);
      return;
    }

    e.preventDefault();
    recordSnapshot();

    // Insert after the line the cursor is over. Dropping past the last line
    // (or into an empty description) appends.
    const lineIndex = lineIndexFromPoint(e.clientX, e.clientY);
    const offset =
      lineIndex === null ? localDesc.length : offsetAfterLine(localDesc, lineIndex);
    const next = insertLine(localDesc, offset, payload.title);
    localDescRef.current = next;
    setLocalDesc(next);
    saveDesc(next);
    onConsumeTask?.(payload.taskId);
  };

  const hasContent = localDesc.trim().length > 0;

  // One <div> per source line, each exactly one line box tall — matching how the
  // textarea lays the same text out. Blank lines render as a non-breaking space
  // rather than a fixed-height spacer.
  //
  // The grip and the insertion rule are absolutely positioned, so neither adds
  // to the line box; the line keeps the exact height the textarea gives it.
  const renderPreview = () =>
    localDesc.split('\n').map((line, i) => (
      <div
        key={i}
        data-line-index={i}
        className="markdown-preview group/line relative"
        onDragOver={(e) => handleLineDragOver(e, i)}
      >
        {isHoverPointer && (
          <span
            draggable
            onDragStart={(e) => handleLineDragStart(e, i)}
            // Without this, grabbing the grip counts as a click on the preview
            // and flips the note into edit mode, swapping the line away.
            onMouseUp={(e) => e.stopPropagation()}
            title={t('projects.dragLine')}
            className="absolute top-0 flex cursor-grab items-center active:cursor-grabbing select-none transition-opacity can-hover:opacity-0 can-hover:group-hover/line:opacity-100"
            // Height is one line box (`leading-relaxed`), not the line's full
            // height: a source line that wraps to several visual lines would
            // otherwise centre its grip somewhere in the middle of the
            // paragraph instead of beside where the line starts.
            style={{ left: -LINE_GUTTER_PX, width: LINE_GUTTER_PX, height: '1.625em' }}
          >
            <DragDotsIcon />
          </span>
        )}
        {dropLine?.index === i && (
          <div
            className="absolute left-0 right-0 h-[2px] rounded-full bg-accent z-10"
            style={dropLine.position === 'above' ? { top: -1 } : { bottom: -1 }}
          />
        )}
        {/* A block wrapper, not an inline one: a list line renders as a flex
            div, and nesting that inside a span would split the line box. */}
        <div
          dangerouslySetInnerHTML={{
            __html: line.trim() === '' ? '&nbsp;' : renderLineMd(line),
          }}
        />
      </div>
    ));

  const nonBreakActivities = activities?.filter((a) => !a.isBreak) ?? [];

  return (
    <div
      className={
        focusMode
          ? 'fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg-primary'
          : 'flex flex-col h-full'
      }
      style={
        focusMode
          ? {
              paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))',
              paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
            }
          : undefined
      }
    >
      {focusMode && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.6, delay: 2 }}
          className="pointer-events-none fixed top-4 right-4 z-[51] rounded-lg px-2 py-1 text-xs text-text-muted"
          style={{ boxShadow: NEU.raisedSm }}
        >
          {t('projects.exitFocusHint')}
        </motion.div>
      )}

      {/* Header row. A container rather than one big button, so controls that
          are not "edit the project" can sit beside the title without nesting a
          button inside a button. */}
      <div className={`group flex items-center gap-2 mb-2 ${focusMode ? 'hidden' : ''}`}>
        <button
          type="button"
          onClick={() => setEditModalOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 rounded-lg hover:bg-bg-elevated/50 transition-colors cursor-pointer text-left"
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
            className="text-text-muted transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100 group-focus-within:opacity-100 shrink-0"
          >
            <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            <path d="m15 5 4 4" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setFocusMode(true)}
          title={t('projects.focusNote')}
          className="shrink-0 p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-opacity can-hover:opacity-0 can-hover:group-hover:opacity-100 focus-visible:opacity-100"
          style={{ boxShadow: NEU.raisedSm }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3" />
            <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
            <path d="M3 16v3a2 2 0 0 0 2 2h3" />
            <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
          </svg>
        </button>
      </div>

      <EditProjectModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        name={title}
        color={color}
        icon={icon ?? ''}
        onSave={onSaveProject}
      />

      {/* Activity link selector */}
      {onLinkActivity && !focusMode && (
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

      <div className={`mx-auto w-full max-w-prose ${focusMode ? 'flex-1 px-4' : ''}`}>
        {/* Preview and textarea occupy the SAME grid cell, so the container is
            as tall as the taller of the two and switching modes moves nothing. */}
        <div
          ref={containerRef}
          onMouseUp={handleContainerMouseUp}
          onDragOver={handleEditorDragOver}
          onDragLeave={handleEditorDragLeave}
          onDragEnd={handleEditorDragEnd}
          onDrop={handleEditorDrop}
          className={`grid rounded-xl p-4 text-text-primary cursor-text overflow-y-auto no-scrollbar select-text ${isTaskDropTarget ? 'ring-2 ring-accent' : ''}`}
          // Focus mode drops the inset frame — nothing but the text should be
          // visible — and lets the note take the full height instead of the
          // fixed 300px box it occupies beside the task panel.
          style={
            focusMode
              ? { minHeight: '100%' }
              : { boxShadow: NEU.pressedSm, minHeight: '300px' }
          }
        >
          <div
            onDragStart={handlePreviewDragStart}
            style={{
              gridArea: '1 / 1',
              fontSize: `${projectNoteFontPx}px`,
              paddingLeft: LINE_GUTTER_PX,
            }}
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
            // No `draggable` attribute: a selection inside a text control is
            // natively draggable and still fires dragstart, whereas
            // draggable="true" makes mousedown-drag start a drag instead of a
            // selection — which would make the description unselectable.
            onDragStart={handleTextDragStart}
            onKeyDown={handleEditorKeyDown}
            // Same gutter as the preview — the two share a grid cell and any
            // difference in their text origin makes the note jump on swap.
            style={{
              gridArea: '1 / 1',
              fontSize: `${projectNoteFontPx}px`,
              paddingLeft: LINE_GUTTER_PX,
            }}
            className={`${EDITOR_TEXT} w-full min-w-0 bg-transparent text-text-primary focus:outline-none border-none resize-none overflow-hidden whitespace-pre-wrap selection:bg-accent/30 selection:text-text-primary ${
              isEditing ? '' : 'invisible pointer-events-none'
            }`}
          />
        </div>
      </div>
    </div>
  );
}
