import { useState, useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { ContextMenu } from '../ui/ContextMenu';

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

const FolderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const HabitIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const InboxIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

const MoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="12" width="4" height="9" rx="1" />
    <rect x="10" y="7" width="4" height="14" rx="1" />
    <rect x="17" y="3" width="4" height="18" rx="1" />
  </svg>
);

const NoteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const ListIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const MindMapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <line x1="12" y1="3" x2="12" y2="9" />
    <line x1="12" y1="15" x2="12" y2="21" />
    <line x1="3" y1="12" x2="9" y2="12" />
    <line x1="15" y1="12" x2="21" y2="12" />
  </svg>
);

const GearIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const PROTECTED_TABS = new Set<string>();

export function BottomNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { t } = useTranslation();
  const hiddenNavTabs = useSettingsStore((s) => s.hiddenNavTabs);
  const navTabOrder = useSettingsStore((s) => s.navTabOrder);
  const update = useSettingsStore((s) => s.update);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; tab: string } | null>(null);

  const allMainNavItems = useMemo(() => [
    { to: '/', label: t('nav.tracking'), icon: ClockIcon },
    { to: '/today', label: t('nav.today'), icon: SunIcon },
    { to: '/projects', label: t('nav.projects'), icon: FolderIcon },
    { to: '/habits', label: t('nav.habits'), icon: HabitIcon },
  ], [t]);

  const allMoreNavItems = useMemo(() => [
    { to: '/inbox', label: t('nav.inbox'), icon: InboxIcon },
    { to: '/mindmap', label: t('nav.mindmap'), icon: MindMapIcon },
    { to: '/analytics', label: t('nav.analytics'), icon: ChartIcon },
    { to: '/notes', label: t('nav.ideas'), icon: NoteIcon },
    { to: '/tasks', label: t('nav.taskSelection'), icon: ListIcon },
    { to: '/settings', label: t('nav.settings'), icon: GearIcon },
  ], [t]);

  const applyOrder = useCallback(<T extends { to: string }>(items: T[]): T[] => {
    if (!navTabOrder.length) return items;
    const m = new Map(navTabOrder.map((p, i) => [p, i]));
    return [...items].sort((a, b) => (m.get(a.to) ?? 999) - (m.get(b.to) ?? 999));
  }, [navTabOrder]);

  const mainNavItems = useMemo(
    () => applyOrder(allMainNavItems.filter((item) => !hiddenNavTabs.includes(item.to))),
    [allMainNavItems, hiddenNavTabs, applyOrder],
  );

  const moreNavItems = useMemo(
    () => applyOrder(allMoreNavItems.filter((item) => !hiddenNavTabs.includes(item.to))),
    [allMoreNavItems, hiddenNavTabs, applyOrder],
  );

  const allNavItems = useMemo(() => [...allMainNavItems, ...allMoreNavItems], [allMainNavItems, allMoreNavItems]);

  const hiddenItems = useMemo(
    () => allNavItems.filter((item) => hiddenNavTabs.includes(item.to)),
    [allNavItems, hiddenNavTabs],
  );

  const moreRoutes = moreNavItems.map((item) => item.to);

  const isMoreActive = moreRoutes.some((r) =>
    r === '/' ? location.pathname === '/' : location.pathname.startsWith(r),
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
      <AnimatePresence>
        {showMore && (
          <>
            <motion.div
              className="fixed inset-0 z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMore(false)}
            />
            <motion.div
              className="fixed bottom-14 right-2 z-50 rounded-2xl bg-bg-card p-2 md:hidden"
              style={{ boxShadow: NEU.raised }}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              {moreNavItems.map((item) => {
                const isActive = item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setShowMore(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors ${
                      isActive ? 'text-accent font-medium' : 'text-text-secondary'
                    }`}
                    style={isActive ? { boxShadow: NEU.pressedSm } : undefined}
                    onContextMenu={(e) => handleContextMenu(e, item.to)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}

              {/* Hidden tabs section */}
              {hiddenItems.length > 0 && (
                <>
                  <div className="border-t border-border mx-2 my-1" />
                  <div className="text-xs text-text-muted px-4 py-1.5 font-medium flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                    {t('nav.hiddenTabs')}
                  </div>
                  {hiddenItems.map((item) => (
                    <button
                      key={item.to}
                      onClick={() => {
                        toggleTabVisibility(item.to);
                        setShowMore(false);
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-text-muted hover:text-text-primary transition-colors w-full text-left"
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-bg-primary md:hidden"
        style={{ boxShadow: NEU.bottomNavUp }}
      >
        <div className="flex items-center justify-around h-14 relative">
          {mainNavItems.map((item) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs transition-colors duration-200 relative"
                onContextMenu={(e) => handleContextMenu(e, item.to)}
              >
                <motion.div
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className={isActive ? 'text-accent' : 'text-text-muted'}
                >
                  <item.icon />
                </motion.div>
                <span className={isActive ? 'text-accent font-medium' : 'text-text-muted'}>
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="bottomnav-indicator"
                    className="absolute -bottom-1.5 w-8 h-[3px] rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}

          <button
            onClick={() => setShowMore((s) => !s)}
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs transition-colors duration-200 relative"
          >
            <motion.div
              animate={{ scale: isMoreActive ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={isMoreActive ? 'text-accent' : 'text-text-muted'}
            >
              <MoreIcon />
            </motion.div>
            <span className={isMoreActive ? 'text-accent font-medium' : 'text-text-muted'}>
              {t('nav.more')}
            </span>
            {isMoreActive && (
              <motion.div
                layoutId="bottomnav-indicator"
                className="absolute -bottom-1.5 w-8 h-[3px] rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        </div>
      </nav>

      <ContextMenu items={contextMenuItems} position={ctxMenu} onClose={closeCtxMenu} />
    </>
  );
}
