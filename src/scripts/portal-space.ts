// One client group's page: the Files tab (two-way transfer) and the Reviews
// tab (proofs with a shared comment thread per version).

import { api, el, formatDate, formatSize, uploadInParts } from './portal-api';

interface FileRow { id: string; name: string; size: number; uploaded_by: string; created_at: string }
interface Proof { id: string; title: string; created_at: string; updated_at: string }
interface Version { id: string; proof_id: string; version: number; name: string; size: number; content_type: string; note: string | null; created_at: string }
interface Comment { id: string; version_id: string; author_email: string; author_name: string; body: string; created_at: string; addressed_at: string | null }

const root = document.querySelector<HTMLElement>('[data-portal-space]')!;
const client = root.dataset.client!;
const space = root.dataset.space!;
const base = `${encodeURIComponent(client)}/${encodeURIComponent(space)}`;
const NAME_KEY = 'portal-display-name';

let me = '';
let isAdmin = false;

function showError(target: HTMLElement, err: unknown) {
  target.textContent = err instanceof Error ? err.message : String(err);
  target.hidden = false;
}

function savedName() {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
}
function saveName(name: string) {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* private browsing */ }
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

/* ── Reviews ──────────────────────────────────────────────────── */

const proofList = root.querySelector<HTMLElement>('#portal-proof-list')!;
const reviewsError = root.querySelector<HTMLElement>('#portal-reviews-error')!;
const postForm = root.querySelector<HTMLFormElement>('#portal-post-proof')!;
const proofSelect = postForm.querySelector<HTMLSelectElement>('[name="proof"]')!;
const titleField = postForm.querySelector<HTMLElement>('#portal-title-field')!;

function viewUrl(v: Version, download = false) {
  return `/api/portal/versions/${v.id}/view${download ? '?download' : ''}`;
}

function renderComment(c: Comment) {
  const actions = el('span', { class: 'portal-comment-actions' });
  if (isAdmin) {
    const toggle = el('button', { type: 'button', class: 'portal-text-button' },
      c.addressed_at ? 'Mark not addressed' : 'Mark addressed');
    toggle.addEventListener('click', async () => {
      try {
        await api(`comments/${c.id}/addressed`, { method: 'POST', body: JSON.stringify({ addressed: !c.addressed_at }) });
        await loadProofs();
      } catch (err) { showError(reviewsError, err); }
    });
    actions.append(toggle);
  }
  if (isAdmin || c.author_email === me) {
    const del = el('button', { type: 'button', class: 'portal-text-button' }, 'Delete');
    del.addEventListener('click', async () => {
      if (!confirm('Delete this comment?')) return;
      try { await api(`comments/${c.id}`, { method: 'DELETE' }); await loadProofs(); }
      catch (err) { showError(reviewsError, err); }
    });
    actions.append(del);
  }
  return el('li', { class: `portal-comment${c.addressed_at ? ' is-addressed' : ''}` },
    el('p', { class: 'portal-comment-head' },
      el('strong', {}, c.author_name),
      el('span', { class: 'portal-meta' }, ` · ${formatDate(c.created_at, true)}`),
      c.addressed_at ? el('span', { class: 'portal-badge' }, 'Addressed') : null,
    ),
    el('p', { class: 'portal-comment-body' }, c.body),
    actions,
  );
}

function renderThread(v: Version, comments: Comment[], canPost: boolean) {
  const thread = el('section', { class: 'portal-thread', 'aria-label': `Comments on version ${v.version}` },
    el('h4', { class: 'portal-thread-title' },
      comments.length ? `Comments (${comments.length})` : 'No comments yet'),
  );
  if (comments.length) thread.append(el('ol', { class: 'portal-comments' }, ...comments.map(renderComment)));

  if (canPost) {
    const nameInput = el('input', { type: 'text', name: 'name', maxlength: '60', required: true, autocomplete: 'name', value: savedName() });
    const body = el('textarea', { name: 'body', rows: '3', maxlength: '4000', required: true });
    const error = el('p', { class: 'portal-error', role: 'alert', hidden: true });
    const button = el('button', { type: 'submit', class: 'portal-button' }, 'Post comment');
    const form = el('form', { class: 'portal-comment-form' },
      el('label', { class: 'portal-label' }, 'Your name', nameInput),
      el('label', { class: 'portal-label' }, 'Comment', body),
      error, button,
    );
    form.addEventListener('submit', async e => {
      e.preventDefault();
      button.disabled = true;
      try {
        saveName(nameInput.value.trim());
        await api(`versions/${v.id}/comments`, {
          method: 'POST', body: JSON.stringify({ name: nameInput.value, body: body.value }),
        });
        await loadProofs();
      } catch (err) { showError(error, err); button.disabled = false; }
    });
    thread.append(form);
  }
  return thread;
}

