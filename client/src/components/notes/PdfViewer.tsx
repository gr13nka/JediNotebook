import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Button } from '../ui/Button';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import type { PdfDocument } from '@shared/types';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ZoomInIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

interface PdfViewerProps {
  open: boolean;
  onClose: () => void;
  onDelete?: () => void;
  pdf: PdfDocument | null;
}

export function PdfViewer({ open, onClose, onDelete, pdf }: PdfViewerProps) {
  const { t } = useTranslation();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);

  useEffect(() => {
    if (open && pdf) {
      const url = URL.createObjectURL(pdf.pdfData);
      setPdfUrl(url);
      setScale(1.0);
      return () => URL.revokeObjectURL(url);
    } else {
      setPdfUrl(null);
    }
  }, [open, pdf]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
  }, []);

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));

  return (
    <AnimatePresence>
      {open && pdf && (
        <motion.div
          className="fixed inset-0 z-50 bg-bg-primary flex flex-col"
          initial={{ opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Top bar */}
          <div
            className="flex items-center gap-2 px-4 py-3 shrink-0"
            style={{ boxShadow: NEU.topBar }}
          >
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
              style={{ boxShadow: NEU.raisedSm }}
            >
              <BackIcon />
            </button>

            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-text-primary truncate">
                {pdf.title || pdf.fileName}
              </h2>
              {numPages > 0 && (
                <p className="text-xs text-text-muted">
                  {numPages} {numPages === 1 ? 'page' : 'pages'}
                </p>
              )}
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={zoomOut}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                style={{ boxShadow: NEU.raisedSm }}
                title={t('ideas.pdfZoomOut')}
              >
                <ZoomOutIcon />
              </button>
              <span className="text-xs text-text-muted w-10 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                style={{ boxShadow: NEU.raisedSm }}
                title={t('ideas.pdfZoomIn')}
              >
                <ZoomInIcon />
              </button>
            </div>

            {onDelete && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  onDelete();
                  onClose();
                }}
              >
                {t('ideas.deleteBtnLabel')}
              </Button>
            )}
          </div>

          {/* PDF content */}
          <div className="flex-1 overflow-auto flex justify-center bg-bg-primary">
            {pdfUrl && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center h-64 text-text-muted text-sm">
                    Loading...
                  </div>
                }
              >
                <div className="flex flex-col items-center gap-4 py-4 px-2">
                  {Array.from({ length: numPages }, (_, i) => (
                    <Page
                      key={i + 1}
                      pageNumber={i + 1}
                      scale={scale}
                      className="shadow-lg"
                    />
                  ))}
                </div>
              </Document>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
