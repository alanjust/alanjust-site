// pdf.js, loaded only when a page actually needs it: Alan's thumbnail maker,
// and PDF proofs on phones (where Safari can't shrink a PDF to fit a frame).

export async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  }
  return pdfjs;
}

/**
 * Draws every page of a PDF into `host`, each fitted to its width, stacked
 * top to bottom. Pages are drawn as they scroll near the screen so a long
 * catalog doesn't load all at once.
 */
export async function renderPdfPages(url: string, host: HTMLElement, label: string) {
  const pdfjs = await loadPdfjs();
  const task = pdfjs.getDocument({ url, withCredentials: true });
  const doc = await task.promise;
  const width = host.clientWidth || 320;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const slot = entry.target as HTMLElement;
      drawPage(Number(slot.dataset.page), slot).catch(err => console.warn('pdf page', err));
    }
  }, { rootMargin: '600px 0px' });

  async function drawPage(n: number, slot: HTMLElement) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (width / base.width) * ratio });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    canvas.className = 'portal-pdf-page-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${label}, page ${n} of ${doc.numPages}`);
    await page.render({ canvas, viewport, background: 'white', intent: 'print' }).promise;
    slot.replaceChildren(canvas);
    slot.style.removeProperty('aspect-ratio');
  }

  const first = (await doc.getPage(1)).getViewport({ scale: 1 });
  host.replaceChildren();
  for (let n = 1; n <= doc.numPages; n++) {
    const slot = document.createElement('div');
    slot.className = 'portal-pdf-page';
    slot.dataset.page = String(n);
    // Reserve roughly the right height so the page doesn't jump while drawing.
    slot.style.setProperty('aspect-ratio', `${first.width} / ${first.height}`);
    host.append(slot);
    observer.observe(slot);
  }
  if (doc.numPages > 1) {
    const note = document.createElement('p');
    note.className = 'portal-meta';
    note.textContent = `${doc.numPages} pages. Scroll to see them all; pinch to zoom.`;
    host.prepend(note);
  }
}
