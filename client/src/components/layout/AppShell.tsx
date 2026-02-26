import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar, useSidebarStore } from './Sidebar';
import { BottomNav } from './BottomNav';
import { DesktopBottomNav } from './DesktopBottomNav';
import { useSettingsStore } from '../../stores/settingsStore';

const WIDE_PAGES = ['/projects', '/tasks', '/notes'];
const FULL_BLEED_PAGES = ['/projects'];
const HIDE_NAV_PAGES: string[] = [];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);
  const collapsed = useSidebarStore((s) => s.collapsed);
  const navPosition = useSettingsStore((s) => s.navPosition);
  const location = useLocation();

  const isWidePage = WIDE_PAGES.some((p) =>
    p === '/' ? location.pathname === '/' : location.pathname.startsWith(p),
  );

  const isFullBleed = FULL_BLEED_PAGES.some((p) => location.pathname.startsWith(p));
  const hideNav = HIDE_NAV_PAGES.some((p) => location.pathname.startsWith(p));

  const desktopBottomNav = navPosition === 'bottom';

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-bg-primary relative">
      {!desktopBottomNav && <Sidebar />}
      <main className={`flex-1 pb-16 ${desktopBottomNav ? 'md:pb-16' : 'md:pb-0'} relative z-10 min-w-0`}>
        {isFullBleed ? (
          <div className="h-full">{children}</div>
        ) : (
          <div className={`mx-auto p-4 md:p-6 ${isWidePage ? 'max-w-6xl' : 'max-w-2xl'}`}>
            {children}
          </div>
        )}
      </main>
      {!hideNav && <BottomNav />}
      {desktopBottomNav && !hideNav && <DesktopBottomNav />}
    </div>
  );
}
