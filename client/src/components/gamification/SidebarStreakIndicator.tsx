import { useSettingsStore } from '../../stores/settingsStore';
import { getLevel } from '../../utils/streak';

const FireIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12c2-2.96 0-7-1-8 0 3.038-1.773 4.741-3 6-1.226 1.26-2 3.24-2 5a6 6 0 1 0 12 0c0-1.532-1.056-3.94-2-5-1.786 3-2.791 3-4 2z" fill="#FF6B35" stroke="#E85D26" />
  </svg>
);

export function SidebarStreakIndicator({ collapsed }: { collapsed: boolean }) {
  const gamificationEnabled = useSettingsStore((s) => s.gamificationEnabled);
  const currentStreak = useSettingsStore((s) => s.currentStreak);
  const totalXP = useSettingsStore((s) => s.totalXP);

  if (!gamificationEnabled) return null;

  const level = getLevel(totalXP);

  return (
    <div
      className={`flex items-center gap-1.5 text-text-secondary ${collapsed ? 'justify-center' : ''}`}
      title={collapsed ? `${currentStreak} streak | Lv.${level}` : undefined}
    >
      <FireIcon />
      {!collapsed && (
        <span className="text-xs font-medium tabular-nums">
          {currentStreak} <span className="text-text-muted">| Lv.{level}</span>
        </span>
      )}
    </div>
  );
}
