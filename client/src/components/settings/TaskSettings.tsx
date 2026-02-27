import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { NEU } from '../../utils/shadows';

export function TaskSettings() {
  const { t } = useTranslation();
  const maxTasksPerProject = useSettingsStore((s) => s.maxTasksPerProject);
  const update = useSettingsStore((s) => s.update);

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.maxTasks')}</h3>
      <div className="flex items-center gap-3">
        <button
          onClick={() => update({ maxTasksPerProject: Math.max(1, maxTasksPerProject - 1) })}
          disabled={maxTasksPerProject <= 1}
          className="w-8 h-8 rounded-lg bg-bg-elevated text-text-primary font-medium border border-border disabled:opacity-40 transition-colors"
          style={{ boxShadow: NEU.raisedSm }}
        >
          −
        </button>
        <span
          className="w-10 h-8 flex items-center justify-center rounded-lg text-sm font-semibold text-text-primary bg-bg-card border border-border"
          style={{ boxShadow: NEU.pressedSm }}
        >
          {maxTasksPerProject}
        </span>
        <button
          onClick={() => update({ maxTasksPerProject: Math.min(20, maxTasksPerProject + 1) })}
          disabled={maxTasksPerProject >= 20}
          className="w-8 h-8 rounded-lg bg-bg-elevated text-text-primary font-medium border border-border disabled:opacity-40 transition-colors"
          style={{ boxShadow: NEU.raisedSm }}
        >
          +
        </button>
        <span className="text-xs text-text-muted ml-1">{t('settings.tasksPerProject')}</span>
      </div>
    </div>
  );
}
