'use client';
/**
 * Sign-in by emailed code, through Supabase Auth. Only the session tokens are kept in this browser;
 * the organisation in use is a separate choice, so one person can belong to several.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://scoitzteqsvomsghtxfe.supabase.co';
// A publishable key: it identifies the project and grants nothing on its own.
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY ?? 'sb_publishable_Wcgql0VPiQ54KREb48X_Ew_dk1U5yy-';
const AUTH = 'always.auth';
const ORG = 'always.org';

export type Auth = { access: string; refresh: string; expires: number; email: string };

const read = <T,>(k: string): T | null => {
  try { return JSON.parse(localStorage.getItem(k) ?? 'null') as T | null; } catch { return null; }
};
const write = (k: string, v: unknown) => {
  try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
};

export const getAuth = () => read<Auth>(AUTH);
export const getOrg = () => read<string>(ORG);
export const setOrg = (id: string | null) => write(ORG, id);
export function signOut() { write(AUTH, null); write(ORG, null); }

async function gotrue(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 429 ? 'too_many' : 'auth_failed');
  return data as { access_token: string; refresh_token: string; expires_in: number; user?: { email?: string } };
}

function keep(d: Awaited<ReturnType<typeof gotrue>>, email: string): Auth {
  const a = { access: d.access_token, refresh: d.refresh_token, expires: Date.now() + d.expires_in * 1000, email: d.user?.email ?? email };
  write(AUTH, a);
  return a;
}

export async function sendCode(email: string) {
  await gotrue('/otp', { email, create_user: true });
}

export async function verifyCode(email: string, code: string) {
  return keep(await gotrue('/verify', { type: 'email', email, token: code }), email);
}

/** A current access token, refreshed when it is close to expiring. Null when signed out. */
export async function token(): Promise<string | null> {
  const a = getAuth();
  if (!a) return null;
  if (a.expires - Date.now() > 60_000) return a.access;
  try {
    return keep(await gotrue('/token?grant_type=refresh_token', { refresh_token: a.refresh }), a.email).access;
  } catch {
    signOut();
    return null;
  }
}
