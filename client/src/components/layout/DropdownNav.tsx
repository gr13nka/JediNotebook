import React, { useState, useCallback, useMemo, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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

const MindMapIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="3" x2="12" y2="9" />
    <line x1="12" y1="15" x2="12" y2="21" />
    <line x1="3" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="21" y2="12" />
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

type FabCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
const DRAG_THRESHOLD = 8;

const PROTECTED_TABS = new Set<string>();

const iconMap: Record<string, React.FC> = {
  '/': ClockIcon,
  '/projects': FolderIcon,
  '/tasks': ListIcon,
  '/today': SunIcon,
  '/inbox': InboxIcon,
  '/mindmap': MindMapIcon,
  '/habits': HabitIcon,
  '/analytics': ChartIcon,
  '/notes': NoteIcon,
  '/review': ReviewIcon,
  '/settings': GearIcon,
};

export function DropdownNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const hiddenNavTabs = useSettingsStore((s) => s.hiddenNavTabs);
  const navTabOrder = useSettingsStore((s) => s.navTabOrder);
  const update = useSettingsStore((s) => s.update);

  const [open, setOpen] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tab: string } | null>(null);
  const dragIdx = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'above' | 'below' } | null>(null);

  // FAB drag-to-corner state
  const fabCorner = (useSettingsStore((s) => s.dropdownFabCorner) || 'bottom-right') as FabCorner;
  const [fabDragPos, setFabDragPos] = useState<{ x: number; y: number } | null>(null);
  const fabDragging = useRef(false);
  const fabDragOffset = useRef({ x: 0, y: 0 });
  const fabStartPointer = useRef({ x: 0, y: 0 });

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

  // Find the current page's icon for the FAB
  const CurrentIcon = useMemo(() => {
    const match = allNavItems.find((item) =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
    );
    return match?.icon ?? ClockIcon;
  }, [allNavItems, location.pathname]);

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

  const handleReorder = useCallback((fromIdx: number, toIdx: number, position: 'above' | 'below') => {
    if (fromIdx === toIdx) return;
    const defaultOrder = allNavItems.map((item) => item.to);
    const currentOrder = navTabOrder.length >= defaultOrder.length ? [...navTabOrder] : [...defaultOrder];
    const movedRoute = visibleNavItems[fromIdx].to;
    const targetRoute = visibleNavItems[toIdx].to;
    currentOrder.splice(currentOrder.indexOf(movedRoute), 1);
    const ti = currentOrder.indexOf(targetRoute);
    currentOrder.splice(position === 'above' ? ti : ti + 1, 0, movedRoute);
    update({ navTabOrder: currentOrder });
  }, [allNavItems, navTabOrder, visibleNavItems, update]);

  // FAB pointer handlers for drag-to-corner
  const handleFabPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    fabDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    fabStartPointer.current = { x: e.clientX, y: e.clientY };
    fabDragging.current = false;
  }, []);

  const handleFabPointerMove = useCallback((e: React.PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - fabStartPointer.current.x;
    const dy = e.clientY - fabStartPointer.current.y;
    if (!fabDragging.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    if (!fabDragging.current) {
      fabDragging.current = true;
      if (open) setOpen(false);
    }
    setFabDragPos({
      x: e.clientX - fabDragOffset.current.x,
      y: e.clientY - fabDragOffset.current.y,
    });
  }, [open]);

  const handleFabPointerUp = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (!fabDragging.current) {
      setOpen((s) => !s);
    } else {
      if (fabDragPos) {
        const cx = fabDragPos.x + 28;
        const cy = fabDragPos.y + 28;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isRight = cx > w / 2;
        const isBottom = cy > h / 2;
        const newCorner = `${isBottom ? 'bottom' : 'top'}-${isRight ? 'right' : 'left'}` as FabCorner;
        if (newCorner !== fabCorner) {
          update({ dropdownFabCorner: newCorner });
        }
      }
      setFabDragPos(null);
    }
    fabDragging.current = false;
  }, [fabDragPos, fabCorner, update]);

  // FAB and popup position styles
  const fabPositionStyle: React.CSSProperties = fabDragPos
    ? { left: fabDragPos.x, top: fabDragPos.y, right: 'auto', bottom: 'auto' }
    : {
        ...(fabCorner.startsWith('bottom')
          ? { bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }
          : { top: 'calc(20px + env(safe-area-inset-top, 0px))' }),
        ...(fabCorner.endsWith('right') ? { right: 16 } : { left: 16 }),
      };

  const popupPositionStyle: React.CSSProperties = {
    ...(fabCorner.startsWith('bottom')
      ? { bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }
      : { top: 'calc(80px + env(safe-area-inset-top, 0px))' }),
    ...(fabCorner.endsWith('right') ? { right: 16 } : { left: 16 }),
  };

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
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Popup menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed z-[70] rounded-2xl bg-bg-card p-2 min-w-[200px] max-h-[70vh] overflow-y-auto"
            style={{ boxShadow: NEU.raised, ...popupPositionStyle }}
            initial={{ opacity: 0, scale: 0.9, y: fabCorner.startsWith('bottom') ? 16 : -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: fabCorner.startsWith('bottom') ? 16 : -16 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {visibleNavItems.map((item, idx) => {
              const isActive = item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to);
              return (
                <div
                  key={item.to}
                  className="relative group"
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
                    const midY = rect.top + rect.height / 2;
                    setDropTarget({ index: idx, position: e.clientY < midY ? 'above' : 'below' });
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
                  {dropTarget?.index === idx && dropTarget.position === 'above' && (
                    <div className="absolute top-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10" />
                  )}
                  <NavLink
                    to={item.to}
                    draggable={false}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors ${
                      isActive ? 'text-accent font-medium' : 'text-text-secondary hover:text-text-primary'
                    }`}
                    style={isActive ? { boxShadow: NEU.pressedSm } : undefined}
                    onContextMenu={(e) => handleContextMenu(e, item.to)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    <div className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-text-muted">
                      <DragDotsIcon />
                    </div>
                  </NavLink>
                  {dropTarget?.index === idx && dropTarget.position === 'below' && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10" />
                  )}
                </div>
              );
            })}

            {/* Hidden tabs section — collapsed, expands on hover */}
            {hiddenItems.length > 0 && (
              <div className="group/hidden">
                <div className="border-t border-border mx-2 my-1" />
                <div className="text-xs text-text-muted px-4 py-1.5 font-medium flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                  {t('nav.hiddenTabs')}
                  <span className="ml-auto text-xs tabular-nums">{hiddenItems.length}</span>
                </div>
                <div className="grid grid-rows-[0fr] group-hover/hidden:grid-rows-[1fr] transition-[grid-template-rows] duration-200">
                  <div className="overflow-hidden">
                    {hiddenItems.map((item) => (
                      <button
                        key={item.to}
                        onClick={() => {
                          toggleTabVisibility(item.to);
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm text-text-muted hover:text-text-primary transition-colors text-left"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB button */}
      <motion.button
        className="fixed z-[60] w-14 h-14 rounded-full bg-bg-card flex items-center justify-center text-text-primary touch-none select-none"
        style={{ boxShadow: NEU.raised, ...fabPositionStyle }}
        animate={{ rotate: open ? 45 : 0 }}
        transition={{ duration: 0.18 }}
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <CurrentIcon />
        )}
      </motion.button>

      <ContextMenu items={contextMenuItems} position={ctxMenu} onClose={closeCtxMenu} />
    </>
  );
}
