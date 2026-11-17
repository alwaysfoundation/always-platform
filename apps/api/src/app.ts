import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { asApp, asService, type Sql } from '@always/db';
import { rulesFor, POLICY, type PassReason } from '@always/core';
import { authenticate, requirePrincipal, HttpError, type Env } from './auth.js';
import { encrypt, decrypt, lookupHash, newToken, tokenHash, safeEqual } from './crypto.js';
import * as engine from './engine.js';
import { audit } from './audit.js';
import { rateLimit } from './rate-limit.js';
import { runTick, runOutbox, runRetention, type Adapters } from './jobs.js';

const AgeBand = z.enum(['under13', '13-14', '15-17', '18+']);
const Step = z.enum(['church', 'explore', 'talk', 'youth', 'group', 'help', 'read']);
const State = z.enum(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']);
const Purpose = z.enum(['connect.church', 'notify.sender', 'resources', 'stats.anonymous']);

const NewResponse = z.object({
  placementId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  firstName: z.string().trim().min(1).max(60).optional(),
  contact: z.object({ kind: z.enum(['mobile', 'email']), value: z.string().trim().min(5).max(120) }),
  parentContact: z.object({ kind: z.enum(['mobile', 'email']), value: z.string().trim().min(5).max(120) }).optional(),
  suburb: z.string().trim().min(2).max(60),
  postcode: z.string().regex(/^\d{4}$/),
  state: State,
  ageBand: AgeBand,
  step: Step,
  language: z.string().max(40).optional(),
  note: z.string().max(500).optional(),
  consent: z.object({
    purposes: z.array(Purpose).min(1),
    recipients: z.array(z.string().uuid()).default([]),
    allowNextNearby: z.boolean(),
    wordingVersion: z.string().min(1).max(40),
    party: z.enum(['self', 'parent']),
  }),
});

const Profile = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  welcomeLine: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  website: z.string().url().max(200).optional(),
  brandColour: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  pageLayout: z
    .object({
      style: z.enum(['classic', 'warm', 'bold']).optional(),
      sections: z.array(z.enum(['welcome', 'times', 'next_steps', 'what_to_expect', 'kids', 'youth', 'map', 'custom'])).max(12).optional(),
      custom: z.array(z.object({ title: z.string().max(60), body: z.string().max(1000) })).max(4).optional(),
    })
    .optional(),
  offers: z.array(Step).optional(),
  capacity: z
    .object({
      monthlyLimit: z.number().int().min(0).max(500).optional(),
      areaRadiusKm: z.number().min(1).max(100).optional(),
      languages: z.array(z.string().max(40)).max(10).optional(),
      pausedUntil: z.string().datetime().nullable().optional(),
    })
    .optional(),
});

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new HttpError(422, r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return r.data;
}

function engineError(e: unknown): never {
  const m = e instanceof Error ? e.message : String(e);
  if (['no_pending_offer_for_org', 'offer_expired', 'not_holder', 'not_connectable'].includes(m)) throw new HttpError(409, m);
  if (m.startsWith('consent:')) throw new HttpError(403, m);
  if (m.endsWith('_not_found')) throw new HttpError(404, m);
  throw e;
}

