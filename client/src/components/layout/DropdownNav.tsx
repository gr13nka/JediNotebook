import React, { useState, useCallback, useMemo, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { useNavTabs } from '../../hooks/useNavTabs';
import { ContextMenu } from '../ui/ContextMenu';
import { ClockIcon, DragDotsIcon } from './navItems';

type FabCorner = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
const DRAG_THRESHOLD = 8;

export function DropdownNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const update = useSettingsStore((s) => s.update);
  const { allNavItems, visibleNavItems, hiddenItems, toggleTabVisibility, handleReorder, getContextMenuItems } = useNavTabs();

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

  const contextMenuItems = useMemo(
    () => (ctxMenu ? getContextMenuItems(ctxMenu.tab) : []),
    [ctxMenu, getContextMenuItems],
  );

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
                    draggable={false}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors ${
                      isActive ? 'text-text-primary font-medium' : 'text-text-secondary hover:text-text-primary'
                    }`}
                    style={isActive ? { boxShadow: NEU.pressedSm } : undefined}
                    onContextMenu={(e) => handleContextMenu(e, item.to)}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                    <div className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-text-muted">
                      <DragDotsIcon size={10} />
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
                        <item.icon size={18} />
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
          <CurrentIcon size={18} />
        )}
      </motion.button>

      <ContextMenu items={contextMenuItems} position={ctxMenu} onClose={closeCtxMenu} />
    </>
  );
}
