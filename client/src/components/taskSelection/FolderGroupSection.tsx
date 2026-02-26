import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { ProjectFolder } from '@shared/types';
import { useTranslation } from '../../i18n/useTranslation';

interface FolderGroupSectionProps {
  folder: ProjectFolder | null;
  children: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  projectCount: number;
}

export function FolderGroupSection({ folder, children, isCollapsed, onToggle, projectCount }: FolderGroupSectionProps) {
  const { t } = useTranslation();

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-2 py-2.5 rounded-lg text-left hover:bg-bg-elevated/30 transition-colors"
      >
        {folder && (
          <span
            className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: folder.color }}
          />
        )}

        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {folder ? folder.name : t('folders.unfiled')}
        </span>

        <span className="text-xs text-text-muted ml-auto tabular-nums">
          {projectCount}
        </span>

        <svg
          className="w-3.5 h-3.5 text-text-muted transition-transform duration-200"
          style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex flex-col gap-2 pl-2">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