function renderViewer(v: Version, title: string) {
  if (v.content_type === 'application/pdf') {
    return el('div', { class: 'portal-viewer' },
      el('iframe', { class: 'portal-pdf', src: viewUrl(v), title: `${title}, version ${v.version}`, loading: 'lazy' }),
    );
  }
  return el('a', { class: 'portal-viewer', href: viewUrl(v), target: '_blank', rel: 'noopener' },
    el('img', { class: 'portal-image', src: viewUrl(v), alt: `${title}, version ${v.version}`, loading: 'lazy' }),
  );
}

function versionLinks(v: Version) {
  return el('p', { class: 'portal-links' },
    el('a', { class: 'cta-link', href: viewUrl(v), target: '_blank', rel: 'noopener' }, 'Open full size'),
    el('a', { class: 'cta-link', href: viewUrl(v, true) }, `Download original (${formatSize(v.size)})`),
  );
}

function versionMeta(v: Version) {
  return el('p', { class: 'portal-meta' },
    `Version ${v.version} · posted ${formatDate(v.created_at)}`,
    v.note ? el('span', { class: 'portal-note' }, v.note) : null,
  );
}

async function loadProofs() {
  const data = await api<{ proofs: Proof[]; versions: Version[]; comments: Comment[]; me: string; isAdmin: boolean }>(`${base}/proofs`);
  me = data.me;
  isAdmin = data.isAdmin;
  postForm.hidden = !isAdmin;

  proofSelect.replaceChildren(el('option', { value: '' }, 'A new proof'),
    ...data.proofs.map(p => el('option', { value: p.id }, `New version of “${p.title}”`)));
  titleField.hidden = proofSelect.value !== '';

  proofList.replaceChildren();
  if (data.proofs.length === 0) {
    proofList.append(el('p', { class: 'portal-empty' }, 'No proofs to review yet.'));
    return;
  }
  for (const p of data.proofs) {
    const versions = data.versions.filter(v => v.proof_id === p.id);
    const [latest, ...earlier] = versions;
    if (!latest) continue;
    const threadFor = (v: Version) => data.comments.filter(c => c.version_id === v.id);

    const latestComments = threadFor(latest);
    const thread = renderThread(latest, latestComments, true);
    const n = latestComments.length;
    const jump = el('a', { class: 'portal-comment-count', href: '#' },
      n === 0 ? 'No comments yet' : n === 1 ? '1 comment' : `${n} comments`);
    jump.addEventListener('click', e => {
      e.preventDefault();
      thread.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    const article = el('article', { class: 'portal-proof' },
      el('div', { class: 'portal-proof-head' },
        el('h3', { class: 'portal-proof-title' }, p.title),
        jump,
      ),
      versionMeta(latest),
      renderViewer(latest, p.title),
      versionLinks(latest),
      thread,
    );

    if (earlier.length) {
      const details = el('details', { class: 'portal-earlier' },
        el('summary', {}, `Earlier versions (${earlier.length})`));
      for (const v of earlier) {
        details.append(el('div', { class: 'portal-earlier-version' },
          versionMeta(v), versionLinks(v), renderThread(v, threadFor(v), false)));
      }
      article.append(details);
    }

    if (isAdmin) {
      const del = el('button', { type: 'button', class: 'portal-text-button' }, 'Delete this proof and all its versions');
      del.addEventListener('click', async () => {
        if (!confirm(`Delete “${p.title}”, every version and every comment? This can’t be undone.`)) return;
        try { await api(`proofs/${p.id}`, { method: 'DELETE' }); await loadProofs(); }
        catch (err) { showError(reviewsError, err); }
      });
      article.append(el('p', { class: 'portal-admin-row' }, del));
    }
    proofList.append(article);
  }
}

proofSelect.addEventListener('change', () => { titleField.hidden = proofSelect.value !== ''; });

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
    await uploadInParts(base, file, {
      kind: 'proof',
      proofId: String(form.get('proof') || '') || undefined,
      title: String(form.get('title') || ''),
      note: String(form.get('note') || ''),
      onProgress: f => { bar.value = f; },
    });
    postForm.reset();
    await loadProofs();
  } catch (err) {
    showError(error, err);
  } finally {
    button.disabled = false;
    bar.hidden = true;
    bar.value = 0;
  }
});

loadFiles().catch(err => showError(filesError, err));
loadProofs().catch(err => showError(reviewsError, err));
