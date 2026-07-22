import { motion, AnimatePresence } from 'motion/react';
import { useStalenessScore } from '../../hooks/useStalenessScore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../i18n/useTranslation';

function getStalenessColor(score: number, fixed: boolean): string {
  if (fixed) return 'text-text-muted';
  if (score < 100) return 'text-green-500';
  if (score <= 500) return 'text-amber-500';
  return 'text-red-500';
}

const EyeOpen = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
    <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
  </svg>
);

const EyeClosed = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
    <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.186A10.004 10.004 0 0010 3c-1.67 0-3.248.41-4.632 1.132L3.28 2.22zM7.74 6.68a4 4 0 005.58 5.58L11.9 10.84A2.5 2.5 0 019.16 8.1L7.74 6.68z" clipRule="evenodd" />
    <path d="M14.472 14.407a10.03 10.03 0 01-4.472 1.093c-4.257 0-7.893-2.66-9.336-6.41a1.651 1.651 0 010-1.186 10.05 10.05 0 012.888-4.078l2.87 2.87a4.002 4.002 0 005.508 5.508l2.542 2.203z" />
  </svg>
);

const PaletteIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className ?? 'w-3.5 h-3.5'}>
    <path fillRule="evenodd" d="M3.5 2A1.5 1.5 0 002 3.5V15a3 3 0 106 0V3.5A1.5 1.5 0 006.5 2h-3zm11.76 5.84l-3.1-3.1a1.5 1.5 0 00-2.12 0L8.5 6.28a1.5 1.5 0 000 2.12l3.1 3.1a1.5 1.5 0 002.12 0l1.54-1.54a1.5 1.5 0 000-2.12z" clipRule="evenodd" />
  </svg>
);

export function StalenessCounter() {
  const { stalenessScore, isVisible, toggleVisibility } = useStalenessScore();
  const colorFixed = useSettingsStore((s) => s.pointsColorFixed);
  const update = useSettingsStore((s) => s.update);
  const { t } = useTranslation();

  const toggleColorFixed = () => {
    update({ pointsColorFixed: !colorFixed });
  };

  return (
    <div className="flex items-center gap-1.5">
      <AnimatePresence mode="wait">
        {isVisible && (
          <motion.span
            key={stalenessScore}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className={`text-xs font-bold tabular-nums ${getStalenessColor(stalenessScore, colorFixed)}`}
            title={t('points.title')}
          >
            {stalenessScore}
          </motion.span>
        )}
      </AnimatePresence>
      <button
        onClick={toggleVisibility}
        className="text-text-muted hover:text-text-primary transition-colors"
        title={isVisible ? t('points.hide') : t('points.show')}
      >
        {isVisible ? <EyeOpen /> : <EyeClosed />}
      </button>
      {isVisible && (
        <button
          onClick={toggleColorFixed}
          className={`transition-colors ${colorFixed ? 'text-text-muted' : 'text-accent'}`}
          title={t('points.colorToggle')}
        >
          <PaletteIcon />
        </button>
      )}
    </div>
  );
}
