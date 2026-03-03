import { useState, useCallback, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { ContextMenu } from '../ui/ContextMenu';

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const HabitIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ChartIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
);

const NoteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const InboxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const FolderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MindMapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="3" x2="12" y2="9" />
    <line x1="12" y1="15" x2="12" y2="21" />
    <line x1="3" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="21" y2="12" />
  </svg>
);

const ReviewIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M9 14l2 2 4-4" />
  </svg>
);

const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const DragDotsIcon = () => (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
    <circle cx="5" cy="3" r="1.2" />
    <circle cx="11" cy="3" r="1.2" />
    <circle cx="5" cy="8" r="1.2" />
    <circle cx="11" cy="8" r="1.2" />
    <circle cx="5" cy="13" r="1.2" />
    <circle cx="11" cy="13" r="1.2" />
  </svg>
);

const PROTECTED_TABS = new Set<string>();

export function DesktopBottomNav() {
  const { t } = useTranslation();
  const hiddenNavTabs = useSettingsStore((s) => s.hiddenNavTabs);
  const navTabOrder = useSettingsStore((s) => s.navTabOrder);
  const update = useSettingsStore((s) => s.update);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tab: string } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'left' | 'right' } | null>(null);

  const allNavItems = useMemo(() => [
    { to: '/', label: t('nav.tracking'), icon: ClockIcon },
    { to: '/projects', label: t('nav.projects'), icon: FolderIcon },
    { to: '/tasks', label: t('nav.taskSelection'), icon: ListIcon },
    { to: '/today', label: t('nav.today'), icon: SunIcon },
    { to: '/inbox', label: t('nav.inbox'), icon: InboxIcon },
    { to: '/mindmap', label: t('nav.mindmap'), icon: MindMapIcon },
    { to: '/habits', label: t('nav.habits'), icon: HabitIcon },
    { to: '/analytics', label: t('nav.analytics'), icon: ChartIcon },
    { to: '/notes', label: t('nav.ideas'), icon: NoteIcon },
    { to: '/review', label: t('nav.review'), icon: ReviewIcon },
    { to: '/settings', label: t('nav.settings'), icon: GearIcon },
  ], [t]);

  const visibleNavItems = useMemo(() => {
    const filtered = allNavItems.filter((item) => !hiddenNavTabs.includes(item.to));
    if (!navTabOrder.length) return filtered;
    const m = new Map(navTabOrder.map((p, i) => [p, i]));
    return [...filtered].sort((a, b) => (m.get(a.to) ?? 999) - (m.get(b.to) ?? 999));
  }, [allNavItems, hiddenNavTabs, navTabOrder]);

  const hiddenItems = useMemo(
    () => allNavItems.filter((item) => hiddenNavTabs.includes(item.to)),
    [allNavItems, hiddenNavTabs],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, tab });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const toggleTabVisibility = useCallback((tab: string) => {
    const current = hiddenNavTabs;
    if (current.includes(tab)) {
      update({ hiddenNavTabs: current.filter((t) => t !== tab) });
    } else {
      update({ hiddenNavTabs: [...current, tab] });
    }
  }, [hiddenNavTabs, update]);

  const handleReorder = useCallback((fromIdx: number, toIdx: number, position: 'left' | 'right') => {
    if (fromIdx === toIdx) return;
    const defaultOrder = allNavItems.map((item) => item.to);
    const currentOrder = navTabOrder.length >= defaultOrder.length ? [...navTabOrder] : [...defaultOrder];
    const movedRoute = visibleNavItems[fromIdx].to;
    const targetRoute = visibleNavItems[toIdx].to;
    currentOrder.splice(currentOrder.indexOf(movedRoute), 1);
    const ti = currentOrder.indexOf(targetRoute);
    currentOrder.splice(position === 'left' ? ti : ti + 1, 0, movedRoute);
    update({ navTabOrder: currentOrder });
  }, [allNavItems, navTabOrder, visibleNavItems, update]);

  const contextMenuItems = useMemo(() => {
    if (!ctxMenu) return [];
    const items = [];
    const tab = ctxMenu.tab;

    if (!PROTECTED_TABS.has(tab)) {
      items.push({
        label: t('nav.hideTab'),
        onClick: () => toggleTabVisibility(tab),
      });
    }

    for (const hidden of hiddenItems) {
      items.push({
        label: `${t('nav.showTab')} "${hidden.label}"`,
        onClick: () => toggleTabVisibility(hidden.to),
      });
    }

    return items;
  }, [ctxMenu, t, hiddenItems, toggleTabVisibility]);

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 hidden md:flex bg-bg-primary"
        style={{ boxShadow: NEU.bottomNavUp, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around w-full h-14">
          {visibleNavItems.map((item, idx) => (
            <div
              key={item.to}
              className="relative group flex items-center"
              draggable
              onDragStart={(e) => {
                dragIdx.current = idx;
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', item.to);
              }}
              onDragEnd={() => {
                dragIdx.current = null;
                setDropTarget(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragIdx.current === null || dragIdx.current === idx) {
                  if (dropTarget?.index === idx) setDropTarget(null);
                  return;
                }
                const rect = e.currentTarget.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                setDropTarget({ index: idx, position: e.clientX < midX ? 'left' : 'right' });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIdx.current !== null && dropTarget) {
                  handleReorder(dragIdx.current, dropTarget.index, dropTarget.position);
                }
                dragIdx.current = null;
                setDropTarget(null);
              }}
            >
              {dropTarget?.index === idx && dropTarget.position === 'left' && (
                <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent rounded-full z-10" />
              )}
              <NavLink
                to={item.to}
                end={item.to === '/'}
                draggable={false}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    isActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { boxShadow: NEU.pressedSm } : {}
                }
                onContextMenu={(e) => handleContextMenu(e, item.to)}
              >
                <item.icon />
                <span>{item.label}</span>
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-text-muted ml-1">
                  <DragDotsIcon />
                </div>
              </NavLink>
              {dropTarget?.index === idx && dropTarget.position === 'right' && (
                <div className="absolute right-0 top-2 bottom-2 w-0.5 bg-accent rounded-full z-10" />
              )}
            </div>
          ))}

          {/* Hidden tabs restore button */}
          {hiddenItems.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowHidden((s) => !s)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-secondary transition-colors"
                title={t('nav.hiddenTabs')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
                <span className="text-xs tabular-nums">{hiddenItems.length}</span>
              </button>
              <AnimatePresence>
                {showHidden && (
                  <>
                    <motion.div
                      className="fixed inset-0 z-40"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowHidden(false)}
                    />
                    <motion.div
                      className="absolute bottom-full mb-2 right-0 z-50 rounded-xl bg-bg-card p-2 min-w-[160px]"
                      style={{ boxShadow: NEU.raised }}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="text-xs text-text-muted px-3 py-1.5 font-medium">{t('nav.hiddenTabs')}</div>
                      {hiddenItems.map((item) => (
                        <button
                          key={item.to}
                          onClick={() => {
                            toggleTabVisibility(item.to);
                            setShowHidden(false);
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
                        >
                          <item.icon />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </nav>

      <ContextMenu items={contextMenuItems} position={ctxMenu} onClose={closeCtxMenu} />
    </>
  );
}
