const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function getApiUrl(): string {
  const configuredApiUrl = CONFIGURED_API_URL.replace(/\/+$/, '');

  if (typeof window === 'undefined') {
    return configuredApiUrl;
  }

  try {
    const configuredUrl = new URL(configuredApiUrl);
    const pageIsLocal = isLoopbackHost(window.location.hostname);
    const apiIsLocal = isLoopbackHost(configuredUrl.hostname);

    if (apiIsLocal && !pageIsLocal) {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
  } catch {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return configuredApiUrl;
}

export class ApiError extends Error {
  status: number;
  payload: any;
  constructor(message: string, status: number, payload: any) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('roster_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('roster_token', token);
  else localStorage.removeItem('roster_token');
}

export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${getApiUrl()}/api${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!res.ok) {
    const message = data?.message || data?.error || res.statusText;
    throw new ApiError(Array.isArray(message) ? message.join(', ') : String(message), res.status, data);
  }
  return data as T;
}

export async function apiBlob(path: string): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${getApiUrl()}/api${path}`, { headers, cache: 'no-store' });
  if (!res.ok) throw new ApiError(res.statusText, res.status, await res.text());
  return res.blob();
}

export const api = {
  get: <T = any>(p: string) => apiFetch<T>(p),
  post: <T = any>(p: string, body?: any) => apiFetch<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put:  <T = any>(p: string, body?: any) => apiFetch<T>(p, { method: 'PUT',  body: JSON.stringify(body ?? {}) }),
  del:  <T = any>(p: string) => apiFetch<T>(p, { method: 'DELETE' }),
};
