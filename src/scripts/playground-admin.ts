// Alan's Playground invite page: make, copy, reset or turn off each
// project's invite link, and read or delete its comments.

import { api, el, formatDate } from './portal-api';

interface Invite { slug: string; token: string; created_at: string }
interface Comment { id: string; slug: string; name: string; body: string; created_at: string }

const root = document.querySelector<HTMLElement>('[data-playground-admin]')!;
const error = root.querySelector<HTMLElement>('#pg-admin-error')!;

function fail(err: unknown) {
  error.textContent = err instanceof Error ? err.message : String(err);
  error.hidden = false;
}

const linkFor = (slug: string, token: string) => `${location.origin}/playground/${slug}/?invite=${encodeURIComponent(token)}`;

async function load() {
  const data = await api<{ invites: Invite[]; comments: Comment[] }>('playground');
  for (const item of root.querySelectorAll<HTMLElement>('[data-slug]')) {
    const slug = item.dataset.slug!;
    const invite = data.invites.find(i => i.slug === slug);
    const area = item.querySelector<HTMLElement>('[data-link-area]')!;

    if (!invite) {
      const make = el('button', { type: 'button', class: 'portal-button' }, 'Make an invite link');
      make.addEventListener('click', () => api(`playground/${slug}/invite`, { method: 'POST' }).then(load).catch(fail));
      area.replaceChildren(make, el('span', { class: 'portal-meta' }, 'Comments are off for this project.'));
    } else {
      const field = el('input', { type: 'text', readonly: true, value: linkFor(slug, invite.token), 'aria-label': 'Invite link' });
      field.addEventListener('focus', () => field.select());
      const copy = el('button', { type: 'button', class: 'portal-button' }, 'Copy link');
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(field.value); copy.textContent = 'Copied'; }
        catch { field.select(); copy.textContent = 'Press ⌘C to copy'; }
        setTimeout(() => { copy.textContent = 'Copy link'; }, 2000);
      });
      const reset = el('button', { type: 'button', class: 'portal-text-button' }, 'Reset link');
      reset.addEventListener('click', () => {
        if (!confirm('Make a new link? The old one stops working, so people will need the new one.')) return;
        api(`playground/${slug}/invite`, { method: 'POST' }).then(load).catch(fail);
      });
      const off = el('button', { type: 'button', class: 'portal-text-button' }, 'Turn comments off');
      off.addEventListener('click', () => {
        if (!confirm('Turn comments off? The link stops working. Existing comments are kept.')) return;
        api(`playground/${slug}/invite`, { method: 'DELETE' }).then(load).catch(fail);
      });
      area.replaceChildren(field, copy, reset, off);
    }

    const comments = data.comments.filter(c => c.slug === slug);
    const details = item.querySelector<HTMLDetailsElement>('[data-comments]')!;
    details.querySelector('summary')!.textContent = comments.length ? `Comments (${comments.length})` : 'No comments yet';
    details.querySelector('ol')!.replaceChildren(...comments.map(c => {
      const del = el('button', { type: 'button', class: 'portal-text-button' }, 'Delete');
      del.addEventListener('click', () => {
        if (!confirm('Delete this comment?')) return;
        api(`playground/comments/${c.id}`, { method: 'DELETE' }).then(load).catch(fail);
      });
      return el('li', { class: 'portal-comment' },
        el('p', { class: 'portal-comment-head' }, el('strong', {}, c.name),
          el('span', { class: 'portal-meta' }, ` · ${formatDate(c.created_at, true)}`)),
        el('p', { class: 'portal-comment-body' }, c.body),
        el('span', { class: 'portal-comment-actions' }, del));
    }));
  }
}

load().catch(fail);
