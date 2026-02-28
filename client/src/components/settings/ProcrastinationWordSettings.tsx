import React, { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';

export function ProcrastinationWordSettings() {
  const { t } = useTranslation();
  const words = useSettingsStore((s) => s.procrastinationWords);
  const update = useSettingsStore((s) => s.update);
  const [input, setInput] = useState('');

  const addWord = () => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed || words.includes(trimmed)) return;
    update({ procrastinationWords: [...words, trimmed] });
    setInput('');
  };

  const removeWord = (word: string) => {
    update({ procrastinationWords: words.filter((w) => w !== word) });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addWord();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {words.map((word) => (
          <span
            key={word}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs text-text-secondary"
            style={{ boxShadow: NEU.pressedSm }}
          >
            {word}
            <button
              onClick={() => removeWord(word)}
              className="text-text-muted hover:text-red transition-colors ml-0.5"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('procrastination.addWord')}
          className="flex-1 text-sm bg-transparent text-text-primary placeholder:text-text-muted focus:outline-none rounded-lg px-3 py-1.5"
          style={{ boxShadow: NEU.pressedSm }}
        />
        <button
          onClick={addWord}
          className="px-3 py-1.5 text-sm rounded-lg text-text-secondary transition-all"
          style={{ boxShadow: NEU.raisedSm }}
        >
          +
        </button>
      </div>
    </div>
  );
}
