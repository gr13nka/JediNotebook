import { useRef } from 'react';
import { NEU } from '../../utils/shadows';
import { useTranslation } from '../../i18n/useTranslation';
import { generatePdfThumbnail, getPdfPageCount } from '../../utils/pdfThumbnail';

interface PdfUploadButtonProps {
  onUpload: (data: {
    title: string;
    fileName: string;
    fileSize: number;
    pageCount: number;
    pdfData: Blob;
    thumbnail: Blob | null;
  }) => void;
}

export function PdfUploadButton({ onUpload }: PdfUploadButtonProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    const pageCount = await getPdfPageCount(arrayBuffer);
    const thumbnail = await generatePdfThumbnail(arrayBuffer);

    const title = file.name.replace(/\.pdf$/i, '');

    onUpload({
      title,
      fileName: file.name,
      fileSize: file.size,
      pageCount,
      pdfData: new Blob([arrayBuffer], { type: 'application/pdf' }),
      thumbnail,
    });

    // Reset input so same file can be re-uploaded
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleChange}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="rounded-2xl p-3 flex items-center justify-center text-sm font-medium text-text-muted hover:text-text-secondary transition-colors"
        style={{ boxShadow: NEU.pressed, minHeight: '80px' }}
      >
        {t('ideas.uploadPdf')}
      </button>
    </>
  );
}
