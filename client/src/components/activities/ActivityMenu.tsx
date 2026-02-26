import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { NEU } from '../../utils/shadows';

interface ActivityMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

export function ActivityMenu({ onEdit, onDelete }: ActivityMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="w-7 h-7 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
        style={{ boxShadow: NEU.raisedSm }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 min-w-[120px] rounded-xl bg-bg-card py-1"
          style={{ boxShadow: NEU.modal }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(); }}
            className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-bg-elevated transition-colors"
          >
            {t('activities.edit')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="w-full text-left px-4 py-2 text-sm text-red hover:bg-bg-elevated transition-colors"
          >
            {t('activities.delete')}
          </button>
        </div>
      )}
    </div>
  );
}
