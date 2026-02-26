import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePomodoro } from '../../hooks/usePomodoro';
import { usePomodoroPresets } from '../../hooks/usePomodoroPresets';
import { useActivities } from '../../hooks/useActivities';
import { PresetSelector } from './PresetSelector';
import { PresetFormModal } from './PresetFormModal';
import { Button } from '../ui/Button';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import type { PomodoroPreset, PomodoroPhase } from '@shared/types';

const PHASE_COLORS: Record<PomodoroPhase, string> = {
  work: 'var(--color-accent)',
  break: '#27AE60',
  longBreak: '#2BA89E',
};

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function CountdownCircle({
  remainingSeconds,
  totalSeconds,
  phase,
}: {
  remainingSeconds: number;
  totalSeconds: number;
  phase: PomodoroPhase;
}) {
  const size = 160;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  const offset = circumference - ratio * circumference;
  const color = PHASE_COLORS[phase];

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-bar-track)"
        strokeWidth={strokeWidth}
        opacity={0.3}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
    </svg>
  );
}

export function PomodoroTimer({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const {
    isActive,
    isPaused,
    phase,
    remainingSeconds,
    totalSeconds,
    currentSession,
    sessionsBeforeLongBreak,
    linkedActivityId,
    selectedPresetId,
    startPomodoro,
    pause,
    resume,
    skip,
    stop,
    setLinkedActivity,
    setSelectedPreset,
  } = usePomodoro();

  const { presets, createPreset, updatePreset, deletePreset } = usePomodoroPresets();
  const { activities } = useActivities();

  const [showPresetForm, setShowPresetForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PomodoroPreset | null>(null);

  const handleSelectPreset = (preset: PomodoroPreset) => {
    setSelectedPreset(preset.id);
  };

  const handleStart = () => {
    const preset = presets.find((p) => p.id === selectedPresetId) ?? presets[0];
    if (!preset) return;
    startPomodoro(preset);
  };

  const handleEditPreset = (preset: PomodoroPreset) => {
    setEditingPreset(preset);
    setShowPresetForm(true);
  };

  const handleSavePreset = async (data: Parameters<typeof createPreset>[0]) => {
    if (editingPreset) {
      await updatePreset(editingPreset.id, data);
    } else {
      await createPreset(data);
    }
    setEditingPreset(null);
  };

  const handleDeletePreset = async () => {
    if (editingPreset) {
      await deletePreset(editingPreset.id);
      if (selectedPresetId === editingPreset.id) {
        setSelectedPreset(null);
      }
      setEditingPreset(null);
    }
  };

  const nonBreakActivities = activities.filter((a) => !a.isBreak);
  const phaseLabel = phase === 'work' ? t('pomodoro.work') : phase === 'break' ? t('pomodoro.break') : t('pomodoro.longBreak');

  return (
    <>
      <div
        className={embedded ? '' : 'rounded-2xl bg-bg-card p-4 mb-4'}
        style={embedded ? undefined : { boxShadow: NEU.raised }}
      >
        {!embedded && (
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-text-secondary">{t('pomodoro.title')}</h3>
            {isActive && (
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{ color: PHASE_COLORS[phase], backgroundColor: `${PHASE_COLORS[phase]}18` }}
              >
                {phaseLabel}
              </span>
            )}
          </div>
        )}
        {embedded && isActive && (
          <div className="flex justify-center mb-3">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ color: PHASE_COLORS[phase], backgroundColor: `${PHASE_COLORS[phase]}18` }}
            >
              {phaseLabel}
            </span>
          </div>
        )}

        <PresetSelector
          presets={presets}
          selectedId={selectedPresetId ?? presets[0]?.id ?? null}
          onSelect={handleSelectPreset}
          onAdd={() => {
            setEditingPreset(null);
            setShowPresetForm(true);
          }}
          onEdit={handleEditPreset}
          disabled={isActive}
        />

        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-col items-center">
                <div className="relative">
                  <CountdownCircle
                    remainingSeconds={remainingSeconds}
                    totalSeconds={totalSeconds}
                    phase={phase}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className="text-3xl font-bold text-text-primary"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatCountdown(remainingSeconds)}
                    </span>
                    <span className="text-xs text-text-muted mt-0.5">
                      {currentSession} {t('pomodoro.of')} {sessionsBeforeLongBreak}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  {isPaused ? (
                    <Button variant="primary" onClick={resume}>
                      {t('pomodoro.resume')}
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={pause}>
                      {t('pomodoro.pause')}
                    </Button>
                  )}
                  <Button variant="ghost" onClick={skip}>
                    {t('pomodoro.skip')}
                  </Button>
                  <Button variant="danger" size="sm" onClick={stop}>
                    {t('pomodoro.stop')}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isActive && (
          <div className="mt-3 flex items-center gap-2">
            <select
              value={linkedActivityId ?? ''}
              onChange={(e) => setLinkedActivity(e.target.value || null)}
              className="flex-1 rounded-xl bg-bg-card px-3 py-2 text-sm text-text-primary transition-colors duration-200 focus:outline-none"
              style={{ boxShadow: NEU.pressedSm }}
            >
              <option value="">{t('pomodoro.noLinkedActivity')}</option>
              {nonBreakActivities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Button variant="primary" size="lg" onClick={handleStart}>
              {t('pomodoro.start')}
            </Button>
          </div>
        )}
      </div>

      <PresetFormModal
        open={showPresetForm}
        onClose={() => {
          setShowPresetForm(false);
          setEditingPreset(null);
        }}
        onSave={handleSavePreset}
        onDelete={editingPreset ? handleDeletePreset : undefined}
        preset={editingPreset}
      />
    </>
  );
}
