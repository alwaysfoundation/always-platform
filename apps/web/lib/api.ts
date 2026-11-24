'use client';
/** A tiny client for the Always API, through this app's /api proxy. */
import { getOrg, token } from './auth';
import { demoApi, isDemo } from './demo';

/** Where the API is: this app's /api proxy on a server build, the API itself on the static build. */
export const API = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (isDemo()) return (await demoApi(path, init.method ?? 'GET', init.body)) as T;
  const t = await token();
  const org = getOrg();
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(t ? { authorization: `Bearer ${t}` } : {}),
      ...(org && !path.startsWith('/v1/account/') ? { 'x-always-org': org } : {}),
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

export type ModuleState = 'on' | 'off' | 'awaiting_check';
export type Brand = { primary: string; accent: string; heading: 'modern' | 'classic'; logo: string | null };
export type Org = {
  id: string; name: string; kind: 'church' | 'ministry'; partner: boolean; role: string; careTeam?: boolean;
  modules: Record<'respond' | 'connect' | 'safety' | 'reports' | 'ai', ModuleState>; brand: Brand;
};
