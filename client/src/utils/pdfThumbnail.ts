import { pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const MAX_THUMB_WIDTH = 200;

export async function generatePdfThumbnail(
  pdfData: ArrayBuffer,
): Promise<Blob | null> {
  try {
    const doc = await pdfjs.getDocument({ data: pdfData }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = MAX_THUMB_WIDTH / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas } as any).promise;
    doc.destroy();

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.7,
      );
    });
  } catch {
    return null;
  }
}

export async function getPdfPageCount(pdfData: ArrayBuffer): Promise<number> {
  const doc = await pdfjs.getDocument({ data: pdfData }).promise;
  const count = doc.numPages;
  doc.destroy();
  return count;
}
