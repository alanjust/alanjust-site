// Who is asking? Cloudflare Access signs in portal visitors with an email code
// and hands the Worker a signed token. We verify that token here rather than
// trusting that Access ran, so a misconfigured policy fails closed.

import { portalClients } from '../src/lib/portal';

export interface PortalUser {
  email: string;
  isAdmin: boolean;
  /** Client ids this person may see. */
  clients: string[];
}

interface Jwk extends JsonWebKey { kid: string }

let keyCache: { keys: Map<string, CryptoKey>; expires: number } | null = null;

async function accessKeys(teamDomain: string): Promise<Map<string, CryptoKey>> {
  if (keyCache && keyCache.expires > Date.now()) return keyCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`Access certs: ${res.status}`);
  const { keys } = await res.json<{ keys: Jwk[] }>();
  const map = new Map<string, CryptoKey>();
  for (const jwk of keys) {
    const key = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
    );
    map.set(jwk.kid, key);
  }
  keyCache = { keys: map, expires: Date.now() + 60 * 60 * 1000 };
  return map;
}

function base64UrlDecode(part: string): Uint8Array {
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function verifyAccessToken(token: string, env: Env): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(h)));
  if (header.alg !== 'RS256') return null;

  const key = (await accessKeys(env.ACCESS_TEAM_DOMAIN)).get(header.kid);
  if (!key) return null;
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, base64UrlDecode(s), new TextEncoder().encode(`${h}.${p}`),
  );
  if (!ok) return null;

  const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(p)));
  const now = Math.floor(Date.now() / 1000);
  const aud: string[] = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (claims.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return null;
  if (typeof claims.exp !== 'number' || claims.exp < now) return null;
  if (typeof claims.nbf === 'number' && claims.nbf > now + 60) return null;
  return typeof claims.email === 'string' ? claims.email.toLowerCase() : null;
}

function cookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') ?? '';
  for (const pair of header.split(';')) {
    const [k, ...v] = pair.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export async function getUser(request: Request, env: Env): Promise<PortalUser | null> {
  let email: string | null = null;
  const host = new URL(request.url).hostname;

  // Local development only: there is no Access in front of `wrangler dev`.
  if (env.DEV_USER_EMAIL && (host === 'localhost' || host === '127.0.0.1')) {
    email = env.DEV_USER_EMAIL.toLowerCase();
  } else if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion') ?? cookie(request, 'CF_Authorization');
    if (token) {
      try { email = await verifyAccessToken(token, env); } catch { email = null; }
    }
  }
  if (!email) return null;

  const isAdmin = email === env.ADMIN_EMAIL.toLowerCase();
  const domain = email.split('@')[1] ?? '';
  const clients = portalClients
    .filter(c => isAdmin || c.emailDomains.includes(domain))
    .map(c => c.id);
  if (clients.length === 0) return null;
  return { email, isAdmin, clients };
}

export function canSee(user: PortalUser, client: string) {
  return user.clients.includes(client);
}
