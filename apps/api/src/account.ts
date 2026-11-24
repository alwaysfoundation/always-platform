import { randomBytes } from 'node:crypto';
import type { Hono } from 'hono';
import { z } from 'zod';
import { asService, type Sql } from '@always/db';
import { HttpError, type Env } from './auth.js';
import { encrypt, decrypt, lookupHash, newToken, tokenHash } from './crypto.js';
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

const HEX = /^#[0-9a-fA-F]{6}$/;
const Brand = z.object({
  primary: z.string().regex(HEX),
  accent: z.string().regex(HEX),
  heading: z.enum(['modern', 'classic']).default('modern'),
  logo: z.string().max(340_000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/).nullable().optional(),
});
type BrandIn = z.infer<typeof Brand>;

const TEAM_ROLES = ['admin', 'follow_up', 'youth'] as const;
const Invite = z.object({ email: z.string().trim().toLowerCase().email().max(200), role: z.enum(TEAM_ROLES) });
const INVITE_DAYS = 7;
const MAX_PENDING_INVITES = 50;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- database row
function brandOut(r: any) {
  const b = (r.page_layout?.brand ?? {}) as { accent?: string; heading?: string };
  return { primary: r.brand_colour ?? null, accent: b.accent ?? null, heading: b.heading ?? 'modern', logo: r.logo_data ?? null };
}

