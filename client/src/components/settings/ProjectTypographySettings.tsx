import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { FreeNumberControl } from './FreeNumberControl';
import { PROJECT_TEXT_MIN_PX, useProjectTypography } from './projectTypography';

export function ProjectTypographySettings() {
  const { t } = useTranslation();
  const { projectListFontPx, projectNoteFontPx } = useProjectTypography();
  const setList = useSettingsStore((s) => s.setProjectListFontOverride);
  const setNote = useSettingsStore((s) => s.setProjectNoteFontOverride);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-2">{t('settings.projectListFont')}</h3>
        <FreeNumberControl value={projectListFontPx} min={PROJECT_TEXT_MIN_PX} suffix="px" onChange={setList} onReset={() => setList(null)} resetLabel={t('settings.reset')} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-2">{t('settings.projectNoteFont')}</h3>
        <FreeNumberControl value={projectNoteFontPx} min={PROJECT_TEXT_MIN_PX} suffix="px" onChange={setNote} onReset={() => setNote(null)} resetLabel={t('settings.reset')} />
      </div>
    </div>
  );
}
