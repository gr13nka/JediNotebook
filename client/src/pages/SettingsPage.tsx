import React from 'react';
import { motion } from 'motion/react';
import { ThemeToggle } from '../components/settings/ThemeToggle';
import { BarStylePicker } from '../components/settings/BarStylePicker';
import { DayBoundarySettings } from '../components/settings/DayBoundarySettings';
import { TimezoneSettings } from '../components/settings/TimezoneSettings';
import { SyncSettings } from '../components/settings/SyncSettings';
import { TaskSettings } from '../components/settings/TaskSettings';
import { TimerNotificationSettings } from '../components/settings/TimerNotificationSettings';
import { LanguagePicker } from '../components/settings/LanguagePicker';
import { NavPositionPicker } from '../components/settings/NavPositionPicker';
import { AccentColorPicker } from '../components/settings/AccentColorPicker';
import { ZoomSettings } from '../components/settings/ZoomSettings';
import { Card } from '../components/ui/Card';
import { useTranslation } from '../i18n/useTranslation';

const sectionComponents = [
  { key: 'settings.language', component: LanguagePicker },
  { key: 'settings.theme', component: ThemeToggle },
  { key: 'settings.accent', component: AccentColorPicker },
  { key: 'settings.appearance', component: BarStylePicker },
  { key: 'settings.navPosition', component: NavPositionPicker },
  { key: 'settings.zoom', component: ZoomSettings },
  { key: 'settings.time', component: DayBoundarySettings },
  { key: 'settings.timezone', component: TimezoneSettings },
  { key: 'settings.tasks', component: TaskSettings },
  { key: 'settings.sync', component: SyncSettings },
  { key: 'settings.notifications', component: TimerNotificationSettings },
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
