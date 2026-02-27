import React from 'react';
import type { BarStyle } from '@shared/types';
import { useTranslation } from '../../i18n/useTranslation';
import { useSettingsStore } from '../../stores/settingsStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { NEU } from '../../utils/shadows';
import { ThickLinearBar } from '../progress/ThickLinearBar';
import { SegmentedBar } from '../progress/SegmentedBar';
import { CircularBar } from '../progress/CircularBar';

export function BarStylePicker() {
  const { t } = useTranslation();
  const barStyle = useSettingsStore((s) => s.barStyle);
  const update = useSettingsStore((s) => s.update);
  const colors = useThemeColors();

  const styles: { value: BarStyle; label: string }[] = [
    { value: 'thick-linear', label: t('settings.linear') },
    { value: 'segmented', label: t('settings.segmented') },
    { value: 'circular', label: t('settings.circular') },
  ];

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary mb-3">{t('settings.barStyle')}</h3>
      <div className="grid grid-cols-3 gap-3">
        {styles.map((s) => {
          const active = barStyle === s.value;
          return (
            <button
              key={s.value}
              onClick={() => update({ barStyle: s.value })}
              className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-colors bg-bg-card border ${
                active ? 'border-accent' : 'border-border'
              }`}
              style={{
                boxShadow: active ? NEU.pressed : NEU.raisedSm,
              }}
            >
              <div className="w-full flex justify-center">
                {s.value === 'thick-linear' && (
                  <div className="w-full">
                    <ThickLinearBar ratio={0.65} color={colors.accent} />
                  </div>
                )}
                {s.value === 'segmented' && (
                  <div className="w-full">
                    <SegmentedBar ratio={0.65} color={colors.accent} segments={8} />
                  </div>
                )}
                {s.value === 'circular' && (
                  <CircularBar ratio={0.65} color={colors.accent} size={40} />
                )}
              </div>
              <span className="text-xs text-text-primary">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