export function createApp(sql: Sql, opts: { adapters: Adapters; now?: () => Date }) {
  const now = opts.now ?? (() => new Date());
  const app = new Hono<Env>();

  app.use('*', secureHeaders());
  app.use('*', async (c, next) => {
    c.set('sql', sql);
    await next();
  });
  app.use('*', rateLimit({ windowMs: 60_000, max: Number(process.env.RATE_LIMIT_PER_MIN ?? 120) }));
  app.use('/v1/*', authenticate());

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
    console.error(JSON.stringify({ level: 'error', msg: err.message, path: c.req.path })); // never log bodies
    return c.json({ error: 'internal_error' }, 500);
  });

  app.get('/health', async (c) => {
    await sql`select 1`;
    return c.json({ ok: true, region: process.env.REGION ?? 'local' });
  });

  // ---------------------------------------------------------------- Directory (public)
  app.get('/v1/directory', async (c) => {
    const q = (c.req.query('q') ?? '').trim().toLowerCase();
    const state = c.req.query('state');
    const kind = c.req.query('kind');
    const limit = Math.min(Number(c.req.query('limit') ?? 25), 100);
    const offset = Math.max(Number(c.req.query('offset') ?? 0), 0);
    const rows = await sql`
      select * from directory_listing
      where (${state ?? null}::text is null or state = ${state ?? null})
        and (${kind ?? null}::text is null or kind::text = ${kind ?? null})
        and (${q} = '' or lower(display_name || ' ' || coalesce(suburb,'') || ' ' || coalesce(denomination,'')) like ${'%' + q + '%'})
      order by trust_level desc, display_name
      limit ${limit} offset ${offset}`;
    return c.json({ items: rows, limit, offset });
  });

  app.get('/v1/directory/tally', async (c) => {
    const rows = await sql`select state, kind::text, sum(n)::int as n from directory_tally group by 1, 2 order by 1, 2`;
    const total = rows.reduce((s, r) => s + Number(r.n), 0);
    return c.json({ total, byState: rows });
  });

  app.get('/v1/orgs/:slug', async (c) => {
    const [o] = await sql`
      select id, slug, kind, display_name, denomination, trust_level, suburb, state, website, description, welcome_line, brand_colour, page_layout,
             coalesce((select array_agg(category) from offer_category where org_id = organisation.id and active), '{}') as offers
      from organisation where slug = ${c.req.param('slug')} and not is_care_team`;
    if (!o) throw new HttpError(404, 'not_found');
    return c.json(o);
  });

  app.post('/v1/orgs/:id/claims', async (c) => {
    const body = parse(z.object({ email: z.string().email(), role: z.string().min(2).max(60), evidence: z.string().max(500).optional() }), await c.req.json());
    await asService(sql, async (tx) => {
      const [o] = await tx`select id from organisation where id = ${c.req.param('id')}`;
      if (!o) throw new HttpError(404, 'not_found');
      await tx`insert into claim_request (org_id, requester_email_ct, requester_email_hash, requester_role, evidence)
               values (${o.id}, ${encrypt(body.email)}, ${lookupHash(body.email)}, ${body.role}, ${body.evidence ?? null})`;
    });
    return c.json({ status: 'pending' }, 202);
  });

  // ---------------------------------------------------------------- Responses (senders)
  app.post('/v1/responses', async (c) => {
    const p = requirePrincipal(c, 'responses:write');
    const body = parse(NewResponse, await c.req.json());
    const rules = rulesFor(body.ageBand);

    // Minors rules run first (CY rules). Under 13: no child data; a parent gives their own details.
    if (body.ageBand === 'under13') {
      if (body.consent.party !== 'parent') throw new HttpError(422, 'under13_requires_parent');
      if (body.firstName) throw new HttpError(422, 'under13_no_child_data');
    }
    if (rules.requiresParentConfirmation && body.consent.party !== 'parent' && !body.parentContact) {
      throw new HttpError(422, 'parent_contact_required');
    }
    if (!body.consent.purposes.includes('connect.church')) throw new HttpError(422, 'consent_connect_required');
    if (body.note && body.ageBand !== '18+') body.note = undefined; // no free-text notes for minors

    const t = now();
    const result = await asService(sql, async (tx) => {
      const [place] = await tx`select lat, lng from place_centroid where postcode = ${body.postcode}
                               order by (lower(suburb) = lower(${body.suburb})) desc limit 1`;
      const retentionDays = body.ageBand === '18+' ? POLICY.retention.unreceivedAdultDays : POLICY.retention.unreceivedMinorDays;
      const [r] = await tx`
        insert into response (sender_org_id, campaign_id, placement_id, first_name_ct, contact_ct, suburb, postcode, geo_lat, geo_lng,
                              age_band, step, language, note_ct, created_at, delete_after)
        values (${p.orgId}, ${body.campaignId ?? null}, ${body.placementId ?? null},
                ${body.ageBand === 'under13' ? null : encrypt(body.firstName)}, ${encrypt(JSON.stringify(body.contact))},
                ${body.suburb}, ${body.postcode}, ${place?.lat ?? null}, ${place?.lng ?? null},
                ${body.ageBand}, ${body.step}, ${body.language ?? null}, ${encrypt(body.note)}, ${t},
                ${new Date(t.getTime() + retentionDays * 86_400_000)})
        returning id`;
      if (!r) throw new Error('insert_failed');
      await tx`insert into consent (response_id, purposes, recipients, allow_next_nearby, wording_version, party, age_band, collected_at)
               values (${r.id}, ${body.consent.purposes}, ${body.consent.recipients}, ${body.consent.allowNextNearby},
                       ${body.consent.wordingVersion}, ${body.consent.party}, ${body.ageBand}, ${t})`;
      const self = newToken('alp');
      await tx`insert into person_link (token_hash, response_id, purpose, expires_at)
               values (${self.hash}, ${r.id}, 'self_service', ${new Date(t.getTime() + 90 * 86_400_000)})`;
      await tx`insert into outbox (channel, template, response_id, params_ct)
               values ('sms', 'person.thanks', ${r.id}, ${encrypt(JSON.stringify({ link: self.token }))})`;
      let parentToken: string | undefined;
      if (rules.requiresParentConfirmation && body.consent.party !== 'parent') {
        const pt = newToken('alg');
        parentToken = pt.token;
        await tx`insert into person_link (token_hash, response_id, purpose, expires_at)
                 values (${pt.hash}, ${r.id}, 'parent_confirm', ${new Date(t.getTime() + POLICY.retention.parentConfirmationDays * 86_400_000)})`;
        await tx`insert into outbox (channel, template, response_id, params_ct)
                 values ('sms', 'parent.confirm', ${r.id}, ${encrypt(JSON.stringify({ link: pt.token, to: body.parentContact }))})`;
      }
      const handoff = await engine.start(tx, randomUUID(), r.id, t);
      await audit(tx, { orgId: p.orgId, action: 'response.create', subject: `response:${r.id}` });
      return { responseId: r.id, handoffId: handoff.id, state: handoff.state, selfToken: self.token, parentToken };
    });
    const expose = process.env.EXPOSE_LINKS_FOR_TESTS === '1';
    return c.json(
      {
        responseId: result.responseId,
        handoffId: result.handoffId,
        state: result.state,
        ...(expose ? { selfToken: result.selfToken, parentToken: result.parentToken } : {}),
      },
      201,
    );
  });

  // ---------------------------------------------------------------- Inbox (receiving churches)
  app.get('/v1/inbox', async (c) => {
    const p = requirePrincipal(c, 'inbox');
    const rows = await asApp(sql, { orgId: p.orgId, userId: p.userId }, async (tx) => tx`
      select h.id as handoff_id, h.state, o.outcome, o.deadline, o.offered_at, r.first_name_ct, r.contact_ct, r.suburb, r.age_band, r.step, r.language, r.note_ct
      from handoff_offer o
      join handoff h on h.id = o.handoff_id
      join response r on r.id = h.response_id
      where o.org_id = ${p.orgId} and o.outcome in ('pending', 'accepted')
      order by o.offered_at desc`);
    const items = rows.map((r) => ({
      handoffId: r.handoff_id,
      state: r.state,
      offer: r.outcome,
      deadline: r.deadline,
      firstName: decrypt(r.first_name_ct),
      suburb: r.suburb,
      ageBand: r.age_band,
      step: r.step,
      language: r.language,
      // Contact details only once the church has accepted (DG-12).
      contact: r.outcome === 'accepted' ? JSON.parse(decrypt(r.contact_ct) ?? 'null') : undefined,
      note: r.outcome === 'accepted' ? decrypt(r.note_ct) : undefined,
    }));
    return c.json({ items });
  });

  app.post('/v1/handoffs/:id/accept', async (c) => {
    const p = requirePrincipal(c, 'inbox');
    try {
      const h = await asService(sql, (tx) => engine.accept(tx, c.req.param('id'), p.orgId, p.userId, now()));
      return c.json({ state: h.state });
    } catch (e) {
      engineError(e);
    }
  });

  app.post('/v1/handoffs/:id/pass', async (c) => {
    const p = requirePrincipal(c, 'inbox');
    const { reason } = parse(z.object({ reason: z.enum(['capacity', 'language', 'fit', 'safeguarding', 'other']) }), await c.req.json());
    try {
      const h = await asService(sql, (tx) => engine.pass(tx, c.req.param('id'), p.orgId, reason as PassReason, p.userId, now()));
      return c.json({ state: h.state });
    } catch (e) {
      engineError(e);
    }
  });

  app.post('/v1/handoffs/:id/contacted', async (c) => {
    const p = requirePrincipal(c, 'inbox');
    try {
      const h = await asService(sql, (tx) => engine.contacted(tx, c.req.param('id'), p.orgId, p.userId, now()));
      return c.json({ state: h.state });
    } catch (e) {
      engineError(e);
    }
  });

  app.post('/v1/handoffs/:id/activity', async (c) => {
    const p = requirePrincipal(c, 'activity');
    const body = parse(z.object({ kind: z.enum(['call', 'message', 'text', 'met', 'note', 'reply_received']), note: z.string().max(1000).optional() }), await c.req.json());
    await asApp(sql, { orgId: p.orgId, userId: p.userId }, async (tx) => {
      const [h] = await tx`select id from handoff where id = ${c.req.param('id')}`; // RLS: only if we hold it
      if (!h) throw new HttpError(404, 'not_found');
      await tx`insert into activity (handoff_id, org_id, kind, body_ct, actor) values (${h.id}, ${p.orgId}, ${body.kind}, ${encrypt(body.note)}, ${p.userId ?? null})`;
    });
    return c.json({ ok: true }, 201);
  });

  // ---------------------------------------------------------------- Church profile and page
  app.get('/v1/org/profile', async (c) => {
    const p = requirePrincipal(c, 'profile');
    const [o] = await sql`select id, slug, display_name, trust_level, welcome_line, description, website, brand_colour, page_layout, last_confirmed_at from organisation where id = ${p.orgId}`;
    const offers = await sql`select category from offer_category where org_id = ${p.orgId} and active`;
    const [cap] = await sql`select monthly_limit, area_radius_km, languages, paused_until from capacity where org_id = ${p.orgId}`;
    return c.json({ ...o, offers: offers.map((r) => r.category), capacity: cap ?? null });
  });

  app.put('/v1/org/profile', async (c) => {
    const p = requirePrincipal(c, 'profile');
    const b = parse(Profile, await c.req.json());
    await asApp(sql, { orgId: p.orgId, userId: p.userId }, async (tx) => {
      await tx`update organisation set
        display_name = coalesce(${b.displayName ?? null}, display_name),
        welcome_line = coalesce(${b.welcomeLine ?? null}, welcome_line),
        description = coalesce(${b.description ?? null}, description),
        website = coalesce(${b.website ?? null}, website),
        brand_colour = coalesce(${b.brandColour ?? null}, brand_colour),
        page_layout = coalesce(${b.pageLayout ? sql.json(b.pageLayout) : null}, page_layout),
        last_confirmed_at = now()
        where id = ${p.orgId}`;
      if (b.offers) {
        await tx`delete from offer_category where org_id = ${p.orgId}`;
        for (const cat of b.offers) await tx`insert into offer_category (org_id, category) values (${p.orgId}, ${cat})`;
      }
      if (b.capacity) {
        await tx`insert into capacity (org_id) values (${p.orgId}) on conflict (org_id) do nothing`;
        await tx`update capacity set
          monthly_limit = coalesce(${b.capacity.monthlyLimit ?? null}, monthly_limit),
          area_radius_km = coalesce(${b.capacity.areaRadiusKm ?? null}, area_radius_km),
          languages = coalesce(${b.capacity.languages ?? null}, languages),
          paused_until = ${b.capacity.pausedUntil === undefined ? sql`paused_until` : b.capacity.pausedUntil}
          where org_id = ${p.orgId}`;
      }
    });
    return c.json({ ok: true });
  });

  // ---------------------------------------------------------------- Person self-service (no account)
  async function linkFor(token: string, purpose: string) {
    const [l] = await sql`select l.response_id, h.id as handoff_id from person_link l join handoff h on h.response_id = l.response_id
                          where l.token_hash = ${tokenHash(token)} and l.purpose = ${purpose} and l.expires_at > now()`;
    if (!l) throw new HttpError(404, 'link_expired');
    return l;
  }

  app.get('/v1/me/:token', async (c) => {
    const l = await linkFor(c.req.param('token'), 'self_service');
    const [s] = await sql`
      select h.state, (select o2.display_name from handoff_offer ho join organisation o2 on o2.id = ho.org_id
                       where ho.handoff_id = h.id and ho.outcome = 'accepted' limit 1) as church
      from handoff h where h.id = ${l.handoff_id}`;
    if (!s) throw new HttpError(404, 'not_found');
    return c.json({ state: s.state, church: s.church ?? null });
  });

  app.post('/v1/me/:token/withdraw', async (c) => {
    const l = await linkFor(c.req.param('token'), 'self_service');
    await asService(sql, (tx) => engine.withdraw(tx, l.handoff_id, now()));
    return c.json({ state: 'withdrawn', message: 'Your details will be deleted within 7 days.' });
  });

  app.post('/v1/me/:token/connected', async (c) => {
    const l = await linkFor(c.req.param('token'), 'self_service');
    const body = parse(z.object({ companion: z.boolean().optional() }), await c.req.json().catch(() => ({})));
    try {
      const h = await asService(sql, (tx) => engine.confirmConnected(tx, l.handoff_id, body.companion, now()));
      return c.json({ state: h.state });
    } catch (e) {
      engineError(e);
    }
  });

  app.post('/v1/parent/:token/confirm', async (c) => {
    const l = await linkFor(c.req.param('token'), 'parent_confirm');
    const h = await asService(sql, async (tx) => {
      await tx`update person_link set used_at = now() where token_hash = ${tokenHash(c.req.param('token'))}`;
      return engine.parentConfirmed(tx, l.handoff_id, now());
    });
    return c.json({ state: h.state });
  });

  // ---------------------------------------------------------------- Network operations (care team)
  app.post('/v1/ops/orgs/:id/verify', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const { youth } = parse(z.object({ youth: z.boolean().default(false) }), await c.req.json().catch(() => ({})));
    await asService(sql, async (tx) => {
      await tx`update organisation set trust_level = ${youth ? 'verified_youth' : 'verified'}, verified_at = now(),
               youth_verified_at = ${youth ? new Date() : null}, last_confirmed_at = now() where id = ${c.req.param('id')}`;
      await audit(tx, { actor: p.userId, orgId: p.orgId, action: youth ? 'org.verify_youth' : 'org.verify', subject: `org:${c.req.param('id')}` });
    });
    return c.json({ ok: true });
  });

  app.post('/v1/ops/tokens', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const b = parse(z.object({ orgId: z.string().uuid(), name: z.string().min(2).max(60), scopes: z.array(z.enum(['responses:write', 'inbox', 'profile', 'activity'])).min(1) }), await c.req.json());
    const t = newToken(process.env.NODE_ENV === 'production' ? 'alw_live' : 'alw_test');
    await asService(sql, async (tx) => {
      await tx`insert into api_token (org_id, name, token_hash, scopes) values (${b.orgId}, ${b.name}, ${t.hash}, ${b.scopes})`;
      await audit(tx, { actor: p.userId, orgId: p.orgId, action: 'token.create', subject: `org:${b.orgId}` });
    });
    return c.json({ token: t.token, note: 'Shown once. Store it in your secret manager.' }, 201);
  });

  // ---------------------------------------------------------------- Scheduled jobs (called by cron)
  const job = (fn: (sql: Sql, t: Date, a: Adapters) => Promise<unknown>) => async (c: any) => {
    const secret = process.env.CRON_SECRET;
    // Vercel Cron sends GET with "Authorization: Bearer <CRON_SECRET>"; other schedulers use x-cron-secret.
    const given = c.req.header('x-cron-secret') ?? c.req.header('authorization')?.replace(/^Bearer /, '') ?? '';
    if (!secret || !safeEqual(given, secret)) throw new HttpError(401, 'bad_cron_secret');
    return c.json(await fn(sql, now(), opts.adapters));
  };
  for (const [path, fn] of [['/jobs/tick', runTick], ['/jobs/outbox', runOutbox], ['/jobs/retention', runRetention]] as const) {
    app.post(path, job(fn));
    app.get(path, job(fn));
  }

  return app;
}
