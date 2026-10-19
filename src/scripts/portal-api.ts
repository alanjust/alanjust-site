// Small helpers shared by the client portal pages. Everything that shows
// people's data builds elements with textContent—never innerHTML.

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Portal', '1');
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  const res = await fetch(`/api/portal/${path}`, { ...init, headers, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('Your sign-in has expired. Reload the page to sign in again.');
  if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`);
  return data as T;
}

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') node.className = String(v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function formatDate(iso: string, withTime = false) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return withTime ? `${date}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : date;
}

export interface UploadOptions {
  kind: 'file' | 'proof';
  proofId?: string;
  title?: string;
  note?: string;
  onProgress?: (fraction: number) => void;
}

/** Uploads in chunks so large Illustrator files work and show progress. */
export async function uploadInParts(base: string, file: File, opts: UploadOptions) {
  const start = await api<{ uploadId: string; partSize: number }>(`${base}/uploads`, {
    method: 'POST',
    body: JSON.stringify({
      kind: opts.kind, name: file.name, size: file.size,
      contentType: file.type, proofId: opts.proofId,
    }),
  });
  const id = encodeURIComponent(start.uploadId);
  const parts: { partNumber: number; etag: string }[] = [];
  try {
    const count = Math.max(1, Math.ceil(file.size / start.partSize));
    for (let i = 0; i < count; i++) {
      const chunk = file.slice(i * start.partSize, (i + 1) * start.partSize);
      const part = await api<{ partNumber: number; etag: string }>(`uploads/${id}/parts/${i + 1}`, {
        method: 'PUT', body: chunk,
      });
      parts.push(part);
      opts.onProgress?.((i + 1) / count);
    }
    return await api(`uploads/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ parts, title: opts.title, note: opts.note }),
    });
  } catch (err) {
    api(`uploads/${id}`, { method: 'DELETE' }).catch(() => {});
    throw err;
  }
}
