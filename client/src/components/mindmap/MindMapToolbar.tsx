import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import { useMindMapUIStore } from '../../stores/mindMapUIStore';
import { useMindMaps } from '../../hooks/useMindMaps';
import type { MindMap } from '@shared/types';
import { exportFreeMind, exportMarkdown, exportJSON } from './exportMindMap';

interface Props {
  activeMindMap: MindMap | null;
  onAddChild: () => void;
  onDeleteNode: () => void;
}

export function MindMapToolbar({ activeMindMap, onAddChild, onDeleteNode }: Props) {
  const { t } = useTranslation();
  const { mindMaps, createMindMap, deleteMindMap } = useMindMaps();
  const activeMindMapId = useMindMapUIStore((s) => s.activeMindMapId);
  const setActiveMindMap = useMindMapUIStore((s) => s.setActiveMindMap);
  const selectedNodeId = useMindMapUIStore((s) => s.selectedNodeId);
  const mindUnloadActive = useMindMapUIStore((s) => s.mindUnloadActive);
  const setMindUnloadActive = useMindMapUIStore((s) => s.setMindUnloadActive);
  const timerVisible = useMindMapUIStore((s) => s.timerVisible);
  const setTimerVisible = useMindMapUIStore((s) => s.setTimerVisible);

  const [showExport, setShowExport] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showNewInput, setShowNewInput] = useState(false);

  const handleCreate = async () => {
    const title = newTitle.trim() || t('mindmap.untitled');
    const mm = await createMindMap(title);
    setActiveMindMap(mm.id);
    setNewTitle('');
    setShowNewInput(false);
    setShowSelector(false);
  };

  const handleDelete = async () => {
    if (!activeMindMapId) return;
    await deleteMindMap(activeMindMapId);
    const remaining = mindMaps.filter((m) => m.id !== activeMindMapId);
    setActiveMindMap(remaining.length > 0 ? remaining[0].id : null);
  };

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-bg-primary shrink-0 flex-wrap"
      style={{ paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))' }}
    >
      {/* Mind map selector */}
      <div className="relative">
        <button
          onClick={() => setShowSelector((s) => !s)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-text-primary truncate max-w-[180px]"
          style={{ boxShadow: NEU.raisedSm }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="3" x2="12" y2="9" />
            <line x1="12" y1="15" x2="12" y2="21" />
            <line x1="3" y1="12" x2="9" y2="12" />
            <line x1="15" y1="12" x2="21" y2="12" />
          </svg>
          <span className="truncate">{activeMindMap?.title || t('mindmap.select')}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <AnimatePresence>
          {showSelector && (
            <>
              <motion.div
                className="fixed inset-0 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setShowSelector(false); setShowNewInput(false); }}
              />
              <motion.div
                className="absolute left-0 top-full mt-1 z-50 rounded-xl bg-bg-card p-2 min-w-[200px] max-h-[300px] overflow-y-auto"
                style={{ boxShadow: NEU.raised }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                {mindMaps.map((mm) => (
                  <button
                    key={mm.id}
                    onClick={() => { setActiveMindMap(mm.id); setShowSelector(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                      mm.id === activeMindMapId ? 'text-accent font-medium' : 'text-text-secondary hover:text-text-primary'
                    }`}
                    style={mm.id === activeMindMapId ? { boxShadow: NEU.pressedSm } : undefined}
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: mm.color }} />
                    <span className="truncate">{mm.title}</span>
                  </button>
                ))}

                {showNewInput ? (
                  <div className="flex gap-1.5 px-2 py-1.5">
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewInput(false); }}
                      placeholder={t('mindmap.titlePlaceholder')}
                      className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none border-b border-border"
                      autoFocus
                    />
                    <button onClick={handleCreate} className="text-accent text-sm font-medium">+</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewInput(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-accent hover:bg-bg-elevated transition-colors"
                  >
                    + {t('mindmap.new')}
                  </button>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Add child */}
      <button
        onClick={onAddChild}
        disabled={!selectedNodeId}
        className="px-2 py-1.5 rounded-lg text-xs font-medium text-text-secondary disabled:opacity-30 transition-opacity"
        style={{ boxShadow: NEU.raisedSm }}
        title={t('mindmap.addChild')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Delete node */}
      <button
        onClick={onDeleteNode}
        disabled={!selectedNodeId || selectedNodeId === activeMindMap?.rootNodeId}
        className="px-2 py-1.5 rounded-lg text-xs font-medium text-text-secondary disabled:opacity-30 transition-opacity"
        style={{ boxShadow: NEU.raisedSm }}
        title={t('mindmap.deleteNode')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Mind Unload toggle */}
      <button
        onClick={() => setMindUnloadActive(!mindUnloadActive)}
        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          mindUnloadActive ? 'text-accent' : 'text-text-secondary'
        }`}
        style={{ boxShadow: mindUnloadActive ? NEU.pressedSm : NEU.raisedSm }}
        title={t('mindmap.mindUnload')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 3-2 5.5-4 7l-1 4H10l-1-4c-2-1.5-4-4-4-7a7 7 0 0 1 7-7z" />
          <line x1="10" y1="22" x2="14" y2="22" />
        </svg>
      </button>

      {/* Timer toggle */}
      <button
        onClick={() => setTimerVisible(!timerVisible)}
        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          timerVisible ? 'text-accent' : 'text-text-secondary'
        }`}
        style={{ boxShadow: timerVisible ? NEU.pressedSm : NEU.raisedSm }}
        title={t('mindmap.timer')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {/* Export dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowExport((s) => !s)}
          disabled={!activeMindMap}
          className="px-2 py-1.5 rounded-lg text-xs font-medium text-text-secondary disabled:opacity-30 transition-opacity"
          style={{ boxShadow: NEU.raisedSm }}
          title={t('mindmap.export')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>

        <AnimatePresence>
          {showExport && activeMindMap && (
            <>
              <motion.div
                className="fixed inset-0 z-40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowExport(false)}
              />
              <motion.div
                className="absolute right-0 top-full mt-1 z-50 rounded-xl bg-bg-card p-1.5 min-w-[140px]"
                style={{ boxShadow: NEU.raised }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
              >
                <button
                  onClick={() => { exportFreeMind(activeMindMap); setShowExport(false); }}
                  className="w-full px-3 py-2 rounded-lg text-sm text-left text-text-secondary hover:text-text-primary transition-colors"
                >
                  FreeMind (.mm)
                </button>
                <button
                  onClick={() => { exportMarkdown(activeMindMap); setShowExport(false); }}
                  className="w-full px-3 py-2 rounded-lg text-sm text-left text-text-secondary hover:text-text-primary transition-colors"
                >
                  Markdown (.md)
                </button>
                <button
                  onClick={() => { exportJSON(activeMindMap); setShowExport(false); }}
                  className="w-full px-3 py-2 rounded-lg text-sm text-left text-text-secondary hover:text-text-primary transition-colors"
                >
                  JSON (.json)
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Delete mind map */}
      {activeMindMap && (
        <button
          onClick={handleDelete}
          className="px-2 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-red transition-colors"
          title={t('mindmap.deleteMindMap')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}
