import { useState, useCallback, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { create } from 'zustand';
import { useTranslation } from '../../i18n/useTranslation';
import { useNavTabs } from '../../hooks/useNavTabs';
import { ContextMenu } from '../ui/ContextMenu';
import { DragDotsIcon } from './navItems';

// Shared sidebar state so AppShell can react to it
export const useSidebarStore = create<{
  collapsed: boolean;
  toggle: () => void;
}>((set) => ({
  collapsed: false,
  toggle: () => set((s) => ({ collapsed: !s.collapsed })),
}));

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

export function Sidebar() {
  const collapsed = useSidebarStore((s) => s.collapsed);
  const toggle = useSidebarStore((s) => s.toggle);
  const { t } = useTranslation();
  const { visibleNavItems, hiddenItems, toggleTabVisibility, handleReorder, getContextMenuItems } = useNavTabs();

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tab: string } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'above' | 'below' } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: string) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, tab });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const contextMenuItems = useMemo(
    () => (ctxMenu ? getContextMenuItems(ctxMenu.tab) : []),
    [ctxMenu, getContextMenuItems],
  );

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
                handleReorder(dragIdx.current, dropTarget.index, dropTarget.position === 'above' ? 'before' : 'after');
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
                  <item.icon size={18} />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && (
                    <div className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-text-muted">
                      <DragDotsIcon size={10} />
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
                    <item.icon size={18} />
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
