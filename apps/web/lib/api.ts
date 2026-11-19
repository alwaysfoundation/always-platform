'use client';
/**
 * A tiny client for the Always API, through this app's /api proxy.
 * The staff session lives in sessionStorage for this tab only; it is never logged or sent anywhere but /api.
 */
const KEY = 'always.session';

export type Session = { token: string; org: string };

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the session lasts until the page closes */
  }
}

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const s = getSession();
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(s ? { authorization: `Bearer ${s.token}`, 'x-always-org': s.org } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'request_failed');
  return data as T;
}

/** Plain-language messages for the errors people are most likely to see. */
export function explain(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Your session has ended. Please sign in again.';
    if (e.status === 403) return 'Your account does not have access to this.';
    if (e.status === 409) return 'Someone on your team has already done this.';
    if (e.status === 404) return 'This item is no longer available.';
  }
  return 'Something went wrong. Please try again.';
}
