import { useMemo } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
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
  { to: '/analytics', labelKey: 'nav.analytics' },
  { to: '/notes', labelKey: 'nav.ideas' },
  { to: '/tasks', labelKey: 'nav.taskSelection' },
  { to: '/review', labelKey: 'nav.review' },
  { to: '/settings', labelKey: 'nav.settings' },
];

const NAV_ITEM_MAP = new Map(ALL_NAV_ITEMS.map((item) => [item.to, item]));
const MAX_TABS = 5;

export function BottomNavSettings() {
  const { t } = useTranslation();
  const navPosition = useSettingsStore((s) => s.navPosition);
  const bottomNavTabs = useSettingsStore((s) => s.bottomNavTabs);
  const update = useSettingsStore((s) => s.update);

  const pinnedItems = useMemo(() => {
    return bottomNavTabs
      .map((path) => NAV_ITEM_MAP.get(path))
      .filter((item): item is NavItem => !!item);
  }, [bottomNavTabs]);

  const moreItems = useMemo(() => {
    const pinnedSet = new Set(bottomNavTabs);
    return ALL_NAV_ITEMS.filter((item) => !pinnedSet.has(item.to));
  }, [bottomNavTabs]);

  if (navPosition === 'dropdown') return null;

  const isFull = bottomNavTabs.length >= MAX_TABS;

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

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-1">{t('settings.bottomNav')}</h3>
      <p className="text-xs text-text-muted mb-4">{t('settings.bottomNavDesc')}</p>

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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                <button
                  onClick={() => moveDown(i)}
                  disabled={i === pinnedItems.length - 1}
                  className="p-1 rounded-lg text-text-muted disabled:opacity-30 hover:text-text-primary transition-colors"
                  aria-label="Move down"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <button
                  onClick={() => removeTab(item.to)}
                  disabled={bottomNavTabs.length <= 1}
                  className="p-1 rounded-lg text-text-muted disabled:opacity-30 hover:text-red transition-colors"
                  aria-label="Remove"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