const NewOrg = z.object({
  kind: z.enum(['church', 'ministry']),
  displayName: z.string().trim().min(2).max(120),
  // Australian state, when there is one; organisations elsewhere leave it out (ADR 0020).
  state: z.enum(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']).optional(),
  postcode: z.string().regex(/^\d{4}$/).optional(),
  modules: z.array(z.enum(['respond', 'connect', 'safety', 'reports'])).max(4).optional(),
  brand: Brand.optional(),
  // Partners affirm the Nicene Creed (AD 381), Always's statement of faith.
  affirmsCreed: z.literal(true),
});

export function slugify(name: string): string {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'ministry';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- postgres.js transaction
async function saveBrand(tx: any, orgId: string, b: BrandIn) {
  await tx`update organisation set brand_colour = ${b.primary.toUpperCase()},
           page_layout = coalesce(page_layout, '{}'::jsonb) || ${tx.json({ brand: { accent: b.accent.toUpperCase(), heading: b.heading } })},
           logo_data = ${b.logo === undefined ? tx`logo_data` : b.logo}
           where id = ${orgId}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- postgres.js transaction
async function requireAdmin(tx: any, userId: string, orgId: string) {
  if (!/^[0-9a-f-]{36}$/.test(orgId)) throw new HttpError(404, 'not_found');
  const [m] = await tx`select role from membership where user_id = ${userId} and org_id = ${orgId}`;
  if (!m || m.role !== 'admin') throw new HttpError(403, 'admin_only');
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
    const rows = await sql`select o.id, o.display_name, o.kind, o.trust_level, o.modules, o.brand_colour, o.page_layout, o.logo_data, m.role from membership m join organisation o on o.id = m.org_id
                           where m.user_id = ${id.sub} order by o.display_name`;
    return c.json({ orgs: rows.map((r) => ({ id: r.id, name: r.display_name, kind: r.kind, partner: isPartner(r.trust_level), role: r.role, modules: moduleStates(r.modules, r.trust_level), brand: brandOut(r) })) });
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
                           values (${body.data.kind}, ${body.data.displayName}, ${slugify(body.data.displayName)}, ${body.data.state ?? null}, ${body.data.postcode ?? null}, 'listed', ${encrypt(email)}, ${lookupHash(email)}, ${modules}, now())
                           returning id, display_name, kind, modules`;
      if (body.data.brand) await saveBrand(tx, o!.id, body.data.brand);
      await tx`insert into membership (user_id, org_id, role) values (${id.sub}, ${o!.id}, 'admin')`;
      await audit(tx, { actor: id.sub, orgId: o!.id, action: 'org.create', subject: `org:${o!.id}` });
      return o!;
    });
    return c.json({ id: org.id, name: org.display_name, kind: org.kind, partner: false, role: 'admin', modules: moduleStates(org.modules, 'listed'), brand: body.data.brand ? { ...body.data.brand, logo: body.data.brand.logo ?? null } : brandOut({ brand_colour: null, page_layout: null, logo_data: null }) }, 201);
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

  app.put('/v1/account/orgs/:id/brand', async (c) => {
    const id = identity(c);
    const orgId = c.req.param('id');
    const body = Brand.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw new HttpError(422, 'invalid_body');
    const brand = await asService(sql, async (tx) => {
      await requireAdmin(tx, id.sub, orgId);
      await saveBrand(tx, orgId, body.data);
      await audit(tx, { actor: id.sub, orgId, action: 'org.brand', subject: `org:${orgId}` });
      const [o] = await tx`select brand_colour, page_layout, logo_data from organisation where id = ${orgId}`;
      return brandOut(o!);
    });
    return c.json({ brand });
  });

  app.get('/v1/account/orgs/:id/team', async (c) => {
    const id = identity(c);
    const orgId = c.req.param('id');
    const team = await asService(sql, async (tx) => {
      await requireAdmin(tx, id.sub, orgId);
      const members = await tx`select a.id, a.email_ct, m.role from membership m join app_user_account a on a.id = m.user_id where m.org_id = ${orgId} order by m.role, a.created_at`;
      const invites = await tx`select id, email_ct, role, expires_at from org_invite where org_id = ${orgId} and accepted_at is null and expires_at > now() order by created_at`;
      return {
        members: members.map((r) => ({ id: r.id, email: decrypt(r.email_ct), role: r.role, you: r.id === id.sub })),
        invites: invites.map((r) => ({ id: r.id, email: decrypt(r.email_ct), role: r.role, expiresAt: r.expires_at })),
      };
    });
    return c.json(team);
  });

  app.post('/v1/account/orgs/:id/invites', async (c) => {
    const id = identity(c);
    const orgId = c.req.param('id');
    const body = Invite.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw new HttpError(422, 'invalid_body');
    const invite = await asService(sql, async (tx) => {
      await requireAdmin(tx, id.sub, orgId);
      const [pending] = await tx`select count(*)::int as n from org_invite where org_id = ${orgId} and accepted_at is null and expires_at > now()`;
      if ((pending?.n ?? 0) >= MAX_PENDING_INVITES) throw new HttpError(429, 'too_many_invites');
      const [member] = await tx`select 1 from membership m join app_user_account a on a.id = m.user_id where m.org_id = ${orgId} and a.email_hash = ${lookupHash(body.data.email)}`;
      if (member) throw new HttpError(409, 'already_a_member');
      const t = newToken('alw_inv');
      const [o] = await tx`select display_name from organisation where id = ${orgId}`;
      const [row] = await tx`insert into org_invite (org_id, email_ct, email_hash, role, token_hash, invited_by, expires_at)
                             values (${orgId}, ${encrypt(body.data.email)}, ${lookupHash(body.data.email)}, ${body.data.role}, ${t.hash}, ${id.sub}, ${new Date(Date.now() + INVITE_DAYS * 86_400_000)})
                             returning id, role, expires_at`;
      await tx`insert into outbox (channel, template, org_id, params_ct, not_before)
               values ('email', 'team.invite', ${orgId}, ${encrypt(JSON.stringify({ to: body.data.email, invite: t.token, org: o!.display_name }))}, now())`;
      await audit(tx, { actor: id.sub, orgId, action: 'team.invite', subject: `invite:${row!.id}` });
      return { id: row!.id, email: body.data.email, role: row!.role, expiresAt: row!.expires_at };
    });
    return c.json(invite, 201);
  });

  app.delete('/v1/account/orgs/:id/invites/:inviteId', async (c) => {
    const id = identity(c);
    const orgId = c.req.param('id');
    await asService(sql, async (tx) => {
      await requireAdmin(tx, id.sub, orgId);
      await tx`delete from org_invite where id = ${c.req.param('inviteId')} and org_id = ${orgId} and accepted_at is null`;
      await audit(tx, { actor: id.sub, orgId, action: 'team.invite_revoke', subject: `invite:${c.req.param('inviteId')}` });
    });
    return c.json({ ok: true });
  });

  app.delete('/v1/account/orgs/:id/members/:userId', async (c) => {
    const id = identity(c);
    const orgId = c.req.param('id');
    const userId = c.req.param('userId');
    await asService(sql, async (tx) => {
      await requireAdmin(tx, id.sub, orgId);
      const [target] = await tx`select role from membership where org_id = ${orgId} and user_id = ${userId}`;
      if (!target) throw new HttpError(404, 'not_found');
      if (target.role === 'admin') {
        const [admins] = await tx`select count(*)::int as n from membership where org_id = ${orgId} and role = 'admin'`;
        if ((admins?.n ?? 0) <= 1) throw new HttpError(409, 'last_admin');
      }
      await tx`delete from membership where org_id = ${orgId} and user_id = ${userId}`;
      await audit(tx, { actor: id.sub, orgId, action: 'team.remove', subject: `user:${userId}` });
    });
    return c.json({ ok: true });
  });

  app.post('/v1/account/invites/accept', async (c) => {
    const id = identity(c);
    if (!id.email) throw new HttpError(422, 'email_required');
    const body = z.object({ token: z.string().regex(/^alw_inv_[A-Za-z0-9_-]{20,}$/) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw new HttpError(422, 'invalid_body');
    const email = id.email.trim().toLowerCase();
    const result = await asService(sql, async (tx) => {
      const [inv] = await tx`select id, org_id, email_hash, role, expires_at, accepted_at from org_invite where token_hash = ${tokenHash(body.data.token)}`;
      if (!inv || inv.accepted_at || new Date(inv.expires_at) < new Date()) throw new HttpError(404, 'invite_expired');
      if (!Buffer.from(inv.email_hash).equals(lookupHash(email))) throw new HttpError(403, 'invite_for_another_email');
      const [existing] = await tx`select id from app_user_account where email_hash = ${lookupHash(email)}`;
      if (existing && existing.id !== id.sub) throw new HttpError(409, 'email_linked_to_another_account');
      if (!existing) {
        await tx`insert into app_user_account (id, email_ct, email_hash, display_name) values (${id.sub}, ${encrypt(email)}, ${lookupHash(email)}, ${email.split('@')[0]!})
                 on conflict (id) do nothing`;
      }
      await tx`insert into membership (user_id, org_id, role) values (${id.sub}, ${inv.org_id}, ${inv.role}) on conflict (user_id, org_id) do nothing`;
      await tx`update org_invite set accepted_at = now() where id = ${inv.id}`;
      await audit(tx, { actor: id.sub, orgId: inv.org_id, action: 'team.join', subject: `invite:${inv.id}` });
      const [o] = await tx`select display_name from organisation where id = ${inv.org_id}`;
      return { orgId: inv.org_id, name: o!.display_name, role: inv.role };
    });
    return c.json(result);
  });
}
