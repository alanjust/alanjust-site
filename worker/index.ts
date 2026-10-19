// The Worker in front of alanjust.com. Static pages are served straight from
// dist/ (see "assets" in wrangler.jsonc); this code only runs for /api and
// /portal, which make up the client portal.

import { getUser, canSee } from './auth';
import { handlePortalApi, cleanUp } from './portal';
import { findClient } from '../src/lib/portal';

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

function notAllowed() {
  return new Response(
    'This part of alanjust.com is for clients. If you think you should be able to see it, email alan@alanjust.com.',
    { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8', ...privateHeaders } },
  );
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    // Quick check that the storage is wired up. Reveals nothing private.
    if (url.pathname === '/api/health') {
      const db = await env.PORTAL_DB.prepare('SELECT 1 AS ok').first();
      const bucket = await env.PORTAL_FILES.list({ limit: 1 });
      return Response.json({ ok: true, db: db?.ok === 1, bucket: Array.isArray(bucket.objects) });
    }

    // Access guards alanjust.com only, so send www visitors to the guarded address.
    if (url.hostname.startsWith('www.') && (url.pathname.startsWith('/portal') || url.pathname.startsWith('/api/portal/'))) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname.startsWith('/api/portal/')) {
      const user = await getUser(request, env);
      if (!user) return Response.json({ error: 'Please sign in again.' }, { status: 401, headers: privateHeaders });
      const path = url.pathname.slice('/api/portal/'.length).split('/').filter(Boolean).map(decodeURIComponent);
      try {
        const res = await handlePortalApi(request, env, user, path);
        for (const [k, v] of Object.entries(privateHeaders)) if (!res.headers.has(k)) res.headers.set(k, v);
        return res;
      } catch (err) {
        console.error('portal api', url.pathname, err);
        return Response.json({ error: 'Something went wrong on the server.' }, { status: 500, headers: privateHeaders });
      }
    }

    if (url.pathname === '/portal' || url.pathname.startsWith('/portal/')) {
      const user = await getUser(request, env);
      if (!user) return notAllowed();
      const clientId = url.pathname.split('/')[2];
      if (clientId && (!findClient(clientId) || !canSee(user, clientId))) return notAllowed();

      const asset = await env.ASSETS.fetch(request);
      const res = new Response(asset.body, asset);
      for (const [k, v] of Object.entries(privateHeaders)) res.headers.set(k, v);
      return res;
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(cleanUp(env));
  },
} satisfies ExportedHandler<Env>;
