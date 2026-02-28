import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { useInbox } from '../../hooks/useInbox';
import { useTranslation } from '../../i18n/useTranslation';
import { useMindMapUIStore } from '../../stores/mindMapUIStore';

export function MindUnloadMode() {
  const { t } = useTranslation();
  const { addItem } = useInbox();
  const setMindUnloadActive = useMindMapUIStore((s) => s.setMindUnloadActive);
  const [text, setText] = useState('');
  const [showBanner, setShowBanner] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSendToInbox = async () => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      await addItem(line);
    }
    setText('');
    setMindUnloadActive(false);
  };

  const handleDiscard = () => {
    setText('');
    setMindUnloadActive(false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 p-4">
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-card"
            style={{ boxShadow: NEU.raisedSm }}
          >
            <p className="flex-1 text-sm text-text-secondary">{t('mindUnload.banner')}</p>
            <button
              onClick={() => setShowBanner(false)}
              className="text-text-muted hover:text-text-primary transition-colors shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('mindUnload.placeholder')}
        className="flex-1 min-h-[200px] bg-bg-card rounded-xl p-4 text-sm text-text-primary placeholder:text-text-muted outline-none resize-none"
        style={{ boxShadow: NEU.pressed }}
      />

      <div className="flex gap-2">
        <button
          onClick={handleSendToInbox}
          disabled={!text.trim()}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-accent disabled:opacity-40 transition-opacity"
          style={{ boxShadow: NEU.raisedSm }}
        >
          {t('mindUnload.sendToInbox')}
        </button>
        <button
          onClick={handleDiscard}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-text-muted"
          style={{ boxShadow: NEU.raisedSm }}
        >
          {t('mindUnload.discard')}
        </button>
      </div>
    </div>
  );
}
