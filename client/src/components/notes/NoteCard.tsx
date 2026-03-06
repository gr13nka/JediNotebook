import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import { stripMarkdown } from '../../utils/markdown';
import type { Note } from '@shared/types';

const PinIcon = ({ filled }: { filled: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 17v5" />
    <path d="M5 12h14" />
    <rect x="7" y="4" width="10" height="8" rx="1" />
  </svg>
);

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onTogglePin: () => void;
}

export function NoteCard({ note, onClick, onTogglePin }: NoteCardProps) {
  return (
    <motion.div
      className="relative rounded-2xl bg-bg-card p-4 cursor-pointer break-inside-avoid mb-3"
      style={{
        boxShadow: NEU.raised,
        background: `color-mix(in srgb, ${note.color} 30%, var(--color-bg-card))`,
      }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      layout
    >
      {/* Pin button */}
      <button
        className="absolute top-3 right-3 p-1 rounded-full text-text-muted hover:text-text-primary transition-colors z-10"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin();
        }}
        title={note.isPinned ? 'Unpin' : 'Pin'}
      >
        <PinIcon filled={note.isPinned} />
      </button>

      {/* Title */}
      {note.title && (
        <h3 className="text-sm font-semibold text-text-primary mb-1 pr-7 line-clamp-2">
          {stripMarkdown(note.title)}
        </h3>
      )}

      {/* Content preview */}
      {note.content && (
        <p className="text-xs text-text-secondary line-clamp-6 whitespace-pre-line">
          {stripMarkdown(note.content)}
        </p>
      )}
    </motion.div>
  );
}
