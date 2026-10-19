// Makes the small card picture for a proof, in Alan's browser, when he posts
// it. Images are scaled down; PDFs get page one drawn by pdf.js. pdf.js is
// loaded only here, so reviewers never download it.

import { loadPdfjs } from './portal-pdf';

const THUMB_WIDTH = 720;

async function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not make a thumbnail.'))), 'image/jpeg', 0.82));
}

function whiteCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'white'; // PDFs and transparent PNGs read best on white
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

async function imageThumb(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, THUMB_WIDTH / bitmap.width);
  const { canvas, ctx } = whiteCanvas(bitmap.width * scale, bitmap.height * scale);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToJpeg(canvas);
}

async function pdfThumb(blob: Blob) {
  const pdfjs = await loadPdfjs();

  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: THUMB_WIDTH / base.width });
    const { canvas } = whiteCanvas(viewport.width, viewport.height);
    // 'print' draws in one go instead of waiting on screen refreshes, so it
    // also finishes if the tab is in the background.
    await page.render({ canvas, viewport, background: 'white', intent: 'print' }).promise;
    return await canvasToJpeg(canvas);
  } finally {
    await task.destroy();
  }
}

/** A small JPEG of the proof, or null if it can't be made (the card shows an icon instead). */
export async function makeThumbnail(blob: Blob, contentType: string): Promise<Blob | null> {
  try {
    if (contentType === 'application/pdf') return await pdfThumb(blob);
    if (contentType === 'image/jpeg' || contentType === 'image/png') return await imageThumb(blob);
  } catch (err) {
    console.warn('thumbnail', err);
  }
  return null;
}
