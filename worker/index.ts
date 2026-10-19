// The Worker in front of alanjust.com. Static pages are served straight from
// dist/ (see "assets" in wrangler.jsonc); this code only runs for /api and
// /portal, which the client portal will use.

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    // Quick check that the storage is wired up. Reveals nothing private.
    if (url.pathname === '/api/health') {
      const db = await env.PORTAL_DB.prepare('SELECT 1 AS ok').first();
      const bucket = await env.PORTAL_FILES.list({ limit: 1 });
      return Response.json({ ok: true, db: db?.ok === 1, bucket: Array.isArray(bucket.objects) });
    }

    // The portal isn't built yet.
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/portal')) {
      return new Response('Not found', { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
