import { useState, useMemo, useRef, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { BottomSheet } from '../ui/BottomSheet';
import { ALL_NAV_ITEMS, NAV_ITEM_MAP, type NavItem } from './navItems';

const MoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

function NavTab({ item, isActive, label, indicatorId }: { item: NavItem; isActive: boolean; label: string; indicatorId: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 relative">
      <motion.div
        animate={{ scale: isActive ? 1.1 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={isActive ? 'text-text-primary' : 'text-text-muted'}
      >
        <item.icon />
      </motion.div>
      <span className={`truncate max-w-full text-center leading-tight ${isActive ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
        {label}
      </span>
      {isActive && (
        <motion.div
          layoutId={indicatorId}
          className="absolute -bottom-1 w-8 h-[3px] rounded-full bg-accent"
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
    </div>
  );
}

function ScrollableBottomNav() {
  const location = useLocation();
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const bottomNavPages = useSettingsStore((s) => s.bottomNavPages);
  const timeTrackingVisible = useSettingsStore((s) => s.timeTrackingVisible);

  // Resolve route paths to NavItem objects, filtering out any unknown routes
  const pages = useMemo(() => {
    return bottomNavPages
      .map((pagePaths) =>
        pagePaths
          .map((path) => NAV_ITEM_MAP.get(path))
          .filter((item): item is NavItem => !!item && (timeTrackingVisible || item.to !== '/'))
      )
      .filter((page) => page.length > 0);
  }, [bottomNavPages, timeTrackingVisible]);

  const isRouteActive = useCallback((to: string) => {
    return to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
  }, [location.pathname]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    if (clientWidth > 0) {
      setCurrentPage(Math.round(scrollLeft / clientWidth));
    }
  }, []);

  // Tap a dot to scroll to that page
  const scrollToPage = useCallback((pageIdx: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ left: pageIdx * scrollRef.current.clientWidth, behavior: 'smooth' });
  }, []);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-primary md:hidden"
      style={{ boxShadow: NEU.bottomNavUp, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {pages.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-1.5 pb-0.5">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToPage(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                i === currentPage ? 'bg-accent' : 'bg-text-muted/30'
              }`}
            />
          ))}
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
      >
        {pages.map((page, pageIdx) => (
          <div
            key={pageIdx}
            className="flex items-center h-12 min-w-full snap-start px-2"
          >
            {page.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex-1 flex items-center justify-center py-1 text-[11px] min-w-0"
              >
                <NavTab
                  item={item}
                  isActive={isRouteActive(item.to)}
                  label={t(item.shortLabelKey ?? item.labelKey)}
                  indicatorId={`bottomnav-page-${pageIdx}`}
                />
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}

function ClassicBottomNav() {
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { t } = useTranslation();
  const bottomNavTabs = useSettingsStore((s) => s.bottomNavTabs);
  const timeTrackingVisible = useSettingsStore((s) => s.timeTrackingVisible);

  const mainNavItems = useMemo(() => {
    return bottomNavTabs
      .map((path) => NAV_ITEM_MAP.get(path))
      .filter((item): item is NavItem => !!item && (timeTrackingVisible || item.to !== '/'));
  }, [bottomNavTabs, timeTrackingVisible]);

  const moreNavItems = useMemo(() => {
    const pinnedSet = new Set(bottomNavTabs);
    return ALL_NAV_ITEMS.filter((item) => !pinnedSet.has(item.to) && (timeTrackingVisible || item.to !== '/'));
  }, [bottomNavTabs, timeTrackingVisible]);

  const moreRoutes = useMemo(
    () => moreNavItems.map((item) => item.to),
    [moreNavItems],
  );

  const isMoreActive = moreRoutes.some((r) =>
    r === '/' ? location.pathname === '/' : location.pathname.startsWith(r),
  );

  return (
    <>
      <BottomSheet
        open={showMore}
        onClose={() => setShowMore(false)}
        title={t('nav.more')}
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
          className={`flex items-center gap-4 px-4 min-h-[48px] rounded-xl text-sm transition-colors ${
                isActive ? 'text-text-primary font-medium' : 'text-text-secondary'
              }`}
              style={isActive ? { boxShadow: NEU.pressedSm } : undefined}
            >
              <item.icon />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          );
        })}
      </BottomSheet>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 bg-bg-primary md:hidden"
        style={{ boxShadow: NEU.bottomNavUp, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center h-14 relative px-2">
          {mainNavItems.map((item) => {
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex-1 flex items-center justify-center py-1.5 text-[11px] min-w-0"
              >
                <NavTab
                  item={item}
                  isActive={isActive}
                  label={t(item.shortLabelKey ?? item.labelKey)}
                  indicatorId="bottomnav-classic"
                />
              </NavLink>
            );
          })}

          <button
            onClick={() => setShowMore((s) => !s)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] min-w-0 relative"
          >
            <motion.div
              animate={{ scale: isMoreActive ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className={isMoreActive ? 'text-text-primary' : 'text-text-muted'}
            >
              <MoreIcon />
            </motion.div>
            <span className={`truncate max-w-full text-center leading-tight ${isMoreActive ? 'text-text-primary font-medium' : 'text-text-muted'}`}>
              {t('nav.more')}
            </span>
            {isMoreActive && (
              <motion.div
                layoutId="bottomnav-classic"
                className="absolute -bottom-1 w-8 h-[3px] rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}

export function BottomNav() {
  const scrollable = useSettingsStore((s) => s.bottomNavScrollable);
  return scrollable ? <ScrollableBottomNav /> : <ClassicBottomNav />;
}
