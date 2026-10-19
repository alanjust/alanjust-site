// One client group's page: the Files tab (two-way transfer) and the Reviews
// tab (proofs with a shared comment thread per version).

import { api, el, formatDate, formatSize, uploadInParts, saveThumbnail } from './portal-api';
import { proofTypes, proofStatuses } from '../lib/portal';

interface FileRow { id: string; name: string; size: number; uploaded_by: string; created_at: string }

const root = document.querySelector<HTMLElement>('[data-portal-space]')!;
const client = root.dataset.client!;
const space = root.dataset.space!;
const base = `${encodeURIComponent(client)}/${encodeURIComponent(space)}`;

let me = '';
let isAdmin = false;

function showError(target: HTMLElement, err: unknown) {
  target.textContent = err instanceof Error ? err.message : String(err);
  target.hidden = false;
}

/* ── Tabs ─────────────────────────────────────────────────────── */

const tabs = [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
function selectTab(name: string) {
  for (const tab of tabs) {
    const on = tab.dataset.tab === name;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')!)!.hidden = !on;
  }
}
for (const tab of tabs) {
  tab.addEventListener('click', () => {
    selectTab(tab.dataset.tab!);
    history.replaceState(null, '', `#${tab.dataset.tab}`);
  });
}
selectTab(location.hash === '#reviews' ? 'reviews' : 'files');

/* ── Files ────────────────────────────────────────────────────── */

const fileInput = root.querySelector<HTMLInputElement>('#portal-file-input')!;
const dropZone = root.querySelector<HTMLElement>('#portal-drop')!;
const queue = root.querySelector<HTMLElement>('#portal-upload-queue')!;
const fileList = root.querySelector<HTMLElement>('#portal-file-list')!;
const filesError = root.querySelector<HTMLElement>('#portal-files-error')!;

async function loadFiles() {
  const data = await api<{ files: FileRow[]; me: string; isAdmin: boolean }>(`${base}/files`);
  me = data.me;
  isAdmin = data.isAdmin;
  fileList.replaceChildren();
  if (data.files.length === 0) {
    fileList.append(el('p', { class: 'portal-empty' }, 'Nothing here yet.'));
    return;
  }
  const rows = data.files.map(f => {
    const del = (isAdmin || f.uploaded_by === me)
      ? el('button', { type: 'button', class: 'portal-text-button', 'aria-label': `Delete ${f.name}` }, 'Delete')
      : null;
    del?.addEventListener('click', async () => {
      if (!confirm(`Delete “${f.name}”? This can’t be undone.`)) return;
      try { await api(`files/${f.id}`, { method: 'DELETE' }); await loadFiles(); }
      catch (err) { showError(filesError, err); }
    });
    return el('li', { class: 'portal-file' },
      el('a', { class: 'portal-file-name', href: `/api/portal/files/${f.id}/download` }, f.name),
      el('span', { class: 'portal-meta' }, `${formatSize(f.size)} · ${f.uploaded_by} · ${formatDate(f.created_at)}`),
      del,
    );
  });
  fileList.append(el('ul', { class: 'portal-file-rows' }, ...rows));
}

async function uploadFiles(files: FileList | File[]) {
  filesError.hidden = true;
  for (const file of [...files]) {
    const bar = el('progress', { max: '1', value: '0' });
    const status = el('span', { class: 'portal-meta' }, 'Starting…');
    const row = el('li', { class: 'portal-upload' }, el('span', { class: 'portal-file-name' }, file.name), bar, status);
    queue.append(row);
    try {
      await uploadInParts(base, file, {
        kind: 'file',
        onProgress: f => { bar.value = f; status.textContent = `${Math.round(f * 100)}%`; },
      });
      row.remove();
      await loadFiles();
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : 'Upload failed.';
      row.classList.add('is-error');
    }
  }
}

fileInput.addEventListener('change', () => {
  if (fileInput.files?.length) uploadFiles(fileInput.files);
  fileInput.value = '';
});
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('is-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('is-over');
  if (e.dataTransfer?.files.length) uploadFiles(e.dataTransfer.files);
});

/* ── Reviews: one card per proof ─────────────────────────────── */

