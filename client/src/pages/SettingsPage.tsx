import React from 'react';
import { motion } from 'motion/react';
import { ThemeToggle } from '../components/settings/ThemeToggle';
import { BarStylePicker } from '../components/settings/BarStylePicker';
import { DayBoundarySettings } from '../components/settings/DayBoundarySettings';
import { TimezoneSettings } from '../components/settings/TimezoneSettings';
import { TaskSettings } from '../components/settings/TaskSettings';
import { TimerNotificationSettings } from '../components/settings/TimerNotificationSettings';
import { LanguagePicker } from '../components/settings/LanguagePicker';
import { NavPositionPicker } from '../components/settings/NavPositionPicker';
import { BottomNavSettings } from '../components/settings/BottomNavSettings';
import { AccentColorPicker } from '../components/settings/AccentColorPicker';
import { ZoomSettings } from '../components/settings/ZoomSettings';
import { ProcrastinationWordSettings } from '../components/settings/ProcrastinationWordSettings';
import { VaultSettings } from '../components/settings/VaultSettings';
import { MobileProjectSettings } from '../components/settings/MobileProjectSettings';
import { GamificationSettings } from '../components/settings/GamificationSettings';
import { TaskTimerSettings } from '../components/settings/TaskTimerSettings';
import { Card } from '../components/ui/Card';
import { useTranslation } from '../i18n/useTranslation';

const sectionComponents = [
  { key: 'settings.language', component: LanguagePicker },
  { key: 'settings.theme', component: ThemeToggle },
  { key: 'settings.accent', component: AccentColorPicker },
  { key: 'settings.appearance', component: BarStylePicker },
  { key: 'settings.navPosition', component: NavPositionPicker },
  { key: 'settings.bottomNav', component: BottomNavSettings },
  { key: 'settings.zoom', component: ZoomSettings },
  { key: 'settings.time', component: DayBoundarySettings },
  { key: 'settings.timezone', component: TimezoneSettings },
  { key: 'settings.mobileProjects', component: MobileProjectSettings },
  { key: 'settings.tasks', component: TaskSettings },
  { key: 'settings.taskTimer', component: TaskTimerSettings },
  { key: 'settings.procrastination', component: ProcrastinationWordSettings },
  { key: 'settings.notifications', component: TimerNotificationSettings },
  { key: 'settings.gamification', component: GamificationSettings },
  { key: 'settings.vault', component: VaultSettings },
] as const;

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-6">{t('settings.title')}</h1>
      <motion.div
        className="flex flex-col gap-8"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {sectionComponents.map((section) => (
          <motion.div key={section.key} variants={item}>
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-text-muted/70 mb-2 pl-1">
              {t(section.key)}
            </span>
            <Card>
              <section.component />
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
