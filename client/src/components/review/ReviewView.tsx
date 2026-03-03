import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import type { TranslationKey } from '../../i18n/translations';

interface ReviewItem {
  id: string;
  labelKey: TranslationKey | null;
  customLabel: string | null;
  checked: boolean;
}

const DEFAULT_ITEMS: { labelKey: TranslationKey }[] = [
  { labelKey: 'review.appNotes' },
  { labelKey: 'review.browserTabs' },
  { labelKey: 'review.telegramSaved' },
  { labelKey: 'review.downloads' },
  { labelKey: 'review.desktop' },
  { labelKey: 'review.emailInbox' },
  { labelKey: 'review.chatMessages' },
  { labelKey: 'review.screenshots' },
];

let nextId = 1;
function makeId() {
  return `review-${nextId++}`;
}

export function ReviewView() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ReviewItem[]>(() =>
    DEFAULT_ITEMS.map((d) => ({
      id: makeId(),
      labelKey: d.labelKey,
      customLabel: null,
      checked: false,
    })),
  );
  const [addText, setAddText] = useState('');
  const addRef = useRef<HTMLInputElement>(null);

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item,
      ),
    );
  };

  const removeCustom = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addCustom = () => {
    const text = addText.trim();
    if (!text) return;
    setItems((prev) => [
      ...prev,
      { id: makeId(), labelKey: null, customLabel: text, checked: false },
    ]);
    setAddText('');
    addRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustom();
    }
  };

  const reset = () => {
    setItems((prev) => prev.map((item) => ({ ...item, checked: false })));
  };

  const checkedCount = items.filter((i) => i.checked).length;
  const allDone = items.length > 0 && checkedCount === items.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('review.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">{t('review.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-muted tabular-nums">
            {checkedCount}/{items.length} {t('review.progress')}
          </span>
          {checkedCount > 0 && (
            <button
              onClick={reset}
              className="px-3 py-1.5 rounded-xl text-sm font-medium text-text-muted hover:text-text-secondary transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
            >
              {t('review.reset')}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ boxShadow: NEU.pressedSm }}>
        <motion.div
          className="h-full rounded-full bg-accent"
          initial={{ width: 0 }}
          animate={{ width: `${items.length > 0 ? (checkedCount / items.length) * 100 : 0}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </div>

      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-8 text-center"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="mt-3 text-lg font-medium text-text-primary">{t('review.allDone')}</p>
            <p className="text-sm text-text-muted">{t('review.allDoneHint')}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checklist */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div
                className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-card transition-opacity ${
                  item.checked ? 'opacity-50' : ''
                }`}
                style={{ boxShadow: NEU.raisedSm }}
              >
                <button
                  onClick={() => toggle(item.id)}
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    item.checked
                      ? 'bg-accent border-accent'
                      : 'border-text-muted/40 hover:border-accent'
                  }`}
                >
                  {item.checked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    item.checked ? 'line-through text-text-muted' : 'text-text-primary'
                  }`}
                >
                  {item.labelKey ? t(item.labelKey) : item.customLabel}
                </span>
                {item.customLabel && (
                  <button
                    onClick={() => removeCustom(item.id)}
                    className="text-text-muted hover:text-red text-sm transition-colors shrink-0"
                  >
                    &times;
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add custom item */}
      <div
        className="flex gap-2 items-center rounded-xl bg-bg-card p-2"
        style={{ boxShadow: NEU.pressed }}
      >
        <input
          ref={addRef}
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('review.addCustom')}
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none px-2 leading-8"
        />
        <button
          onClick={addCustom}
          disabled={!addText.trim()}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-accent disabled:opacity-40 transition-opacity shrink-0"
          style={{ boxShadow: NEU.raisedSm }}
        >
          +
        </button>
      </div>
    </div>
  );
}
