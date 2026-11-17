import type { Context, MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Sql } from '@always/db';
import { tokenHash } from './crypto.js';

/**
 * Two ways in, both resolve to (user?, org, scopes):
 * 1. Partner staff sign in through Supabase Auth (email + passkey or TOTP, MFA required for admins).
 *    The JWT is verified against Supabase's JWKS; the org comes from the X-Always-Org header and
 *    must match one of the user's memberships.
 * 2. Sender integrations use an API token (alw_live_...), hashed at rest, scoped and revocable.
 */
export interface Principal {
  kind: 'user' | 'token';
  userId?: string;
  orgId: string;
  roles: string[];
  scopes: string[];
  youthAccess: boolean;
  careTeam: boolean;
}

export type Env = { Variables: { principal?: Principal; sql: Sql } };

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function verifyJwt(token: string): Promise<JWTPayload> {
  const secret = process.env.AUTH_JWT_SECRET; // local development and tests (HS256)
  if (secret) return (await jwtVerify(token, new TextEncoder().encode(secret), { audience: 'authenticated' })).payload;
  const url = process.env.AUTH_JWKS_URL; // e.g. https://<project>.supabase.co/auth/v1/.well-known/jwks.json
  if (!url) throw new Error('auth_not_configured');
  jwks ??= createRemoteJWKSet(new URL(url));
  return (await jwtVerify(token, jwks, { audience: 'authenticated' })).payload;
}

export function authenticate(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const header = c.req.header('authorization');
    if (!header?.startsWith('Bearer ')) return next();
    const token = header.slice(7).trim();
    const sql = c.get('sql');
    if (token.startsWith('alw_')) {
      const [row] = await sql`
        update api_token set last_used_at = now()
        where token_hash = ${tokenHash(token)} and revoked_at is null
        returning org_id, user_id, scopes`;
      if (!row) return c.json({ error: 'invalid_token' }, 401);
      const [org] = await sql`select is_care_team from organisation where id = ${row.org_id}`;
      c.set('principal', { kind: 'token', orgId: row.org_id, userId: row.user_id ?? undefined, roles: ['integration'], scopes: row.scopes, youthAccess: false, careTeam: !!org?.is_care_team });
      return next();
    }
    let payload: JWTPayload;
    try {
      payload = await verifyJwt(token);
    } catch {
      return c.json({ error: 'invalid_token' }, 401);
    }
    const orgId = c.req.header('x-always-org');
    if (!orgId || !payload.sub) return c.json({ error: 'org_required' }, 400);
    const rows = await sql`
      select m.role, m.youth_access, o.is_care_team from membership m join organisation o on o.id = m.org_id
      where m.user_id = ${payload.sub} and m.org_id = ${orgId}`;
    if (rows.length === 0) return c.json({ error: 'not_a_member' }, 403);
    c.set('principal', {
      kind: 'user',
      userId: payload.sub,
      orgId,
      roles: rows.map((r) => r.role),
      scopes: ['inbox', 'profile', 'activity'],
      youthAccess: rows.some((r) => r.youth_access),
      careTeam: rows.some((r) => r.is_care_team),
    });
    return next();
  };
}

export function requirePrincipal(c: Context<Env>, scope?: string): Principal {
  const p = c.get('principal');
  if (!p) throw new HttpError(401, 'sign_in_required');
  if (scope && !p.scopes.includes(scope) && !p.roles.includes('admin')) throw new HttpError(403, 'missing_scope');
  return p;
}

export class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 422 | 429, message: string) {
    super(message);
  }
}
