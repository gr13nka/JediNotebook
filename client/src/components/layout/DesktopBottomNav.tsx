import { useState, useCallback, useMemo, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import { useNavTabs } from '../../hooks/useNavTabs';
import { ContextMenu } from '../ui/ContextMenu';
import { DragDotsIcon } from './navItems';

export function DesktopBottomNav() {
  const { t } = useTranslation();
  const { visibleNavItems, hiddenItems, toggleTabVisibility, handleReorder, getContextMenuItems } = useNavTabs();

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tab: string } | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'left' | 'right' } | null>(null);

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
                  handleReorder(dragIdx.current, dropTarget.index, dropTarget.position === 'left' ? 'before' : 'after');
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
                    isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  }`
                }
                style={({ isActive }) =>
                  isActive ? { boxShadow: NEU.pressedSm } : {}
                }
                onContextMenu={(e) => handleContextMenu(e, item.to)}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
                <div className="shrink-0 can-hover:opacity-0 can-hover:group-hover:opacity-100 transition-opacity cursor-grab text-text-muted ml-1">
                  <DragDotsIcon size={10} />
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
                          <item.icon size={18} />
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
