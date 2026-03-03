import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { generateId, getDeviceId } from '../utils/uuid';
import { getNextColor } from '../utils/colors';
import type { PdfDocument } from '@shared/types';

export function usePdfDocuments() {
  const pdfs = useLiveQuery(
    () =>
      db.pdfDocuments
        .filter((p) => !p.deletedAt)
        .toArray()
        .then((arr) =>
          arr.sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            return b.updatedAt.localeCompare(a.updatedAt);
          }),
        ),
    [],
  );

  const createPdf = async (data: {
    title: string;
    fileName: string;
    fileSize: number;
    pageCount: number;
    pdfData: Blob;
    thumbnail: Blob | null;
  }) => {
    const now = new Date().toISOString();
    const usedColors = (pdfs ?? []).map((p) => p.color);
    const pdf: PdfDocument = {
      id: generateId(),
      title: data.title,
      fileName: data.fileName,
      fileSize: data.fileSize,
      pageCount: data.pageCount,
      color: getNextColor(usedColors),
      isPinned: false,
      thumbnail: data.thumbnail,
      pdfData: data.pdfData,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deviceId: getDeviceId(),
    };
    await db.pdfDocuments.add(pdf);
    return pdf;
  };

  const updatePdf = async (
    id: string,
    patch: Partial<Pick<PdfDocument, 'title' | 'color'>>,
  ) => {
    await db.pdfDocuments.update(id, {
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const deletePdf = async (id: string) => {
    const now = new Date().toISOString();
    await db.pdfDocuments.update(id, {
      deletedAt: now,
      updatedAt: now,
    });
  };

  const togglePin = async (id: string) => {
    const pdf = await db.pdfDocuments.get(id);
    if (!pdf) return;
    await db.pdfDocuments.update(id, {
      isPinned: !pdf.isPinned,
      updatedAt: new Date().toISOString(),
    });
  };

  return {
    pdfs: pdfs ?? [],
    createPdf,
    updatePdf,
    deletePdf,
    togglePin,
  };
}
