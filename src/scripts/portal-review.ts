// One proof's review page: the proof on the left, its comment thread on the
// right (stacked on phones), a switcher for earlier versions, and Alan's
// controls for status, new versions and deleting.

import { api, el, formatDate, formatSize, uploadInParts, saveThumbnail } from './portal-api';
import { proofStatuses } from '../lib/portal';

interface Proof { id: string; title: string; status: string; updated_at: string }
interface Version { id: string; version: number; name: string; size: number; content_type: string; note: string | null; created_at: string; has_thumb: number }
interface Comment { id: string; version_id: string; author_email: string; author_name: string; body: string; created_at: string; addressed_at: string | null }
interface Detail { proof: Proof; versions: Version[]; comments: Comment[]; seenAt: string | null; me: string; isAdmin: boolean }

const root = document.querySelector<HTMLElement>('[data-portal-review]')!;
const base = `${encodeURIComponent(root.dataset.client!)}/${encodeURIComponent(root.dataset.space!)}`;
const proofId = new URLSearchParams(location.search).get('id') ?? '';
const NAME_KEY = 'portal-display-name';

const titleEl = root.querySelector<HTMLElement>('#portal-review-title')!;
const pill = root.querySelector<HTMLElement>('#portal-status-pill')!;
const picker = root.querySelector<HTMLElement>('#portal-status-picker')!;
const select = root.querySelector<HTMLSelectElement>('#portal-status-select')!;
const versionTabs = root.querySelector<HTMLElement>('#portal-version-tabs')!;
const proofPane = root.querySelector<HTMLElement>('#portal-review-proof')!;
const threadPane = root.querySelector<HTMLElement>('#portal-review-thread')!;
const adminArea = root.querySelector<HTMLElement>('#portal-review-admin')!;
const pageError = root.querySelector<HTMLElement>('#portal-review-error')!;

let data: Detail;
let shownVersionId = '';
// Comments newer than this (and not yours) get a "New" tag. Captured once,
// before we tell the server you've looked.
let previousVisit: string | null = null;

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
const viewUrl = (v: Version, download = false) => `/api/portal/versions/${v.id}/view${download ? '?download' : ''}`;

/* ── Proof ──────────────────────────────────────────────────── */

function renderProof(v: Version) {
  const latest = v.id === data.versions[0].id;
  const viewer = v.content_type === 'application/pdf'
    ? el('div', { class: 'portal-viewer' },
        el('iframe', { class: 'portal-pdf', src: viewUrl(v), title: `${data.proof.title}, version ${v.version}` }))
    : el('a', { class: 'portal-viewer', href: viewUrl(v), target: '_blank', rel: 'noopener' },
        el('img', { class: 'portal-image', src: viewUrl(v), alt: `${data.proof.title}, version ${v.version}` }));
  proofPane.replaceChildren(
    el('p', { class: 'portal-meta' },
      `Version ${v.version}${latest ? ' (latest)' : ''} · posted ${formatDate(v.created_at)}`,
      v.note ? el('span', { class: 'portal-note' }, v.note) : null),
    viewer,
    el('p', { class: 'portal-links' },
      el('a', { class: 'cta-link', href: viewUrl(v), target: '_blank', rel: 'noopener' }, 'Open full size'),
      el('a', { class: 'cta-link', href: viewUrl(v, true) }, `Download original (${formatSize(v.size)})`)),
  );
}

/* ── Comments ───────────────────────────────────────────────── */

function isNew(c: Comment) {
  return c.author_email !== data.me && (!previousVisit || c.created_at > previousVisit);
}

function renderComment(c: Comment) {
  const actions = el('span', { class: 'portal-comment-actions' });
  if (data.isAdmin) {
    const toggle = el('button', { type: 'button', class: 'portal-text-button' },
      c.addressed_at ? 'Mark not addressed' : 'Mark addressed');
    toggle.addEventListener('click', async () => {
      try {
        await api(`comments/${c.id}/addressed`, { method: 'POST', body: JSON.stringify({ addressed: !c.addressed_at }) });
        await load();
      } catch (err) { showError(pageError, err); }
    });
    actions.append(toggle);
  }
  if (data.isAdmin || c.author_email === data.me) {
    const del = el('button', { type: 'button', class: 'portal-text-button' }, 'Delete');
    del.addEventListener('click', async () => {
      if (!confirm('Delete this comment?')) return;
      try { await api(`comments/${c.id}`, { method: 'DELETE' }); await load(); }
      catch (err) { showError(pageError, err); }
    });
    actions.append(del);
  }
  return el('li', { class: `portal-comment${c.addressed_at ? ' is-addressed' : ''}${isNew(c) ? ' is-new' : ''}` },
    el('p', { class: 'portal-comment-head' },
      el('strong', {}, c.author_name),
      el('span', { class: 'portal-meta' }, ` · ${formatDate(c.created_at, true)}`),
      isNew(c) ? el('span', { class: 'portal-new' }, 'New') : null,
      c.addressed_at ? el('span', { class: 'portal-badge' }, 'Addressed') : null),
    el('p', { class: 'portal-comment-body' }, c.body),
    actions,
  );
}

