import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { NEU } from '../../utils/shadows';
import type { PdfDocument } from '@shared/types';

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

const PdfIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PdfCardProps {
  pdf: PdfDocument;
  onClick: () => void;
  onTogglePin: () => void;
}

export function PdfCard({ pdf, onClick, onTogglePin }: PdfCardProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (pdf.thumbnail) {
      const url = URL.createObjectURL(pdf.thumbnail);
      setThumbUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [pdf.thumbnail]);

  return (
    <motion.div
      className="relative rounded-2xl bg-bg-card cursor-pointer break-inside-avoid mb-3 overflow-hidden"
      style={{
        boxShadow: NEU.raised,
        background: `color-mix(in srgb, ${pdf.color} 20%, var(--color-bg-card))`,
      }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      layout
    >
      {/* Thumbnail or placeholder */}
      <div className="w-full aspect-[3/4] bg-bg-elevated flex items-center justify-center overflow-hidden">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={pdf.title}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="text-text-muted">
            <PdfIcon />
          </div>
        )}
      </div>

      {/* Info bar */}
      <div className="p-3">
        {/* Pin button */}
        <button
          className="absolute top-2 right-2 p-1 rounded-full bg-bg-card/80 backdrop-blur text-text-muted hover:text-text-primary transition-colors z-10"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          title={pdf.isPinned ? 'Unpin' : 'Pin'}
        >
          <PinIcon filled={pdf.isPinned} />
        </button>

        <h3 className="text-sm font-semibold text-text-primary mb-1 line-clamp-2">
          {pdf.title || pdf.fileName}
        </h3>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>{pdf.pageCount} pg</span>
          <span>&middot;</span>
          <span>{formatFileSize(pdf.fileSize)}</span>
        </div>
      </div>
    </motion.div>
  );
}
