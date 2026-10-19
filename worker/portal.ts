// Client portal API: the transfer area (files) and the review shelf (proofs,
// versions, comments). Every handler checks who is asking and which client
// they belong to before touching anything.

import { canSee, type PortalUser } from './auth';
import {
  findClient, findSpace, proofTypes, MAX_UPLOAD_BYTES, UPLOAD_PART_BYTES, FILE_RETENTION_DAYS,
} from '../src/lib/portal';

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
const fail = (message: string, status: number) => json({ error: message }, status);

const now = () => new Date().toISOString();

function safeName(name: string) {
  const cleaned = name.replace(/[\\/\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  return cleaned || 'file';
}

function attachmentHeader(kind: 'attachment' | 'inline', name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

// Proofs are shown in the browser, so check the file really is what it claims.
async function looksLike(env: Env, key: string, type: string) {
  const head = await env.PORTAL_FILES.get(key, { range: { offset: 0, length: 8 } });
  if (!head) return false;
  const b = new Uint8Array(await head.arrayBuffer());
  if (type === 'application/pdf') return String.fromCharCode(...b.slice(0, 5)) === '%PDF-';
  if (type === 'image/png') return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  if (type === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  return false;
}

interface UploadRow {
  id: string; r2_key: string; client: string; space: string; kind: 'file' | 'proof';
  name: string; size: number; content_type: string; proof_id: string | null;
  started_by: string; created_at: string;
}

export async function handlePortalApi(request: Request, env: Env, user: PortalUser, path: string[]): Promise<Response> {
  const method = request.method;
  const db = env.PORTAL_DB;

  // Anything that changes data must carry this header. Browsers won't let
  // another site add it without permission we never grant.
  if (method !== 'GET' && method !== 'HEAD' && request.headers.get('X-Portal') !== '1') {
    return fail('Missing request header', 400);
  }

  // GET /api/portal/me
  if (path[0] === 'me' && method === 'GET') {
    const clients = user.clients.map(id => {
      const c = findClient(id)!;
      return { id: c.id, name: c.name, spaces: c.spaces };
    });
    return json({ email: user.email, isAdmin: user.isAdmin, clients });
  }

  // /api/portal/:client/:space/(files|proofs|uploads)
  if (path.length === 3 && findSpace(path[0], path[1])) {
    const [client, space, what] = path;
    if (!canSee(user, client)) return fail('Not allowed', 403);

    if (what === 'files' && method === 'GET') {
      const { results } = await db.prepare(
        `SELECT id, name, size, uploaded_by, created_at FROM files
         WHERE client = ? AND space = ? ORDER BY created_at DESC`,
      ).bind(client, space).all();
      return json({ files: results, retentionDays: FILE_RETENTION_DAYS, me: user.email, isAdmin: user.isAdmin });
    }

    if (what === 'proofs' && method === 'GET') {
      const proofs = (await db.prepare(
        `SELECT id, title, created_at, updated_at FROM proofs
         WHERE client = ? AND space = ? ORDER BY updated_at DESC`,
      ).bind(client, space).all()).results;
      const versions = (await db.prepare(
        `SELECT v.id, v.proof_id, v.version, v.name, v.size, v.content_type, v.note, v.created_at
         FROM proof_versions v JOIN proofs p ON p.id = v.proof_id
         WHERE p.client = ? AND p.space = ? ORDER BY v.version DESC`,
      ).bind(client, space).all()).results;
      const comments = (await db.prepare(
        `SELECT c.id, c.version_id, c.author_email, c.author_name, c.body, c.created_at, c.addressed_at
         FROM comments c JOIN proof_versions v ON v.id = c.version_id JOIN proofs p ON p.id = v.proof_id
         WHERE p.client = ? AND p.space = ? ORDER BY c.created_at ASC`,
      ).bind(client, space).all()).results;
      return json({ proofs, versions, comments, me: user.email, isAdmin: user.isAdmin });
    }

    // POST /api/portal/:client/:space/uploads—start a chunked upload
    if (what === 'uploads' && method === 'POST') {
      const body = await request.json<{ kind?: string; name?: string; size?: number; contentType?: string; proofId?: string }>();
      const kind = body.kind === 'proof' ? 'proof' : 'file';
      const name = safeName(String(body.name ?? ''));
      const size = Number(body.size);
      if (!Number.isFinite(size) || size <= 0) return fail('That file looks empty.', 400);
      if (size > MAX_UPLOAD_BYTES) return fail('Files can be up to 2 GB.', 413);

      let contentType = 'application/octet-stream';
      let proofId: string | null = null;
      if (kind === 'proof') {
        if (!user.isAdmin) return fail('Only Alan posts proofs.', 403);
        contentType = String(body.contentType ?? '');
        if (!proofTypes[contentType]) return fail('Proofs must be PDF, JPEG or PNG.', 415);
        if (body.proofId) {
          const proof = await db.prepare('SELECT id FROM proofs WHERE id = ? AND client = ? AND space = ?')
            .bind(body.proofId, client, space).first();
          if (!proof) return fail('That proof no longer exists.', 404);
          proofId = body.proofId;
        }
      }

      const key = `${client}/${space}/${kind === 'proof' ? 'proofs' : 'files'}/${crypto.randomUUID()}/${name}`;
      const mpu = await env.PORTAL_FILES.createMultipartUpload(key, {
        httpMetadata: { contentType },
        customMetadata: { uploadedBy: user.email },
      });
      await db.prepare(
        `INSERT INTO uploads (id, r2_key, client, space, kind, name, size, content_type, proof_id, started_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(mpu.uploadId, key, client, space, kind, name, size, contentType, proofId, user.email, now()).run();
      return json({ uploadId: mpu.uploadId, partSize: UPLOAD_PART_BYTES });
    }
    return fail('Not found', 404);
  }

  // /api/portal/uploads/:id/...
  if (path[0] === 'uploads' && path[1]) {
    const up = await db.prepare('SELECT * FROM uploads WHERE id = ?').bind(path[1]).first<UploadRow>();
    if (!up || !canSee(user, up.client) || (up.started_by !== user.email && !user.isAdmin)) {
      return fail('Upload not found', 404);
    }
    const mpu = env.PORTAL_FILES.resumeMultipartUpload(up.r2_key, up.id);

    // PUT /api/portal/uploads/:id/parts/:n
    if (path[2] === 'parts' && method === 'PUT') {
      const n = Number(path[3]);
      if (!Number.isInteger(n) || n < 1 || n > 10000) return fail('Bad part number', 400);
      if (!request.body) return fail('Empty part', 400);
      const part = await mpu.uploadPart(n, request.body);
      return json({ partNumber: part.partNumber, etag: part.etag });
    }

    // POST /api/portal/uploads/:id/complete
    if (path[2] === 'complete' && method === 'POST') {
      const body = await request.json<{ parts?: R2UploadedPart[]; title?: string; note?: string }>();
      const parts = (body.parts ?? []).sort((a, b) => a.partNumber - b.partNumber);
      const object = await mpu.complete(parts);
      await db.prepare('DELETE FROM uploads WHERE id = ?').bind(up.id).run();
      const stamp = now();

      if (up.kind === 'file') {
        const id = crypto.randomUUID();
        await db.prepare(
          `INSERT INTO files (id, client, space, r2_key, name, size, content_type, uploaded_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(id, up.client, up.space, up.r2_key, up.name, object.size, up.content_type, up.started_by, stamp).run();
        return json({ id });
      }

      if (!(await looksLike(env, up.r2_key, up.content_type))) {
        await env.PORTAL_FILES.delete(up.r2_key);
        return fail(`That file isn't really a ${proofTypes[up.content_type]}.`, 415);
      }
      let proofId = up.proof_id;
      const statements: D1PreparedStatement[] = [];
      if (!proofId) {
        proofId = crypto.randomUUID();
        const title = String(body.title ?? '').trim().slice(0, 140) || up.name;
        statements.push(db.prepare(
          'INSERT INTO proofs (id, client, space, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ).bind(proofId, up.client, up.space, title, stamp, stamp));
      } else {
        statements.push(db.prepare('UPDATE proofs SET updated_at = ? WHERE id = ?').bind(stamp, proofId));
      }
      const latest = await db.prepare('SELECT MAX(version) AS v FROM proof_versions WHERE proof_id = ?')
        .bind(proofId).first<{ v: number | null }>();
      const versionId = crypto.randomUUID();
      const note = String(body.note ?? '').trim().slice(0, 1000) || null;
      statements.push(db.prepare(
        `INSERT INTO proof_versions (id, proof_id, version, r2_key, name, size, content_type, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(versionId, proofId, (latest?.v ?? 0) + 1, up.r2_key, up.name, object.size, up.content_type, note, stamp));
      await db.batch(statements);
      return json({ proofId, versionId });
    }

    // DELETE /api/portal/uploads/:id—cancel
    if (path.length === 2 && method === 'DELETE') {
      await mpu.abort().catch(() => {});
      await db.prepare('DELETE FROM uploads WHERE id = ?').bind(up.id).run();
      return json({ ok: true });
    }
    return fail('Not found', 404);
  }

  // /api/portal/files/:id(/download)
  if (path[0] === 'files' && path[1]) {
    const file = await db.prepare('SELECT * FROM files WHERE id = ?').bind(path[1])
      .first<{ id: string; client: string; r2_key: string; name: string; uploaded_by: string }>();
    if (!file || !canSee(user, file.client)) return fail('File not found', 404);

    if (path[2] === 'download' && method === 'GET') {
      const object = await env.PORTAL_FILES.get(file.r2_key);
      if (!object) return fail('File not found', 404);
      // Always a download, never shown on the site, whatever is inside.
      return new Response(object.body, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(object.size),
          'Content-Disposition': attachmentHeader('attachment', file.name),
          'Content-Security-Policy': "sandbox; default-src 'none'",
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        },
      });
    }
    if (path.length === 2 && method === 'DELETE') {
      if (!user.isAdmin && file.uploaded_by !== user.email) return fail('Only the person who uploaded it (or Alan) can delete it.', 403);
      await env.PORTAL_FILES.delete(file.r2_key);
      await db.prepare('DELETE FROM files WHERE id = ?').bind(file.id).run();
      return json({ ok: true });
    }
    return fail('Not found', 404);
  }

  // /api/portal/versions/:id/(view|comments)
  if (path[0] === 'versions' && path[1]) {
    const v = await db.prepare(
      `SELECT v.*, p.client FROM proof_versions v JOIN proofs p ON p.id = v.proof_id WHERE v.id = ?`,
    ).bind(path[1]).first<{ id: string; proof_id: string; version: number; r2_key: string; name: string; content_type: string; client: string }>();
    if (!v || !canSee(user, v.client)) return fail('Proof not found', 404);

    if (path[2] === 'view' && method === 'GET') {
      const object = await env.PORTAL_FILES.get(v.r2_key);
      if (!object || !proofTypes[v.content_type]) return fail('Proof not found', 404);
      const download = new URL(request.url).searchParams.has('download');
      const headers: Record<string, string> = {
        'Content-Type': v.content_type,
        'Content-Length': String(object.size),
        'Content-Disposition': attachmentHeader(download ? 'attachment' : 'inline', v.name),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=3600',
      };
      // Browsers' built-in PDF viewers break inside a sandbox; images don't need one to be safe but get it anyway.
      if (v.content_type !== 'application/pdf') headers['Content-Security-Policy'] = "sandbox; default-src 'none'; img-src 'self'";
      return new Response(object.body, { headers });
    }

    if (path[2] === 'comments' && method === 'POST') {
      const body = await request.json<{ body?: string; name?: string }>();
      const text = String(body.body ?? '').trim().slice(0, 4000);
      if (!text) return fail('Write something first.', 400);
      const name = String(body.name ?? '').trim().slice(0, 60) || user.email.split('@')[0];
      const id = crypto.randomUUID();
      const stamp = now();
      await db.prepare(
        `INSERT INTO comments (id, version_id, author_email, author_name, body, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).bind(id, v.id, user.email, name, text, stamp).run();
      return json({ id, author_email: user.email, author_name: name, body: text, created_at: stamp, addressed_at: null });
    }
    return fail('Not found', 404);
  }

  // /api/portal/comments/:id(/addressed)
  if (path[0] === 'comments' && path[1]) {
    const c = await db.prepare(
      `SELECT c.id, c.author_email, p.client FROM comments c
       JOIN proof_versions v ON v.id = c.version_id JOIN proofs p ON p.id = v.proof_id WHERE c.id = ?`,
    ).bind(path[1]).first<{ id: string; author_email: string; client: string }>();
    if (!c || !canSee(user, c.client)) return fail('Comment not found', 404);

    if (path[2] === 'addressed' && method === 'POST') {
      if (!user.isAdmin) return fail('Only Alan can mark comments addressed.', 403);
      const { addressed } = await request.json<{ addressed?: boolean }>();
      await db.prepare('UPDATE comments SET addressed_at = ? WHERE id = ?')
        .bind(addressed ? now() : null, c.id).run();
      return json({ ok: true });
    }
    if (path.length === 2 && method === 'DELETE') {
      if (!user.isAdmin && c.author_email !== user.email) return fail('You can only delete your own comments.', 403);
      await db.prepare('DELETE FROM comments WHERE id = ?').bind(c.id).run();
      return json({ ok: true });
    }
    return fail('Not found', 404);
  }

  // DELETE /api/portal/proofs/:id—removes the proof, every version and thread
  if (path[0] === 'proofs' && path[1] && path.length === 2 && method === 'DELETE') {
    if (!user.isAdmin) return fail('Only Alan can delete proofs.', 403);
    const keys = (await db.prepare('SELECT r2_key FROM proof_versions WHERE proof_id = ?')
      .bind(path[1]).all<{ r2_key: string }>()).results.map(r => r.r2_key);
    if (keys.length) await env.PORTAL_FILES.delete(keys);
    await db.batch([
      db.prepare('DELETE FROM comments WHERE version_id IN (SELECT id FROM proof_versions WHERE proof_id = ?)').bind(path[1]),
      db.prepare('DELETE FROM proof_versions WHERE proof_id = ?').bind(path[1]),
      db.prepare('DELETE FROM proofs WHERE id = ?').bind(path[1]),
    ]);
    return json({ ok: true });
  }

  return fail('Not found', 404);
}

// Daily cleanup: transfer files older than the retention window, and uploads
// that were started but never finished.
export async function cleanUp(env: Env) {
  const db = env.PORTAL_DB;
  const cutoff = new Date(Date.now() - FILE_RETENTION_DAYS * 86400_000).toISOString();
  const old = (await db.prepare('SELECT id, r2_key FROM files WHERE created_at < ? LIMIT 500')
    .bind(cutoff).all<{ id: string; r2_key: string }>()).results;
  if (old.length) {
    await env.PORTAL_FILES.delete(old.map(f => f.r2_key));
    await db.batch(old.map(f => db.prepare('DELETE FROM files WHERE id = ?').bind(f.id)));
  }

  const stale = new Date(Date.now() - 2 * 86400_000).toISOString();
  const abandoned = (await db.prepare('SELECT id, r2_key FROM uploads WHERE created_at < ?')
    .bind(stale).all<{ id: string; r2_key: string }>()).results;
  for (const up of abandoned) {
    await env.PORTAL_FILES.resumeMultipartUpload(up.r2_key, up.id).abort().catch(() => {});
    await db.prepare('DELETE FROM uploads WHERE id = ?').bind(up.id).run();
  }
}
