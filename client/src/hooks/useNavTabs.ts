import { useCallback, useMemo } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import { useSettingsStore } from '../stores/settingsStore';
import { ALL_NAV_ITEMS, type NavItem } from '../components/layout/navItems';
import type { ContextMenuItem } from '../components/ui/ContextMenu';

// Tabs that cannot be hidden (always visible)
const PROTECTED_TABS = new Set<string>();

export interface ResolvedNavItem extends NavItem {
  label: string;
}

export function useNavTabs() {
  const { t } = useTranslation();
  const hiddenNavTabs = useSettingsStore((s) => s.hiddenNavTabs);
  const navTabOrder = useSettingsStore((s) => s.navTabOrder);
  const hideTab = useSettingsStore((s) => s.hideTab);
  const showTab = useSettingsStore((s) => s.showTab);
  const reorderTabs = useSettingsStore((s) => s.reorderTabs);
  const timeTrackingVisible = useSettingsStore((s) => s.timeTrackingVisible);

  const allNavItems = useMemo<ResolvedNavItem[]>(
    () =>
      ALL_NAV_ITEMS.filter((item) => timeTrackingVisible || item.to !== '/').map((item) => ({
        ...item,
        label: t(item.labelKey),
      })),
    [t, timeTrackingVisible],
  );

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

  const toggleTabVisibility = useCallback((tab: string) => {
    if (hiddenNavTabs.includes(tab)) {
      showTab(tab);
    } else {
      hideTab(tab);
    }
  }, [hiddenNavTabs, showTab, hideTab]);

  const handleReorder = useCallback((fromIdx: number, toIdx: number, position: 'before' | 'after') => {
    if (fromIdx === toIdx) return;
    const defaultOrder = allNavItems.map((item) => item.to);
    const currentOrder = navTabOrder.length >= defaultOrder.length ? [...navTabOrder] : [...defaultOrder];
    const movedRoute = visibleNavItems[fromIdx].to;
    const targetRoute = visibleNavItems[toIdx].to;
    currentOrder.splice(currentOrder.indexOf(movedRoute), 1);
    const ti = currentOrder.indexOf(targetRoute);
    currentOrder.splice(position === 'before' ? ti : ti + 1, 0, movedRoute);
    reorderTabs(currentOrder);
  }, [allNavItems, navTabOrder, visibleNavItems, reorderTabs]);

  const getContextMenuItems = useCallback((tab: string): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

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
  }, [t, hiddenItems, toggleTabVisibility]);

  return {
    allNavItems,
    visibleNavItems,
    hiddenItems,
    toggleTabVisibility,
    handleReorder,
    getContextMenuItems,
  };
}
