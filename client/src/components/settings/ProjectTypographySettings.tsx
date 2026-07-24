import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';
import { FreeNumberControl } from './FreeNumberControl';

const PROJECT_LIST_BASE_PX = 13;
const PROJECT_NOTE_BASE_PX = 14;

function scaledBase(base: number, zoom: number): number {
  return Math.round((base * zoom) / 100);
}

export function useProjectTypography() {
  const uiZoom = useSettingsStore((s) => s.uiZoom);
  const listOverride = useSettingsStore((s) => s.projectListFontOverridePx);
  const noteOverride = useSettingsStore((s) => s.projectNoteFontOverridePx);
  return {
    projectListFontPx: listOverride ?? scaledBase(PROJECT_LIST_BASE_PX, uiZoom),
    projectNoteFontPx: noteOverride ?? scaledBase(PROJECT_NOTE_BASE_PX, uiZoom),
  };
}

export function ProjectTypographySettings() {
  const { t } = useTranslation();
  const { projectListFontPx, projectNoteFontPx } = useProjectTypography();
  const setList = useSettingsStore((s) => s.setProjectListFontOverride);
  const setNote = useSettingsStore((s) => s.setProjectNoteFontOverride);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-2">{t('settings.projectListFont')}</h3>
        <FreeNumberControl value={projectListFontPx} min={10} suffix="px" onChange={setList} onReset={() => setList(null)} resetLabel={t('settings.reset')} />
      </div>
      <div>
        <h3 className="text-sm font-medium text-text-secondary mb-2">{t('settings.projectNoteFont')}</h3>
        <FreeNumberControl value={projectNoteFontPx} min={10} suffix="px" onChange={setNote} onReset={() => setNote(null)} resetLabel={t('settings.reset')} />
      </div>
    </div>
  );
}
