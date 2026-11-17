const BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

export class ApiError extends Error {
  constructor(message, status, errors, code) { super(message); this.status = status; this.errors = errors; this.code = code; }
}

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(method, url, body, opts = {}) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(BASE + url, {
      method, credentials: 'include',
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  if (opts.blob) {
    if (!res.ok) throw new ApiError('Download failed', res.status);
    return res.blob();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && data.code === 'UNAUTHENTICATED' && onUnauthorized && !opts.silent) onUnauthorized();
    throw new ApiError(data.message || 'Something went wrong', res.status, data.errors, data.code);
  }
  return data;
}

export const api = {
  get: (u, o) => request('GET', u, undefined, o),
  post: (u, b, o) => request('POST', u, b, o),
  patch: (u, b, o) => request('PATCH', u, b, o),
  del: (u, o) => request('DELETE', u, undefined, o),
  blob: (u) => request('GET', u, undefined, { blob: true }),
};

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? `?${s}` : '';
};

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
