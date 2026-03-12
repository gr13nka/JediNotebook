import { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { Toggle } from '../ui/Toggle';
import { NEU } from '../../utils/shadows';
import type { TranslationKey } from '../../i18n/translations';

interface NavItem {
  to: string;
  labelKey: TranslationKey;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.tracking' },
  { to: '/today', labelKey: 'nav.today' },
  { to: '/projects', labelKey: 'nav.projects' },
  { to: '/habits', labelKey: 'nav.habits' },
  { to: '/inbox', labelKey: 'nav.inbox' },
  { to: '/mindmap', labelKey: 'nav.mindmap' },
  { to: '/notes', labelKey: 'nav.ideas' },
  { to: '/tasks', labelKey: 'nav.taskSelection' },
  { to: '/settings', labelKey: 'nav.settings' },
];

const NAV_ITEM_MAP = new Map(ALL_NAV_ITEMS.map((item) => [item.to, item]));
const MAX_TABS = 5;

// --- Icons ---
const ChevronUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);
const ChevronDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export function BottomNavSettings() {
  const { t } = useTranslation();
  const navPosition = useSettingsStore((s) => s.navPosition);
  const bottomNavTabs = useSettingsStore((s) => s.bottomNavTabs);
  const bottomNavScrollable = useSettingsStore((s) => s.bottomNavScrollable);
  const bottomNavPages = useSettingsStore((s) => s.bottomNavPages);
  const update = useSettingsStore((s) => s.update);

  // Classic mode data
  const pinnedItems = useMemo(() => {
    return bottomNavTabs
      .map((path) => NAV_ITEM_MAP.get(path))
      .filter((item): item is NavItem => !!item);
  }, [bottomNavTabs]);

  const moreItems = useMemo(() => {
    const pinnedSet = new Set(bottomNavTabs);
    return ALL_NAV_ITEMS.filter((item) => !pinnedSet.has(item.to));
  }, [bottomNavTabs]);

  // Scrollable mode data
  const resolvedPages = useMemo(() => {
    return bottomNavPages.map((pagePaths) =>
      pagePaths
        .map((path) => NAV_ITEM_MAP.get(path))
        .filter((item): item is NavItem => !!item)
    );
  }, [bottomNavPages]);

  const availableItems = useMemo(() => {
    const assigned = new Set(bottomNavPages.flat());
    return ALL_NAV_ITEMS.filter((item) => !assigned.has(item.to));
  }, [bottomNavPages]);

  if (navPosition === 'dropdown') return null;

  const isFull = bottomNavTabs.length >= MAX_TABS;

  // --- Classic mode helpers ---
  const moveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...bottomNavTabs];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    update({ bottomNavTabs: next });
  };

  const moveDown = (index: number) => {
    if (index >= bottomNavTabs.length - 1) return;
    const next = [...bottomNavTabs];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    update({ bottomNavTabs: next });
  };

  const removeTab = (path: string) => {
    if (bottomNavTabs.length <= 1) return;
    update({ bottomNavTabs: bottomNavTabs.filter((p) => p !== path) });
  };

  const addTab = (path: string) => {
    if (isFull) return;
    update({ bottomNavTabs: [...bottomNavTabs, path] });
  };

  // --- Scrollable mode helpers ---
  const updatePages = (newPages: string[][]) => {
    update({ bottomNavPages: newPages });
  };

  const pageMoveUp = (pageIdx: number, itemIdx: number) => {
    if (itemIdx <= 0) return;
    const newPages = bottomNavPages.map((p) => [...p]);
    [newPages[pageIdx][itemIdx - 1], newPages[pageIdx][itemIdx]] =
      [newPages[pageIdx][itemIdx], newPages[pageIdx][itemIdx - 1]];
    updatePages(newPages);
  };

  const pageMoveDown = (pageIdx: number, itemIdx: number) => {
    if (itemIdx >= bottomNavPages[pageIdx].length - 1) return;
    const newPages = bottomNavPages.map((p) => [...p]);
    [newPages[pageIdx][itemIdx], newPages[pageIdx][itemIdx + 1]] =
      [newPages[pageIdx][itemIdx + 1], newPages[pageIdx][itemIdx]];
    updatePages(newPages);
  };

  const pageRemoveItem = (pageIdx: number, path: string) => {
    const newPages = bottomNavPages.map((p) => [...p]);
    newPages[pageIdx] = newPages[pageIdx].filter((p) => p !== path);
    // Remove empty pages
    updatePages(newPages.filter((p) => p.length > 0));
  };

  const pageAddItem = (pageIdx: number, path: string) => {
    if (bottomNavPages[pageIdx].length >= MAX_TABS) return;
    const newPages = bottomNavPages.map((p) => [...p]);
    newPages[pageIdx] = [...newPages[pageIdx], path];
    updatePages(newPages);
  };

  const addNewPage = () => {
    updatePages([...bottomNavPages, []]);
  };

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-1">{t('settings.bottomNav')}</h3>
      <p className="text-xs text-text-muted mb-3">{t('settings.bottomNavDesc')}</p>

      <div className="flex items-center justify-between mb-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-text-primary">{t('settings.bottomNavScrollable')}</span>
          <span className="text-[11px] text-text-muted">{t('settings.bottomNavScrollableDesc')}</span>
        </div>
        <Toggle
          checked={bottomNavScrollable}
          onChange={(v) => update({ bottomNavScrollable: v })}
        />
      </div>

      {bottomNavScrollable ? (
        /* --- Scrollable page editor --- */
        <div className="flex flex-col gap-4">
          {resolvedPages.map((pageItems, pageIdx) => {
            const isPageFull = bottomNavPages[pageIdx]?.length >= MAX_TABS;
            return (
              <div key={pageIdx}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted/70">
                    {t('settings.bottomNavPage')} {pageIdx + 1}
                  </span>
                  {isPageFull && (
                    <span className="text-xs text-text-muted">{t('settings.bottomNavPageFull')}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  {pageItems.map((item, itemIdx) => (
                    <div
                      key={item.to}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 bg-bg-elevated"
                      style={{ boxShadow: NEU.pressedSm }}
                    >
                      <span className="text-sm text-text-primary flex-1">{t(item.labelKey)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => pageMoveUp(pageIdx, itemIdx)}
                          disabled={itemIdx === 0}
                          className="p-1 rounded-lg text-text-muted disabled:opacity-30 hover:text-text-primary transition-colors"
                          aria-label="Move up"
                        >
                          <ChevronUp />
                        </button>
                        <button
                          onClick={() => pageMoveDown(pageIdx, itemIdx)}
                          disabled={itemIdx === pageItems.length - 1}
                          className="p-1 rounded-lg text-text-muted disabled:opacity-30 hover:text-text-primary transition-colors"
                          aria-label="Move down"
                        >
                          <ChevronDown />
                        </button>
                        <button
                          onClick={() => pageRemoveItem(pageIdx, item.to)}
                          className="p-1 rounded-lg text-text-muted hover:text-red transition-colors"
                          aria-label="Remove"
                        >
                          <XIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* Inline add for this page — show available items */}
                  {!isPageFull && availableItems.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {availableItems.map((item) => (
                        <button
                          key={item.to}
                          onClick={() => pageAddItem(pageIdx, item.to)}
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-secondary bg-bg-card hover:text-accent transition-colors"
                          style={{ boxShadow: NEU.raisedSm }}
                        >
                          <PlusIcon />
                          <span>{t(item.labelKey)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add page button */}
          {availableItems.length > 0 && (
            <button
              onClick={addNewPage}
              className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm text-text-secondary bg-bg-card hover:text-accent transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
            >
              <PlusIcon />
              <span>{t('settings.bottomNavAddPage')}</span>
            </button>
          )}
        </div>
      ) : (
        /* --- Classic pinned/more editor --- */
        <>
          <div className="mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted/70 mb-2 block">
              {t('settings.bottomNavPinned')}
            </span>
            <div className="flex flex-col gap-1.5">
              {pinnedItems.map((item, i) => (
                <div
                  key={item.to}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 bg-bg-elevated"
                  style={{ boxShadow: NEU.pressedSm }}
                >
                  <span className="text-sm text-text-primary flex-1">{t(item.labelKey)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      className="p-1 rounded-lg text-text-muted disabled:opacity-30 hover:text-text-primary transition-colors"
                      aria-label="Move up"
                    >
                      <ChevronUp />
                    </button>
                    <button
                      onClick={() => moveDown(i)}
                      disabled={i === pinnedItems.length - 1}
                      className="p-1 rounded-lg text-text-muted disabled:opacity-30 hover:text-text-primary transition-colors"
                      aria-label="Move down"
                    >
                      <ChevronDown />
                    </button>
                    <button
                      onClick={() => removeTab(item.to)}
                      disabled={bottomNavTabs.length <= 1}
                      className="p-1 rounded-lg text-text-muted disabled:opacity-30 hover:text-red transition-colors"
                      aria-label="Remove"
                    >
                      <XIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted/70">
                {t('settings.bottomNavMore')}
              </span>
              {isFull && (
                <span className="text-xs text-text-muted">{t('settings.bottomNavMaxReached')}</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              {moreItems.map((item) => (
                <div
                  key={item.to}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 bg-bg-card"
                  style={{ boxShadow: NEU.raisedSm }}
                >
                  <span className="text-sm text-text-secondary flex-1">{t(item.labelKey)}</span>
                  <button
                    onClick={() => addTab(item.to)}
                    disabled={isFull}
                    className="p-1 rounded-lg text-text-muted disabled:opacity-30 hover:text-accent transition-colors"
                    aria-label="Add to bar"
                  >
                    <PlusIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
