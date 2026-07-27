import { useSettingsStore } from '../../stores/settingsStore';

export const PROJECT_LIST_BASE_PX = 13;
export const PROJECT_NOTE_BASE_PX = 14;
export const PROJECT_TEXT_MIN_PX = 10;

export function scaledProjectBase(base: number, zoom: number): number {
  return Math.round((base * zoom) / 100);
}

export function adjustProjectNoteFontPx(currentPx: number, deltaPx: number): number {
  return Math.max(PROJECT_TEXT_MIN_PX, Math.round(currentPx + deltaPx));
}

export function useProjectTypography() {
  const uiZoom = useSettingsStore((s) => s.uiZoom);
  const listOverride = useSettingsStore((s) => s.projectListFontOverridePx);
  const noteOverride = useSettingsStore((s) => s.projectNoteFontOverridePx);
  return {
    projectListFontPx: listOverride ?? scaledProjectBase(PROJECT_LIST_BASE_PX, uiZoom),
    projectNoteFontPx: noteOverride ?? scaledProjectBase(PROJECT_NOTE_BASE_PX, uiZoom),
  };
}
