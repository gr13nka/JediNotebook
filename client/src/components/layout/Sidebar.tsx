import { useState, useCallback, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { create } from 'zustand';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { ContextMenu } from '../ui/ContextMenu';

// Shared sidebar state so AppShell can react to it
export const useSidebarStore = create<{
  collapsed: boolean;
  toggle: () => void;
}>((set) => ({
  collapsed: false,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
}));

const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
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

const GearIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const CollapseIcon = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: collapsed ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}
  >
    <polyline points="11 17 6 12 11 7" />
    <polyline points="18 17 13 12 18 7" />
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

// Tabs that cannot be hidden (always visible)
const PROTECTED_TABS = new Set<string>();

export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const { t } = useTranslation();
  const hiddenNavTabs = useSettingsStore((s) => s.hiddenNavTabs);
  const navTabOrder = useSettingsStore((s) => s.navTabOrder);
  const hideTab = useSettingsStore((s) => s.hideTab);
  const showTab = useSettingsStore((s) => s.showTab);
  const reorderTabs = useSettingsStore((s) => s.reorderTabs);
  const timeTrackingVisible = useSettingsStore((s) => s.timeTrackingVisible);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tab: string } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'above' | 'below' } | null>(null);

  const allNavItems = useMemo(() => [
    ...(timeTrackingVisible ? [{ to: '/', label: t('nav.tracking'), icon: ClockIcon }] : []),
    { to: '/projects', label: t('nav.projects'), icon: FolderIcon },
    { to: '/tasks', label: t('nav.taskSelection'), icon: ListIcon },
    { to: '/today', label: t('nav.today'), icon: SunIcon },
    { to: '/inbox', label: t('nav.inbox'), icon: InboxIcon },
    { to: '/settings', label: t('nav.settings'), icon: GearIcon },
  ], [t, timeTrackingVisible]);

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
    if (hiddenNavTabs.includes(tab)) {
      showTab(tab);
    } else {
      hideTab(tab);
    }
  }, [hiddenNavTabs, showTab, hideTab]);

  const handleReorder = useCallback((fromIdx: number, toIdx: number, position: 'above' | 'below') => {
    if (fromIdx === toIdx) return;
    const defaultOrder = allNavItems.map((item) => item.to);
    const currentOrder = navTabOrder.length >= defaultOrder.length ? [...navTabOrder] : [...defaultOrder];
    const movedRoute = visibleNavItems[fromIdx].to;
    const targetRoute = visibleNavItems[toIdx].to;
    currentOrder.splice(currentOrder.indexOf(movedRoute), 1);
    const ti = currentOrder.indexOf(targetRoute);
    currentOrder.splice(position === 'above' ? ti : ti + 1, 0, movedRoute);
    reorderTabs(currentOrder);
  }, [allNavItems, navTabOrder, visibleNavItems, reorderTabs]);

  const contextMenuItems = useMemo(() => {
    if (!ctxMenu) return [];
    const items = [];
    const tab = ctxMenu.tab;

    // Hide this tab (only if not protected)
    if (!PROTECTED_TABS.has(tab)) {
      items.push({
        label: t('nav.hideTab'),
        onClick: () => toggleTabVisibility(tab),
      });
    }

    // Show hidden tabs
    for (const hidden of hiddenItems) {
      items.push({
        label: `${t('nav.showTab')} "${hidden.label}"`,
        onClick: () => toggleTabVisibility(hidden.to),
      });
    }

    return items;
  }, [ctxMenu, t, hiddenItems, toggleTabVisibility]);

  return (
    <motion.aside
      className="hidden md:flex flex-col min-h-screen-safe bg-bg-primary shrink-0"
      style={{ boxShadow: NEU.sidebarRight }}
      animate={{ width: collapsed ? 56 : 224 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
    >
      <div className="flex items-center justify-between p-4 mb-4">
        <AnimatePresence>
          {!collapsed && (
            <motion.h1
              className="text-lg font-bold text-text-primary whitespace-nowrap overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {t('nav.brand')}
            </motion.h1>
          )}
        </AnimatePresence>
        <button
          onClick={toggle}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors shrink-0"
          style={{ boxShadow: NEU.raisedSm }}
        >
          <CollapseIcon collapsed={collapsed} />
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-2">
        {visibleNavItems.map((item, idx) => (
          <div
            key={item.to}
            className="relative group"
            draggable={!collapsed}
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
              end={item.to === '/'}
              draggable={false}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-200 ease-[var(--ease-smooth)] ${
                  collapsed ? 'px-2 py-2.5 justify-center' : 'px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-bg-primary text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`
              }
              style={({ isActive }) =>
                isActive ? { boxShadow: NEU.pressed } : {}
              }
              title={collapsed ? item.label : undefined}
              onContextMenu={(e) => handleContextMenu(e, item.to)}
            >
              {({ isActive }) => (
                <>
                  {isActive && !collapsed && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-accent" />
                  )}
                  <item.icon />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && (
                    <div className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-text-muted">
                      <DragDotsIcon />
                    </div>
                  )}
                </>
              )}
            </NavLink>
            {dropTarget?.index === idx && dropTarget.position === 'below' && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full z-10" />
            )}
          </div>
        ))}
      </nav>

      {/* Hidden tabs restore button */}
      {hiddenItems.length > 0 && (
        <div className="px-2 mt-2">
          <button
            onClick={() => setShowHidden((s) => !s)}
            className={`flex items-center gap-3 w-full rounded-lg text-sm text-text-muted hover:text-text-secondary transition-colors ${
              collapsed ? 'px-2 py-2 justify-center' : 'px-3 py-2'
            }`}
            title={collapsed ? t('nav.hiddenTabs') : undefined}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            {!collapsed && (
              <>
                <span>{t('nav.hiddenTabs')}</span>
                <span className="ml-auto text-xs tabular-nums">{hiddenItems.length}</span>
              </>
            )}
          </button>
          <AnimatePresence initial={false}>
            {showHidden && !collapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                {hiddenItems.map((item) => (
                  <button
                    key={item.to}
                    onClick={() => toggleTabVisibility(item.to)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-auto pt-4 px-4 flex flex-col gap-2">
        {!collapsed && <span className="text-xs text-text-muted/50">v1.0</span>}
      </div>

      <ContextMenu items={contextMenuItems} position={ctxMenu} onClose={closeCtxMenu} />
    </motion.aside>
  );
}
