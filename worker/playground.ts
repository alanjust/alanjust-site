// Playground comments. The public side needs the project's invite token;
// the admin side (inside the Access-guarded portal) lets Alan make, reset
// and read links and delete comments.

import type { PortalUser } from './auth';

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
const fail = (message: string, status: number) => json({ error: message }, status);
const now = () => new Date().toISOString();
const validSlug = (s: string) => /^[a-z0-9][a-z0-9-]{0,79}$/.test(s);

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// /api/playground/:slug/comments (public, invite token in X-Invite)
export async function handlePlaygroundApi(request: Request, env: Env, path: string[]): Promise<Response> {
  const [slug, what] = path;
  if (!slug || !validSlug(slug) || what !== 'comments' || path.length !== 2) return fail('Not found', 404);
  const db = env.PORTAL_DB;

  const token = request.headers.get('X-Invite') ?? '';
  const invite = token
    ? await db.prepare('SELECT slug FROM playground_invites WHERE slug = ? AND token = ?').bind(slug, token).first()
    : null;
  if (!invite) return fail('This invite link has been replaced.', 403);

  if (request.method === 'GET') {
    const { results } = await db.prepare(
      'SELECT id, name, body, created_at FROM playground_comments WHERE slug = ? ORDER BY created_at ASC',
    ).bind(slug).all();
    return json({ comments: results });
  }

  if (request.method === 'POST') {
    const body = await request.json<{ name?: string; body?: string }>().catch(() => ({} as { name?: string; body?: string }));
    const name = String(body.name ?? '').trim().slice(0, 60);
    const text = String(body.body ?? '').trim().slice(0, 4000);
    if (!name) return fail('Add your name so Alan knows who it’s from.', 400);
    if (!text) return fail('Write something first.', 400);

    // A link that got passed around too far shouldn't flood the page.
    const hourAgo = new Date(Date.now() - 3600_000).toISOString();
    const recent = await db.prepare('SELECT COUNT(*) AS n FROM playground_comments WHERE slug = ? AND created_at > ?')
      .bind(slug, hourAgo).first<{ n: number }>();
    if ((recent?.n ?? 0) >= 30) return fail('Lots of comments in the last hour. Try again a little later.', 429);

    const id = crypto.randomUUID();
    await db.prepare('INSERT INTO playground_comments (id, slug, name, body, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, slug, name, text, now()).run();
    return json({ id });
  }
  return fail('Not found', 404);
}

// /api/portal/playground/... (admin only, behind Access)
export async function handlePlaygroundAdmin(request: Request, env: Env, user: PortalUser, path: string[]): Promise<Response> {
  if (!user.isAdmin) return fail('Only Alan manages the Playground.', 403);
  const db = env.PORTAL_DB;
  const method = request.method;
  if (method !== 'GET' && request.headers.get('X-Portal') !== '1') return fail('Missing request header', 400);

  // GET /api/portal/playground—every link and comment
  if (path.length === 0 && method === 'GET') {
    const invites = (await db.prepare('SELECT slug, token, created_at FROM playground_invites').all()).results;
    const comments = (await db.prepare(
      'SELECT id, slug, name, body, created_at FROM playground_comments ORDER BY created_at DESC',
    ).all()).results;
    return json({ invites, comments });
  }

  // POST /api/portal/playground/:slug/invite—make or replace the link
  if (path.length === 2 && path[1] === 'invite' && method === 'POST' && validSlug(path[0])) {
    const token = newToken();
    await db.prepare(
      `INSERT INTO playground_invites (slug, token, created_at) VALUES (?, ?, ?)
       ON CONFLICT (slug) DO UPDATE SET token = excluded.token, created_at = excluded.created_at`,
    ).bind(path[0], token, now()).run();
    return json({ slug: path[0], token });
  }

  // DELETE /api/portal/playground/:slug/invite—turn comments off for a project
  if (path.length === 2 && path[1] === 'invite' && method === 'DELETE' && validSlug(path[0])) {
    await db.prepare('DELETE FROM playground_invites WHERE slug = ?').bind(path[0]).run();
    return json({ ok: true });
  }

  // DELETE /api/portal/playground/comments/:id
  if (path.length === 2 && path[0] === 'comments' && method === 'DELETE') {
    await db.prepare('DELETE FROM playground_comments WHERE id = ?').bind(path[1]).run();
    return json({ ok: true });
  }
  return fail('Not found', 404);
}