function renderThread(v: Version) {
  const latest = v.id === data.versions[0].id;
  const comments = data.comments.filter(c => c.version_id === v.id);
  threadPane.replaceChildren(
    el('h2', { class: 'portal-thread-title' }, comments.length ? `Comments (${comments.length})` : 'No comments yet'),
  );
  if (comments.length) threadPane.append(el('ol', { class: 'portal-comments' }, ...comments.map(renderComment)));

  if (!latest) {
    threadPane.append(el('p', { class: 'portal-meta' }, 'This is an earlier version, so its comments are closed. Comment on the latest version instead.'));
    return;
  }
  const nameInput = el('input', { type: 'text', name: 'name', maxlength: '60', required: true, autocomplete: 'name', value: savedName() });
  const body = el('textarea', { name: 'body', rows: '4', maxlength: '4000', required: true });
  const error = el('p', { class: 'portal-error', role: 'alert', hidden: true });
  const button = el('button', { type: 'submit', class: 'portal-button' }, 'Post comment');
  const form = el('form', { class: 'portal-comment-form' },
    el('label', { class: 'portal-label' }, 'Your name', nameInput),
    el('label', { class: 'portal-label' }, 'Comment', body),
    error, button);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    button.disabled = true;
    try {
      saveName(nameInput.value.trim());
      await api(`versions/${v.id}/comments`, { method: 'POST', body: JSON.stringify({ name: nameInput.value, body: body.value }) });
      await load();
      api(`proofs/${proofId}/seen`, { method: 'POST' }).catch(() => {});
    } catch (err) { showError(error, err); button.disabled = false; }
  });
  threadPane.append(form);
}

/* ── Versions ───────────────────────────────────────────────── */

function showVersion(id: string) {
  shownVersionId = id;
  const v = data.versions.find(x => x.id === id) ?? data.versions[0];
  for (const b of versionTabs.querySelectorAll<HTMLButtonElement>('button')) {
    b.setAttribute('aria-pressed', String(b.dataset.version === v.id));
  }
  renderProof(v);
  renderThread(v);
}

function renderVersionTabs() {
  versionTabs.hidden = data.versions.length < 2;
  versionTabs.replaceChildren(...data.versions.map((v, i) => {
    const count = data.comments.filter(c => c.version_id === v.id).length;
    const b = el('button', { type: 'button', class: 'portal-version-tab', 'data-version': v.id },
      `Version ${v.version}${i === 0 ? ' (latest)' : ''}`,
      count ? el('span', { class: 'portal-meta' }, ` · ${count}`) : null);
    b.addEventListener('click', () => showVersion(v.id));
    return b;
  }));
}

async function load() {
  data = await api<Detail>(`proofs/${encodeURIComponent(proofId)}`);
  document.title = `${data.proof.title} | Review`;
  titleEl.textContent = data.proof.title;
  pill.className = `portal-status portal-status--${data.proof.status}`;
  pill.textContent = proofStatuses[data.proof.status] ?? data.proof.status;
  picker.hidden = !data.isAdmin;
  pill.hidden = data.isAdmin;
  select.value = data.proof.status;
  adminArea.hidden = !data.isAdmin;
  renderVersionTabs();
  const keep = data.versions.some(v => v.id === shownVersionId) ? shownVersionId : data.versions[0].id;
  showVersion(keep);
}

/* ── Alan's controls ────────────────────────────────────────── */

select.addEventListener('change', async () => {
  try {
    await api(`proofs/${proofId}/status`, { method: 'POST', body: JSON.stringify({ status: select.value }) });
    await load();
  } catch (err) { showError(pageError, err); }
});

const versionForm = root.querySelector<HTMLFormElement>('#portal-post-version')!;
versionForm.addEventListener('submit', async e => {
  e.preventDefault();
  const form = new FormData(versionForm);
  const file = form.get('file');
  const error = versionForm.querySelector<HTMLElement>('.portal-error')!;
  const bar = versionForm.querySelector<HTMLProgressElement>('progress')!;
  const button = versionForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  if (!(file instanceof File) || !file.size) return;
  error.hidden = true;
  button.disabled = true;
  bar.hidden = false;
  try {
    const done = await uploadInParts(base, file, {
      kind: 'proof', proofId, note: String(form.get('note') || ''),
      onProgress: f => { bar.value = f * 0.9; },
    });
    await saveThumbnail(done.versionId, file, file.type);
    versionForm.reset();
    versionForm.closest('details')!.open = false;
    shownVersionId = '';
    await load();
  } catch (err) {
    showError(error, err);
  } finally {
    button.disabled = false;
    bar.hidden = true;
    bar.value = 0;
  }
});

root.querySelector('#portal-delete-proof')!.addEventListener('click', async () => {
  if (!confirm(`Delete “${data.proof.title}”, every version and every comment? This can’t be undone.`)) return;
  try {
    await api(`proofs/${proofId}`, { method: 'DELETE' });
    location.href = root.dataset.back!;
  } catch (err) { showError(pageError, err); }
});

// Proofs posted before cards existed have no picture yet. When Alan opens
// one, quietly make it from the proof itself.
async function backfillThumbnail() {
  const latest = data.versions[0];
  if (!data.isAdmin || latest.has_thumb) return;
  const res = await fetch(viewUrl(latest));
  if (res.ok) await saveThumbnail(latest.id, await res.blob(), latest.content_type);
}

/* ── Start ──────────────────────────────────────────────────── */

if (!proofId) {
  titleEl.textContent = 'Proof not found';
} else {
  api<Detail>(`proofs/${encodeURIComponent(proofId)}`)
    .then(first => {
      previousVisit = first.seenAt;
      return load();
    })
    .then(() => {
      api(`proofs/${proofId}/seen`, { method: 'POST' }).catch(() => {});
      backfillThumbnail().catch(() => {});
    })
    .catch(err => { titleEl.textContent = 'Proof not found'; showError(pageError, err); });
}
