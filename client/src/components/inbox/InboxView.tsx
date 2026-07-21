import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useInbox } from '../../hooks/useInbox';
import { useProjects } from '../../hooks/useProjects';
import { useTranslation } from '../../i18n/useTranslation';
import { db } from '../../db';
import { generateId, getDeviceId } from '../../utils/uuid';
import { ACTIVITY_COLORS, NOTE_COLORS } from '@shared/constants';
import { awardXP, XP_VALUES } from '../../utils/streak';
import { Card } from '../ui/Card';

interface InboxViewProps {
  embedded?: boolean;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const InboxTrayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
  </svg>
);

export function InboxView({ embedded = false }: InboxViewProps) {
  const { items, addItem, updateItem, deleteItem } = useInbox();
  const { projects, createProject } = useProjects();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState<'capture' | 'sort'>('capture');
  const [sortIndex, setSortIndex] = useState(0);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [sortEditText, setSortEditText] = useState('');
  const [isSortEditing, setIsSortEditing] = useState(false);
  const [undoPending, setUndoPending] = useState<{ id: string; secondsLeft: number } | null>(null);
  const [taskMode, setTaskMode] = useState(false);
  const [taskModePickerId, setTaskModePickerId] = useState<string | null>(null);
  const autoSortTriggered = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sortEditRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearUndoTimer = useCallback(() => {
    if (undoTimerRef.current) {
      clearInterval(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setUndoPending(null);
  }, []);

  // Cleanup undo timer on unmount or mode change
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    };
  }, []);

  // Countdown effect for undo
  useEffect(() => {
    if (!undoPending) return;
    if (undoPending.secondsLeft <= 0) {
      clearUndoTimer();
    }
  }, [undoPending, clearUndoTimer]);

  useEffect(() => {
    if (mode === 'capture') {
      inputRef.current?.focus();
      clearUndoTimer();
    }
  }, [mode, clearUndoTimer]);

  useEffect(() => {
    if (isSortEditing) {
      sortEditRef.current?.focus();
    }
  }, [isSortEditing]);

  // Auto-enter sort mode from ?mode=sort query param
  useEffect(() => {
    if (!embedded && !autoSortTriggered.current && searchParams.get('mode') === 'sort' && items.length > 0) {
      autoSortTriggered.current = true;
      enterSortMode();
    }
  }, [items.length, searchParams, embedded]);

  const handleTaskModeAssign = async (itemId: string, projectId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const now = new Date().toISOString();
    const existingTasks = await db.projectTasks
      .where('projectId')
      .equals(projectId)
      .filter((t) => !t.deletedAt)
      .toArray();
    await db.projectTasks.add({
      id: generateId(),
      projectId,
      title: item.text,
      sortOrder: existingTasks.length,
      isCompleted: false,
      completedAt: null,
      recurrenceRule: null,
      lastRecurredDate: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    });
    awardXP(XP_VALUES.createTask);
    await deleteItem(itemId);
    setTaskModePickerId(null);
  };

  const handleAdd = async () => {
    const text = inputText.trim();
    if (!text) return;
    await addItem(text);
    setInputText('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const startEditing = (id: string, text: string) => {
    setEditingId(id);
    setEditText(text);
  };

  const saveEdit = async (id: string) => {
    const trimmed = editText.trim();
    if (trimmed) {
      await updateItem(id, trimmed);
    }
    setEditingId(null);
    setEditText('');
  };

  // Sort mode logic
  const currentItem = items[sortIndex];

  const moveToNext = () => {
    if (sortIndex < items.length - 1) {
      setSortIndex((i) => i + 1);
    }
    // If at the end, the render will show "All sorted!" — stay in sort mode
    setShowProjectPicker(false);
    setIsSortEditing(false);
  };

  const handleSortAsTask = () => {
    setShowProjectPicker(true);
  };

  const handlePickProject = async (projectId: string) => {
    if (!currentItem) return;
    const now = new Date().toISOString();
    const existingTasks = await db.projectTasks
      .where('projectId')
      .equals(projectId)
      .filter((t) => !t.deletedAt)
      .toArray();
    await db.projectTasks.add({
      id: generateId(),
      projectId,
      title: currentItem.text,
      sortOrder: existingTasks.length,
      isCompleted: false,
      completedAt: null,
      recurrenceRule: null,
      lastRecurredDate: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    });
    awardXP(XP_VALUES.createTask);
    await deleteItem(currentItem.id);
    moveToNext();
  };

  const handleNewProject = async () => {
    if (!currentItem) return;
    const color = ACTIVITY_COLORS[Math.floor(Math.random() * ACTIVITY_COLORS.length)];

    let projectName: string;
    let draft: string;

    const dashIndex = currentItem.text.indexOf('-');
    if (dashIndex > 0) {
      projectName = currentItem.text.slice(0, dashIndex).trim();
      draft = currentItem.text.slice(dashIndex + 1).trim();
    } else {
      const words = currentItem.text.trim().split(/\s+/);
      projectName = words.slice(0, 3).join(' ');
      draft = words.length > 3 ? words.slice(3).join(' ') : '';
    }

    await createProject({ name: projectName, color, description: draft });
    await deleteItem(currentItem.id);
    moveToNext();
  };

  const handleIdea = async () => {
    if (!currentItem) return;
    const now = new Date().toISOString();
    const color = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
    await db.notes.add({
      id: generateId(),
      title: currentItem.text,
      content: '',
      color,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    });
    awardXP(XP_VALUES.createNote);
    await deleteItem(currentItem.id);
    moveToNext();
  };

  const startUndoTimer = (id: string) => {
    // Clear any existing undo timer
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);

    setUndoPending({ id, secondsLeft: 3 });
    undoTimerRef.current = setInterval(() => {
      setUndoPending((prev) => {
        if (!prev || prev.secondsLeft <= 1) {
          if (undoTimerRef.current) {
            clearInterval(undoTimerRef.current);
            undoTimerRef.current = null;
          }
          return null;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
  };

  const handleUndo = async () => {
    if (!undoPending) return;
    const now = new Date().toISOString();
    await db.inboxItems.update(undoPending.id, {
      deletedAt: null,
      updatedAt: now,
    });
    clearUndoTimer();
  };

  const handleSortDelete = async () => {
    if (!currentItem) return;
    const itemId = currentItem.id;
    await deleteItem(itemId);
    startUndoTimer(itemId);
    // Stay in sort mode — the item disappears from the reactive list,
    // so sortIndex now points to the next item automatically.
    // Clamp sortIndex if it overflows (handled by render).
    setIsSortEditing(false);
  };

  const handleSortEditSave = async () => {
    if (!currentItem) return;
    const trimmed = sortEditText.trim();
    if (trimmed) {
      await updateItem(currentItem.id, trimmed);
    }
    setIsSortEditing(false);
  };

  const enterSortMode = () => {
    setSortIndex(0);
    setMode('sort');
    setShowProjectPicker(false);
    setIsSortEditing(false);
    clearUndoTimer();
  };

  // Undo bar component
  const undoBar = undoPending && (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-bg-card"
      style={{ boxShadow: NEU.raisedSm }}
    >
      <span className="text-sm text-text-secondary">{t('inbox.delete')}d</span>
      <button
        onClick={handleUndo}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium text-accent"
        style={{ boxShadow: NEU.raisedSm }}
      >
        <UndoIcon />
        Undo ({undoPending.secondsLeft}s)
      </button>
    </motion.div>
  );

  // Sort mode render
  if (mode === 'sort') {
    // Clamp sort index
    const clampedIndex = Math.min(sortIndex, Math.max(items.length - 1, 0));
    if (clampedIndex !== sortIndex && items.length > 0) {
      setSortIndex(clampedIndex);
    }

    // All items processed
    if (items.length === 0) {
      return (
        <div className="space-y-4">
          {!embedded && (
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-text-primary">{t('inbox.title')}</h1>
            </div>
          )}
          <Card>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <InboxTrayIcon />
              <p className="mt-3 text-text-secondary font-medium">{t('inbox.allSorted')}</p>
              <button
                onClick={() => { setMode('capture'); setSortIndex(0); }}
                className="mt-4 px-4 py-2 rounded-xl text-sm font-medium text-accent"
                style={{ boxShadow: NEU.raisedSm }}
              >
                {t('inbox.done')}
              </button>
            </div>
          </Card>
          <AnimatePresence>{undoBar}</AnimatePresence>
        </div>
      );
    }

    const item = items[clampedIndex];

    // Project picker view
    if (showProjectPicker) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProjectPicker(false)}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
            >
              <ArrowLeftIcon />
            </button>
            <h1 className="text-xl font-bold text-text-primary">{t('inbox.pickProject')}</h1>
          </div>

          <Card className="flex items-start gap-3">
            <div className="w-1 h-full min-h-[24px] rounded-full bg-accent shrink-0" />
            <p className="text-sm text-text-primary">{item.text}</p>
          </Card>

          <div className="space-y-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handlePickProject(project.id)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium text-text-primary bg-bg-card transition-colors"
                style={{ boxShadow: NEU.raisedSm }}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: project.color }}
                />
                <span>{project.name}</span>
              </button>
            ))}
            {projects.length === 0 && (
              <p className="text-text-muted text-sm text-center py-4">{t('projects.empty')}</p>
            )}
          </div>
        </div>
      );
    }

    // Sort card view
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setMode('capture'); setSortIndex(0); }}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
            >
              <ArrowLeftIcon />
            </button>
            {!embedded && <h1 className="text-xl font-bold text-text-primary">{t('inbox.title')}</h1>}
          </div>
          <span className="text-sm text-text-muted">
            {clampedIndex + 1} / {items.length}
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="min-h-[120px] flex flex-col justify-center">
              {isSortEditing ? (
                <input
                  ref={sortEditRef}
                  value={sortEditText}
                  onChange={(e) => setSortEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSortEditSave();
                    if (e.key === 'Escape') setIsSortEditing(false);
                  }}
                  className="w-full bg-transparent text-lg text-text-primary outline-none border-b border-border py-1"
                />
              ) : (
                <p className="text-lg text-text-primary">{item.text}</p>
              )}
              <p className="text-xs text-text-muted mt-2">{relativeTime(item.createdAt)}</p>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleSortAsTask}
            className="px-4 py-3 rounded-xl text-sm font-medium text-text-primary bg-bg-card transition-colors"
            style={{ boxShadow: NEU.raisedSm }}
          >
            {t('inbox.task')}
          </button>
          <button
            onClick={handleNewProject}
            className="px-4 py-3 rounded-xl text-sm font-medium text-text-primary bg-bg-card transition-colors"
            style={{ boxShadow: NEU.raisedSm }}
          >
            {t('inbox.newProject')}
          </button>
          <button
            onClick={handleIdea}
            className="px-4 py-3 rounded-xl text-sm font-medium text-text-primary bg-bg-card transition-colors"
            style={{ boxShadow: NEU.raisedSm }}
          >
            {t('inbox.idea')}
          </button>
          <button
            onClick={moveToNext}
            className="px-4 py-3 rounded-xl text-sm font-medium text-text-muted bg-bg-card transition-colors"
            style={{ boxShadow: NEU.raisedSm }}
          >
            {t('inbox.skip')}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              if (isSortEditing) {
                handleSortEditSave();
              } else {
                setSortEditText(item.text);
                setIsSortEditing(true);
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-text-secondary bg-bg-card transition-colors"
            style={{ boxShadow: NEU.raisedSm }}
          >
            <EditIcon />
            {isSortEditing ? t('common.save') : t('inbox.edit')}
          </button>
          <button
            onClick={handleSortDelete}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-red bg-bg-card transition-colors"
            style={{ boxShadow: NEU.raisedSm }}
          >
            <TrashIcon />
            {t('inbox.delete')}
          </button>
        </div>

        <AnimatePresence>{undoBar}</AnimatePresence>
      </div>
    );
  }

  // Capture mode
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {!embedded && <h1 className="text-xl font-bold text-text-primary">{t('inbox.title')}</h1>}
        <div className="flex items-center gap-2 ml-auto">
          {items.length > 0 && (
            <button
              onClick={() => setTaskMode((v) => !v)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                taskMode ? 'text-accent' : 'text-text-muted'
              }`}
              style={{ boxShadow: taskMode ? NEU.pressedSm : NEU.raisedSm }}
            >
              {t('inbox.taskMode')}
            </button>
          )}
          {items.length > 0 && (
            <button
              onClick={enterSortMode}
              className="px-3 py-1.5 rounded-xl text-sm font-medium text-accent"
              style={{ boxShadow: NEU.raisedSm }}
            >
              {t('inbox.sort')}
            </button>
          )}
        </div>
      </div>

      <div
        className="flex gap-2 items-end rounded-xl bg-bg-card p-2"
        style={{ boxShadow: NEU.pressed }}
      >
        <textarea
          ref={inputRef}
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            autoResize(e.target);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('inbox.placeholder')}
          rows={1}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none px-2 resize-none overflow-hidden leading-6"
        />
        <button
          onClick={handleAdd}
          disabled={!inputText.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-accent disabled:opacity-40 transition-opacity shrink-0"
          style={{ boxShadow: NEU.raisedSm }}
        >
          +
        </button>
      </div>

      <AnimatePresence>
        {(() => {
          const words = inputText.trim().split(/\s+/);
          if (words.length < 10 || !inputText.trim()) return null;
          const dashIdx = inputText.indexOf('-');
          if (dashIdx > 0) {
            const before = inputText.slice(0, dashIdx).trim();
            const after = inputText.slice(dashIdx + 1).trim();
            return (
              <motion.div
                key="dash-preview"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="text-xs text-text-muted px-2 space-y-0.5"
              >
                <p><span className="text-text-secondary font-medium">{t('inbox.newProject')}:</span> {before}</p>
                <p><span className="text-text-secondary font-medium">Draft:</span> {after}</p>
              </motion.div>
            );
          }
          return (
            <motion.p
              key="dash-hint"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="text-xs text-text-muted px-2"
            >
              {t('inbox.dashHint')}
            </motion.p>
          );
        })()}
      </AnimatePresence>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <InboxTrayIcon />
          <p className="mt-3 text-text-muted text-sm">{t('inbox.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-card"
                  style={{ boxShadow: NEU.raisedSm }}
                >
                  {editingId === item.id ? (
                    <input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(item.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => saveEdit(item.id)}
                      autoFocus
                      className="flex-1 bg-transparent text-sm text-text-primary outline-none"
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm text-text-primary cursor-pointer"
                      onClick={() => startEditing(item.id, item.text)}
                    >
                      {item.text}
                    </span>
                  )}
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {relativeTime(item.createdAt)}
                  </span>
                  {taskMode && (
                    <div className="relative">
                      <button
                        onClick={() => setTaskModePickerId(taskModePickerId === item.id ? null : item.id)}
                        className="w-5 h-5 rounded-full border-2 border-accent/50 hover:border-accent transition-colors shrink-0"
                        title={t('inbox.task')}
                      />
                      <AnimatePresence>
                        {taskModePickerId === item.id && (
                          <>
                            <motion.div
                              className="fixed inset-0 z-40"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              onClick={() => setTaskModePickerId(null)}
                            />
                            <motion.div
                              className="absolute right-0 top-full mt-1 z-50 rounded-xl bg-bg-card p-1.5 min-w-[160px] max-h-[200px] overflow-y-auto"
                              style={{ boxShadow: NEU.raised }}
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                            >
                              {projects.map((project) => (
                                <button
                                  key={project.id}
                                  onClick={() => handleTaskModeAssign(item.id, project.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left text-text-secondary hover:text-text-primary transition-colors"
                                >
                                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                                  <span className="truncate">{project.name}</span>
                                </button>
                              ))}
                              {projects.length === 0 && (
                                <p className="text-xs text-text-muted px-3 py-2">{t('projects.empty')}</p>
                              )}
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1 rounded-lg text-text-muted hover:text-red transition-colors shrink-0"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