interface ProofCard {
  id: string; title: string; status: string; updated_at: string;
  latest_id: string; version: number; content_type: string; has_thumb: number;
  comments: number; new_comments: number;
}

const cardGrid = root.querySelector<HTMLElement>('#portal-cards')!;
const finished = root.querySelector<HTMLDetailsElement>('#portal-finished')!;
const finishedGrid = finished.querySelector<HTMLElement>('.portal-card-grid')!;
const finishedLabel = finished.querySelector<HTMLElement>('summary')!;
const reviewsError = root.querySelector<HTMLElement>('#portal-reviews-error')!;
const newProofButton = root.querySelector<HTMLButtonElement>('#portal-new-proof')!;
const postForm = root.querySelector<HTMLFormElement>('#portal-post-proof')!;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function renderCard(p: ProofCard) {
  const thumb = p.has_thumb
    ? el('img', { src: `/api/portal/versions/${p.latest_id}/thumb`, alt: '', loading: 'lazy' })
    : el('span', { class: 'portal-card-icon' }, proofTypes[p.content_type] ?? 'File');
  return el('li', {},
    el('a', { class: 'portal-card', href: `review/?id=${encodeURIComponent(p.id)}` },
      el('span', { class: 'portal-card-thumb' }, thumb),
      el('span', { class: 'portal-card-body' },
        el('span', { class: `portal-status portal-status--${p.status}` }, proofStatuses[p.status] ?? p.status),
        el('span', { class: 'portal-card-title' }, p.title),
        el('span', { class: 'portal-meta' }, `Version ${p.version} · updated ${formatDate(p.updated_at)}`),
        el('span', { class: 'portal-meta' },
          p.comments ? plural(p.comments, 'comment') : 'No comments yet',
          p.new_comments ? el('span', { class: 'portal-new' }, `${p.new_comments} new`) : null,
        ),
      ),
    ),
  );
}

async function loadProofs() {
  const data = await api<{ proofs: ProofCard[]; isAdmin: boolean }>(`${base}/proofs`);
  newProofButton.hidden = !data.isAdmin;
  const active = data.proofs.filter(p => p.status !== 'approved');
  const done = data.proofs.filter(p => p.status === 'approved');

  cardGrid.replaceChildren(active.length
    ? el('ul', { class: 'portal-card-grid' }, ...active.map(renderCard))
    : el('p', { class: 'portal-empty' }, done.length ? 'Nothing waiting on review right now.' : 'No proofs to review yet.'));

  finished.hidden = done.length === 0;
  finishedLabel.textContent = `Approved (${done.length})`;
  finishedGrid.replaceChildren(...done.map(renderCard));
}

newProofButton.addEventListener('click', () => {
  postForm.hidden = !postForm.hidden;
  if (!postForm.hidden) postForm.querySelector<HTMLInputElement>('[name="title"]')!.focus();
});
postForm.querySelector('[data-cancel]')!.addEventListener('click', () => { postForm.reset(); postForm.hidden = true; });

postForm.addEventListener('submit', async e => {
  e.preventDefault();
  const form = new FormData(postForm);
  const file = form.get('file');
  const error = postForm.querySelector<HTMLElement>('.portal-error')!;
  const bar = postForm.querySelector<HTMLProgressElement>('progress')!;
  const button = postForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  if (!(file instanceof File) || !file.size) return;
  error.hidden = true;
  button.disabled = true;
  bar.hidden = false;
  try {
    const done = await uploadInParts(base, file, {
      kind: 'proof',
      title: String(form.get('title') || ''),
      note: String(form.get('note') || ''),
      onProgress: f => { bar.value = f * 0.9; },
    });
    await saveThumbnail(done.versionId, file, file.type);
    location.href = `review/?id=${encodeURIComponent(done.proofId)}`;
  } catch (err) {
    showError(error, err);
    button.disabled = false;
    bar.hidden = true;
    bar.value = 0;
  }
});

loadFiles().catch(err => showError(filesError, err));
loadProofs().catch(err => showError(reviewsError, err));
// Coming back from a review page should show fresh badges.
window.addEventListener('pageshow', e => { if (e.persisted) loadProofs().catch(() => {}); });
