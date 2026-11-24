import { randomBytes } from 'node:crypto';
import type { Hono } from 'hono';
import { z } from 'zod';
import { asService, type Sql } from '@always/db';
import { HttpError, type Env } from './auth.js';
import { encrypt, lookupHash } from './crypto.js';
import { audit } from './audit.js';

const MAX_ORGS_PER_PERSON = 5;

export const MODULES = ['respond', 'connect', 'safety', 'reports'] as const;
type Module = (typeof MODULES)[number];

// Connect hands people to a church, so it waits for the partner check (verified trust level).
const NEEDS_PARTNER_CHECK: readonly Module[] = ['connect'];

const isPartner = (trust: string) => trust === 'verified' || trust === 'verified_youth';

function moduleStates(on: string[], trust: string) {
  return Object.fromEntries(MODULES.map((m) => [m, on.includes(m) ? (NEEDS_PARTNER_CHECK.includes(m) && !isPartner(trust) ? 'awaiting_check' : 'on') : 'off']));
}

const ModuleChange = z.object({ modules: z.array(z.enum(MODULES)).max(MODULES.length) });

const NewOrg = z.object({
  kind: z.enum(['church', 'ministry']),
  displayName: z.string().trim().min(2).max(120),
  state: z.enum(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']),
  postcode: z.string().regex(/^\d{4}$/).optional(),
  modules: z.array(z.enum(['respond', 'connect', 'safety', 'reports'])).max(4).optional(),
  // Partners affirm the Nicene Creed (AD 381), Always's statement of faith.
  affirmsCreed: z.literal(true),
});

export function slugify(name: string): string {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'ministry';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

/**
 * First sign-in for a church or ministry admin. The person signs in with an email link
 * (Supabase Auth); these routes need that session but no organisation yet.
 * The website reaches them through its own /api proxy, as the web console does (ADR 0002).
 */
export function registerAccountRoutes(app: Hono<Env>, sql: Sql) {
  const identity = (c: { get: (k: 'identity') => Env['Variables']['identity'] }) => {
    const id = c.get('identity');
    if (!id) throw new HttpError(401, 'sign_in_required');
    return id;
  };

  app.get('/v1/account/orgs', async (c) => {
    const id = identity(c);
    const rows = await sql`select o.id, o.display_name, o.kind, o.trust_level, o.modules, m.role from membership m join organisation o on o.id = m.org_id
                           where m.user_id = ${id.sub} order by o.display_name`;
    return c.json({ orgs: rows.map((r) => ({ id: r.id, name: r.display_name, kind: r.kind, partner: isPartner(r.trust_level), role: r.role, modules: moduleStates(r.modules, r.trust_level) })) });
  });

  app.post('/v1/account/orgs', async (c) => {
    const id = identity(c);
    if (!id.email) throw new HttpError(422, 'email_required');
    const body = NewOrg.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw new HttpError(422, 'invalid_body');
    const email = id.email.trim().toLowerCase();
    const org = await asService(sql, async (tx) => {
      const [existing] = await tx`select id from app_user_account where email_hash = ${lookupHash(email)}`;
      if (existing && existing.id !== id.sub) throw new HttpError(409, 'email_linked_to_another_account');
      if (!existing) {
        await tx`insert into app_user_account (id, email_ct, email_hash, display_name) values (${id.sub}, ${encrypt(email)}, ${lookupHash(email)}, ${email.split('@')[0]!})
                 on conflict (id) do nothing`;
      }
      const [count] = await tx`select count(*)::int as n from membership where user_id = ${id.sub} and role = 'admin'`;
      if ((count?.n ?? 0) >= MAX_ORGS_PER_PERSON) throw new HttpError(429, 'too_many_orgs');
      const modules = [...new Set(body.data.modules ?? [])];
      const [o] = await tx`insert into organisation (kind, display_name, slug, state, postcode, trust_level, notify_email_ct, notify_email_hash, modules, creed_affirmed_at)
                           values (${body.data.kind}, ${body.data.displayName}, ${slugify(body.data.displayName)}, ${body.data.state}, ${body.data.postcode ?? null}, 'listed', ${encrypt(email)}, ${lookupHash(email)}, ${modules}, now())
                           returning id, display_name, kind, modules`;
      await tx`insert into membership (user_id, org_id, role) values (${id.sub}, ${o!.id}, 'admin')`;
      await audit(tx, { actor: id.sub, orgId: o!.id, action: 'org.create', subject: `org:${o!.id}` });
      return o!;
    });
    return c.json({ id: org.id, name: org.display_name, kind: org.kind, partner: false, role: 'admin', modules: moduleStates(org.modules, 'listed') }, 201);
  });

  app.put('/v1/account/orgs/:id/modules', async (c) => {
    const id = identity(c);
    const orgId = c.req.param('id');
    if (!/^[0-9a-f-]{36}$/.test(orgId)) throw new HttpError(404, 'not_found');
    const body = ModuleChange.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw new HttpError(422, 'invalid_body');
    const modules = [...new Set(body.data.modules)];
    const org = await asService(sql, async (tx) => {
      const [m] = await tx`select role from membership where user_id = ${id.sub} and org_id = ${orgId}`;
      if (!m || m.role !== 'admin') throw new HttpError(403, 'admin_only');
      const [o] = await tx`update organisation set modules = ${modules} where id = ${orgId} returning trust_level, modules`;
      await audit(tx, { actor: id.sub, orgId, action: 'org.modules', subject: `org:${orgId}` });
      return o!;
    });
    return c.json({ modules: moduleStates(org.modules, org.trust_level) });
  });
}
