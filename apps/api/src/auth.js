import { createRemoteJWKSet, jwtVerify } from 'jose';
import { tokenHash } from './crypto.js';
let jwks = null;
async function verifyJwt(token) {
    const secret = process.env.AUTH_JWT_SECRET; // local development and tests (HS256)
    if (secret)
        return (await jwtVerify(token, new TextEncoder().encode(secret), { audience: 'authenticated' })).payload;
    const url = process.env.AUTH_JWKS_URL; // e.g. https://<project>.supabase.co/auth/v1/.well-known/jwks.json
    if (!url)
        throw new Error('auth_not_configured');
    jwks ??= createRemoteJWKSet(new URL(url));
    return (await jwtVerify(token, jwks, { audience: 'authenticated' })).payload;
}
export function authenticate() {
    return async (c, next) => {
        const header = c.req.header('authorization');
        if (!header?.startsWith('Bearer '))
            return next();
        const token = header.slice(7).trim();
        const sql = c.get('sql');
        if (token.startsWith('alw_')) {
            const [row] = await sql `
        update api_token set last_used_at = now()
        where token_hash = ${tokenHash(token)} and revoked_at is null
        returning org_id, user_id, scopes`;
            if (!row)
                return c.json({ error: 'invalid_token' }, 401);
            const [org] = await sql `select is_care_team from organisation where id = ${row.org_id}`;
            c.set('principal', { kind: 'token', orgId: row.org_id, userId: row.user_id ?? undefined, roles: ['integration'], scopes: row.scopes, youthAccess: false, careTeam: !!org?.is_care_team });
            return next();
        }
        let payload;
        try {
            payload = await verifyJwt(token);
        }
        catch {
            return c.json({ error: 'invalid_token' }, 401);
        }
        if (!payload.sub)
            return c.json({ error: 'invalid_token' }, 401);
        if (c.req.path.startsWith('/v1/account/')) {
            c.set('identity', { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined });
            return next();
        }
        const orgId = c.req.header('x-always-org');
        if (!orgId)
            return c.json({ error: 'org_required' }, 400);
        const rows = await sql `
      select m.role, m.youth_access, o.is_care_team from membership m join organisation o on o.id = m.org_id
      where m.user_id = ${payload.sub} and m.org_id = ${orgId}`;
        if (rows.length === 0)
            return c.json({ error: 'not_a_member' }, 403);
        c.set('principal', {
            kind: 'user',
            userId: payload.sub,
            orgId,
            roles: rows.map((r) => r.role),
            scopes: ['inbox', 'profile', 'activity', 'events', 'reports', 'compliance'],
            youthAccess: rows.some((r) => r.youth_access),
            careTeam: rows.some((r) => r.is_care_team),
        });
        return next();
    };
}
export function requirePrincipal(c, scope) {
    const p = c.get('principal');
    if (!p)
        throw new HttpError(401, 'sign_in_required');
    if (scope && !p.scopes.includes(scope) && !p.roles.includes('admin'))
        throw new HttpError(403, 'missing_scope');
    return p;
}
export class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
