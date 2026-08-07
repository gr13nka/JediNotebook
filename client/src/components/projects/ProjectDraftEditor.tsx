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
  lineIndexFromNode,
  lineIndexFromPoint,
  lineOfOffset,
  LINE_INDEX_ATTR,
  wholeLineRange,
  offsetAfterLine,
  insertLine,
  moveLineBlock,
} from '../../utils/taskDnd';
import {
  didJustDrag,
  isDragActive,
  startDrag,
  useDropTarget,
} from '../../hooks/useDragGesture';
import { useNoteDocument } from '../../hooks/useNoteDocument';
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
  const doc = useNoteDocument({ projectId, description, onSave });
  const { text: localDesc, textareaRef } = doc;
  const [isEditing, setIsEditing] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  const { projectNoteFontPx } = useProjectTypography();
  const setProjectNoteFontOverride = useSettingsStore((s) => s.setProjectNoteFontOverride);
  const projectNoteFontPxRef = useRef(projectNoteFontPx);

  useEffect(() => {
    projectNoteFontPxRef.current = projectNoteFontPx;
  }, [projectNoteFontPx]);

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
    doc.onChange(e);
    autoResize();
  };

  const handleDescBlur = () => {
    setIsEditing(false);
    doc.settle();
  };

  const adjustProjectNoteFont = useCallback((deltaPx: number) => {
    const next = adjustProjectNoteFontPx(projectNoteFontPxRef.current, deltaPx);
    if (next === projectNoteFontPxRef.current) return;
    projectNoteFontPxRef.current = next;
    void setProjectNoteFontOverride(next);
  }, [setProjectNoteFontOverride]);

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // App-level undo/redo. The native stack stays suppressed even when there
    // is nothing to restore — programmatic value replacements (sync merges,
    // a drag's cut or drop) leave it pointing at stale text. `altKey` is
    // excluded so AltGr layouts (reported as Ctrl+Alt) keep typing characters.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) doc.redo();
        else doc.undo();
        return;
      }
      if (key === 'y' && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        doc.redo();
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
    // Releasing a drag over the note fires mouseup here, and mouseup is not
    // covered by the drag channel's click suppression.
    if (didJustDrag()) return;
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

  // Lets the task panel remove the range it has just turned into a task.
  useEffect(() => {
    onRegisterCut?.(doc.cutRange);
  }, [onRegisterCut, doc.cutRange]);

  /**
   * Where a line being dragged inside the note would land. Feedback for this
   * lives on the individual line (an insertion rule), not on the container —
   * unlike a task drop, which can land anywhere and so rings the whole box.
   */
  const [dropLine, setDropLine] = useState<{ index: number; position: 'above' | 'below' } | null>(null);
  /** Line whose grip is showing. Not CSS `:hover` — see `lineAtPoint`. */
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);

  const isHoverPointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const previewRef = useRef<HTMLDivElement>(null);

  /**
   * Which preview line sits at `clientY`, and which half of it the point is in.
   *
   * Resolved by geometry rather than by hit-testing, because while the textarea
   * is up the preview is `visibility: hidden` — it still lays out (which is all
   * this needs) but receives no pointer or drag events at all, so neither CSS
   * `:hover` on a line nor `elementFromPoint` can find one. Doing it this way is
   * what lets the grips work while you are typing, not only while reading.
   */
  const lineAtPoint = useCallback(
    (clientY: number): { index: number; position: 'above' | 'below' } | null => {
      const preview = previewRef.current;
      if (!preview) return null;
      for (const el of preview.querySelectorAll<HTMLElement>(`[${LINE_INDEX_ATTR}]`)) {
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top || clientY > rect.bottom) continue;
        const index = Number(el.getAttribute(LINE_INDEX_ATTR));
        if (Number.isNaN(index)) return null;
        return { index, position: clientY < rect.top + rect.height / 2 ? 'above' : 'below' };
      }
      return null;
    },
    [],
  );

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (!isHoverPointer) return;
    // A mouse drag emits mousemove alongside pointermove. Letting the hovered
    // line change mid-drag would unmount the very grip being dragged.
    if (isDragActive()) return;
    const hit = lineAtPoint(e.clientY);
    setHoveredLine((prev) => (prev === (hit?.index ?? null) ? prev : hit?.index ?? null));
  };

  /**
   * Drag OUT by a line's grip. The grip is the drag source, not the line —
   * pressing a line has to stay a text selection, and a press that starts a
   * drag cannot also start a selection.
   */
  const startLineDrag = (e: React.PointerEvent<HTMLElement>, lineIndex: number) => {
    // The container's own pointerdown would otherwise see this press too and
    // replace the drag it just started.
    e.stopPropagation();
    const { start, end } = wholeLineRange(localDesc, lineIndex, lineIndex);
    const text = localDesc.slice(start, end);
    startDrag(e, {
      ghost: { label: text.trim() || t('projects.dragLine') },
      payload: { kind: 'text', text, start, end, lineStart: lineIndex, lineEnd: lineIndex },
    });
  };

  /**
   * The selected lines and their exact character range, when a press at
   * `clientY` lands on the current selection — the gesture that drags a
   * selection out of the note rather than replacing it.
   *
   * Line granularity for the hit test, in both modes: rendered markup cannot be
   * mapped back to source columns, and a textarea's selection is reported as
   * offsets with no geometry at all. Lines are the only common ground, and they
   * are the granularity the drop side works in anyway.
   */
  const selectedDragRange = (
    clientY: number,
  ): { start: number; end: number; firstLine: number; lastLine: number } | null => {
    let range: { start: number; end: number } | null = null;
    let firstLine: number;
    let lastLine: number;

    const ta = textareaRef.current;
    if (isEditing && ta && ta.selectionStart !== ta.selectionEnd) {
      range = { start: ta.selectionStart, end: ta.selectionEnd };
      firstLine = lineOfOffset(localDesc, ta.selectionStart);
      lastLine = lineOfOffset(localDesc, ta.selectionEnd);
    } else {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
      const domRange = selection.getRangeAt(0);
      const from = lineIndexFromNode(domRange.startContainer);
      const to = lineIndexFromNode(domRange.endContainer);
      if (from === null || to === null) return null;
      firstLine = Math.min(from, to);
      lastLine = Math.max(from, to);
      // A preview selection takes the whole lines it touches: its rendered
      // offsets say nothing about columns in the source.
      range = wholeLineRange(localDesc, firstLine, lastLine);
    }

    const hit = lineAtPoint(clientY);
    if (!hit || hit.index < firstLine || hit.index > lastLine) return null;
    return { ...range, firstLine, lastLine };
  };

  const handleContainerPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const selected = selectedDragRange(e.clientY);
    if (!selected) return;
    // Otherwise the press collapses the selection it is trying to pick up.
    e.preventDefault();
    const text = localDesc.slice(selected.start, selected.end);
    startDrag(e, {
      ghost: { label: text.split('\n')[0].trim() || t('projects.dragLine') },
      // No line range, so this drag can only leave the note, not re-order it —
      // a selection may be partial, and splicing a partial range as if it were
      // whole lines would corrupt the text around it.
      payload: { kind: 'text', text, start: selected.start, end: selected.end },
    });
  };

  // Drag IN: a task row becomes a line of description, or a note line moves.
  const { ref: noteDropRef } = useDropTarget({
    accepts: (drag) => drag.spec.payload?.kind === 'text' || drag.spec.payload?.kind === 'task',
    onOver: (drag, _x, y) => {
      if (drag.spec.payload?.kind === 'task') {
        setIsTaskDropTarget(true);
        return;
      }
      // Past the last line (the container's padding) the insertion rule stays
      // wherever it last was, rather than vanishing under the cursor.
      const hit = lineAtPoint(y);
      if (hit) setDropLine(hit);
    },
    onLeave: () => {
      setIsTaskDropTarget(false);
      setDropLine(null);
    },
    onDrop: (drag, _x, y) => {
      setIsTaskDropTarget(false);
      const target = lineAtPoint(y);
      setDropLine(null);
      const payload = drag.spec.payload;
      if (!payload) return;

      if (payload.kind === 'text') {
        // Only a whole-line block can be re-ordered; a partial selection has no
        // line range and is ignored here.
        if (payload.lineStart === undefined || payload.lineEnd === undefined || !target) return;
        doc.replace(moveLineBlock(
          localDesc,
          payload.lineStart,
          payload.lineEnd,
          target.index,
          target.position,
        ));
        return;
      }

      if (payload.kind !== 'task') return;

      // Insert after the line the pointer is over. Dropping past the last line
      // (or into an empty description) appends. Geometry, not hit-testing, so
      // this still lands correctly when the textarea is covering the preview.
      const offset =
        target === null ? localDesc.length : offsetAfterLine(localDesc, target.index);
      doc.replace(insertLine(localDesc, offset, payload.title));
      onConsumeTask?.(payload.taskId);
    },
  });

  /** The note container is both the wheel-zoom host and the drop target. */
  const setContainerNode = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      noteDropRef(node);
    },
    [noteDropRef],
  );

  const hasContent = localDesc.trim().length > 0;

  // One <div> per source line, each exactly one line box tall — matching how the
  // textarea lays the same text out. Blank lines render as a non-breaking space
  // rather than a fixed-height spacer.
  //
  // The grip and the insertion rule are absolutely positioned, so neither adds
  // to the line box; the line keeps the exact height the textarea gives it.
  const renderPreview = () =>
    localDesc.split('\n').map((line, i) => (
      <div key={i} data-line-index={i} className="markdown-preview relative">
        {/* `visible` and `z-20` are what let the grip work while you type: the
            preview around it is `visibility: hidden` under the textarea, and
            visibility is overridable per-element, so the grip alone shows and
            alone stays hit-testable — above the textarea, which is unpositioned. */}
        {isHoverPointer && hoveredLine === i && (
          <span
            onPointerDown={(e) => startLineDrag(e, i)}
            // Without this, grabbing the grip counts as a click on the preview
            // and flips the note into edit mode, swapping the line away.
            onMouseUp={(e) => e.stopPropagation()}
            title={t('projects.dragLine')}
            className="visible absolute top-0 z-20 flex cursor-grab items-center active:cursor-grabbing select-none"
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
            className="visible absolute left-0 right-0 h-[2px] rounded-full bg-accent z-20"
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
          ref={setContainerNode}
          onMouseUp={handleContainerMouseUp}
          onMouseMove={handleContainerMouseMove}
          onMouseLeave={() => setHoveredLine(null)}
          onPointerDown={handleContainerPointerDown}
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
            ref={previewRef}
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
            ref={doc.textareaRef}
            value={localDesc}
            onChange={handleDescChange}
            onBlur={handleDescBlur}
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
