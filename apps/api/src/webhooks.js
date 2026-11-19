import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { z } from 'zod';
import { asApp, asService } from '@always/db';
import { requirePrincipal, HttpError } from './auth.js';
import { encrypt } from './crypto.js';
import { audit } from './audit.js';
const MAX_ENDPOINTS = 10;
/** Deliveries go to public HTTPS hosts only, never to internal addresses. */
export function publicHttpsUrl(raw) {
    let u;
    try {
        u = new URL(raw);
    }
    catch {
        return false;
    }
    if (u.protocol !== 'https:' || u.username || u.password)
        return false;
    const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local'))
        return false;
    if (isIP(host))
        return false; // a name, so the receiver can rotate addresses and certificates
    return host.includes('.');
}
const Body = z.object({
    url: z.string().max(500).refine(publicHttpsUrl, 'must be a public https URL'),
    events: z.array(z.string().regex(/^(\*|always\.[a-z_.]{3,80})$/)).min(1).max(20),
});
export function registerWebhookRoutes(app, sql) {
    app.get('/v1/webhooks', async (c) => {
        const p = requirePrincipal(c, 'webhooks');
        const rows = await asApp(sql, { orgId: p.orgId, userId: p.userId }, (tx) => tx `select id, url, events, active, created_at from webhook_endpoint order by created_at`);
        return c.json({ endpoints: rows });
    });
    /** The signing secret is shown once, here. It is stored encrypted. */
    app.post('/v1/webhooks', async (c) => {
        const p = requirePrincipal(c, 'webhooks');
        const b = Body.safeParse(await c.req.json().catch(() => null));
        if (!b.success)
            throw new HttpError(422, 'invalid_body');
        const secret = `whsec_${randomBytes(32).toString('base64url')}`;
        const row = await asApp(sql, { orgId: p.orgId, userId: p.userId }, async (tx) => {
            const [count] = await tx `select count(*)::int as n from webhook_endpoint where active`;
            if ((count?.n ?? 0) >= MAX_ENDPOINTS)
                throw new HttpError(409, 'too_many_endpoints');
            const [r] = await tx `insert into webhook_endpoint (org_id, url, secret_ct, events) values (${p.orgId}, ${b.data.url}, ${encrypt(secret)}, ${[...new Set(b.data.events)]})
                           returning id, url, events, active, created_at`;
            return r;
        });
        await asService(sql, (tx) => audit(tx, { actor: p.userId, orgId: p.orgId, action: 'webhook.create', subject: `webhook:${row.id}` }));
        return c.json({ ...row, secret }, 201);
    });
    app.delete('/v1/webhooks/:id', async (c) => {
        const p = requirePrincipal(c, 'webhooks');
        const id = c.req.param('id');
        if (!z.string().uuid().safeParse(id).success)
            throw new HttpError(404, 'not_found');
        await asApp(sql, { orgId: p.orgId, userId: p.userId }, async (tx) => {
            const [r] = await tx `delete from webhook_endpoint where id = ${id} returning id`;
            if (!r)
                throw new HttpError(404, 'not_found');
        });
        await asService(sql, (tx) => audit(tx, { actor: p.userId, orgId: p.orgId, action: 'webhook.delete', subject: `webhook:${id}` }));
        return c.json({ ok: true });
    });
}
