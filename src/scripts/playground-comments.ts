// Invite-link comments on a Playground project. Alan texts a friend a link
// with ?invite=…; this browser remembers it and can then read and add
// comments. Everyone else never sees the comment section at all.

const root = document.querySelector<HTMLElement>('[data-playground-project]')!;
const slug = root.dataset.slug!;
const section = root.querySelector<HTMLElement>('#playground-comments')!;
const list = root.querySelector<HTMLOListElement>('#playground-comment-list')!;
const form = root.querySelector<HTMLFormElement>('#playground-comment-form')!;
const expired = root.querySelector<HTMLElement>('#playground-invite-expired')!;
const KEY = `playground-invite-${slug}`;
const NAME_KEY = 'portal-display-name';

function store(key: string, value?: string | null) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch { /* private browsing: the link still works for this visit */ }
  return null;
}

// Take the invite out of the address bar so it isn't shared by accident.
const params = new URLSearchParams(location.search);
let token = params.get('invite') || store(KEY) || '';
if (params.has('invite')) {
  store(KEY, token);
  params.delete('invite');
  history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
}

interface Comment { id: string; name: string; body: string; created_at: string }

async function call(method: 'GET' | 'POST', body?: unknown) {
  const res = await fetch(`/api/playground/${encodeURIComponent(slug)}/comments`, {
    method,
    headers: { 'X-Invite': token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function render(comments: Comment[]) {
  list.replaceChildren(...comments.map(c => {
    const li = document.createElement('li');
    li.className = 'portal-comment';
    const head = document.createElement('p');
    head.className = 'portal-comment-head';
    const name = document.createElement('strong');
    name.textContent = c.name;
    const when = document.createElement('span');
    when.className = 'portal-meta';
    const d = new Date(c.created_at);
    when.textContent = ` · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    head.append(name, when);
    const body = document.createElement('p');
    body.className = 'portal-comment-body';
    body.textContent = c.body;
    li.append(head, body);
    return li;
  }));
  if (comments.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'portal-empty';
    empty.textContent = 'No comments yet. You could be first.';
    list.append(empty);
  }
}

async function load() {
  if (!token) return;
  const res = await call('GET');
  if (res.status === 403) {
    store(KEY, null);
    token = '';
    expired.hidden = false;
    return;
  }
  if (!res.ok) return;
  render(res.data.comments);
  section.hidden = false;
}

const nameInput = form.querySelector<HTMLInputElement>('[name="name"]')!;
nameInput.value = store(NAME_KEY) ?? '';

form.addEventListener('submit', async e => {
  e.preventDefault();
  const error = form.querySelector<HTMLElement>('.portal-error')!;
  const button = form.querySelector<HTMLButtonElement>('button')!;
  const data = new FormData(form);
  error.hidden = true;
  button.disabled = true;
  const res = await call('POST', { name: data.get('name'), body: data.get('body') });
  button.disabled = false;
  if (!res.ok) {
    error.textContent = res.data.error || 'That didn’t post. Try again in a minute.';
    error.hidden = false;
    return;
  }
  store(NAME_KEY, String(data.get('name') ?? '').trim());
  form.querySelector('textarea')!.value = '';
  await load();
});

load().catch(() => {});
