import { Hono } from 'hono';
import type { Context } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { asApp, asService, type Sql } from '@always/db';
import { rulesFor, consentExpiresAt, POLICY, type PassReason } from '@always/core';
import { authenticate, requirePrincipal, HttpError, type Env } from './auth.js';
import { encrypt, decrypt, lookupHash, newToken, tokenHash, safeEqual } from './crypto.js';
import * as engine from './engine.js';
import { audit } from './audit.js';
import { rateLimit } from './rate-limit.js';
import { runTick, runOutbox, runRetention, type Adapters } from './jobs.js';
import { buildReport, toCsv } from './reports.js';
import { mountMcp } from './mcp.js';
import { registerWebhookRoutes } from './webhooks.js';
import { registerComplianceRoutes, runComplianceWatch, runComplianceQuarterly, httpFetcher, type Fetcher, type Summariser } from './compliance.js';

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
    /** Under 15, when a parent fills the form: the parent confirms the child has agreed too. */
    childAssent: z.boolean().optional(),
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

/** Cloudflare Turnstile: an invisible check that a real person is sending the form. */
async function turnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return process.env.ALLOW_UNVERIFIED_HUMANS === '1';
  if (!token) return false;
  const form = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

export function createApp(sql: Sql, opts: { adapters: Adapters; now?: () => Date; verifyHuman?: (token: string | undefined, ip?: string) => Promise<boolean>; complianceFetcher?: Fetcher; complianceSummariser?: Summariser }) {
  const now = opts.now ?? (() => new Date());
  const verifyHuman = opts.verifyHuman ?? turnstile;
  const app = new Hono<Env>();

  app.use('*', secureHeaders());
  app.use('*', async (c, next) => {
    c.set('sql', sql);
    await next();
  });
  // Open, read-only endpoints may be called from any website (no cookies, no credentials).
  for (const path of ['/v1/feed/*', '/v1/verify/*', '/v1/directory', '/v1/events', '/mcp']) app.use(path, cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['content-type', 'x-always-key', 'mcp-protocol-version'], maxAge: 86400 }));
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

  // ---------------------------------------------------------------- Church feed and verification (open, RFC 0001)
  // Organisation facts only, for churches that opted in. Never people, never staff contact details.
  // A developer key (x-always-key) is optional; if sent, it must be valid.
  const checkAppKey = async (c: Context<Env>) => {
    const key = c.req.header('x-always-key');
    if (!key) return;
    const [k] = await asService(sql, (tx) => tx`
      update app_key set last_used_at = now() where key_hash = ${tokenHash(key)} and revoked_at is null returning id`);
    if (!k) throw new HttpError(401, 'bad_app_key');
  };
  const feedRow = (r: any) => ({
    slug: r.slug, name: r.display_name, kind: r.kind, denomination: r.denomination ?? null,
    suburb: r.suburb ?? null, state: r.state ?? null, postcode: r.postcode ?? null,
    location: r.geo_lat == null ? null : { lat: Number(Number(r.geo_lat).toFixed(3)), lng: Number(Number(r.geo_lng).toFixed(3)) },
    steps: r.steps ?? [], languages: r.languages ?? [], serviceTimes: r.service_times ?? null,
    welcomingNow: !!r.welcoming_now, youthPartner: !!r.youth_partner,
    verified: ['verified', 'verified_youth'].includes(r.trust_level),
    distanceKm: r.distance_km == null ? undefined : Number(Number(r.distance_km).toFixed(1)),
    url: `https://alwaysfoundation.org/#/church/${r.slug}`,
    updatedAt: r.last_confirmed_at ?? null,
  });
  const FEED_COLUMNS = (tx: any) => tx`
    o.slug, o.display_name, o.kind::text as kind, o.denomination, o.suburb, o.state, o.postcode, o.geo_lat, o.geo_lng,
    o.languages, o.service_times, o.trust_level::text as trust_level, o.last_confirmed_at,
    coalesce((select array_agg(category::text order by category) from offer_category where org_id = o.id and active), '{}') as steps,
    r.welcoming_now, r.youth_partner`;

  app.get('/v1/feed/churches', async (c) => {
    await checkAppKey(c);
    const q = parse(z.object({
      postcode: z.string().regex(/^\d{4}$/).optional(),
      lat: z.coerce.number().min(-45).max(-9).optional(), lng: z.coerce.number().min(112).max(155).optional(),
      radiusKm: z.coerce.number().min(1).max(200).default(25),
      step: z.enum(['church', 'explore', 'talk', 'youth', 'group', 'help', 'read']).optional(),
      welcoming: z.enum(['true', 'false']).optional(), youth: z.enum(['true', 'false']).optional(),
      state: z.string().max(3).optional(), limit: z.coerce.number().min(1).max(100).default(25),
    }), c.req.query());
    const rows = await asService(sql, async (tx) => {
      let lat = q.lat, lng = q.lng;
      if (q.postcode && (lat == null || lng == null)) {
        const [pl] = await tx`select lat, lng from place_centroid where postcode = ${q.postcode} limit 1`;
        if (pl) { lat = pl.lat; lng = pl.lng; }
      }
      const near = lat != null && lng != null;
      return tx`
        select ${FEED_COLUMNS(tx)},
          ${near ? tx`6371 * 2 * asin(sqrt(power(sin(radians(o.geo_lat - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(o.geo_lat)) * power(sin(radians(o.geo_lng - ${lng}) / 2), 2)))` : tx`null::float8`} as distance_km
        from organisation o join org_readiness r on r.org_id = o.id
        where o.feed_opt_in_at is not null and not o.is_care_team
          and (${q.state ?? null}::text is null or o.state = ${q.state ?? null})
          and (${q.welcoming !== 'true'} or r.welcoming_now)
          and (${q.youth !== 'true'} or r.youth_partner)
          and (${q.step ?? null}::text is null or exists (select 1 from offer_category oc where oc.org_id = o.id and oc.active and oc.category::text = ${q.step ?? null}))
          ${near ? tx`and o.geo_lat is not null and 6371 * 2 * asin(sqrt(power(sin(radians(o.geo_lat - ${lat}) / 2), 2) + cos(radians(${lat})) * cos(radians(o.geo_lat)) * power(sin(radians(o.geo_lng - ${lng}) / 2), 2))) <= ${q.radiusKm}` : tx``}
        order by ${near ? tx`distance_km` : tx`o.display_name`}
        limit ${q.limit}`;
    });
    c.header('cache-control', 'public, max-age=300');
    return c.json({ items: rows.map(feedRow), licence: 'Facts provided by each church for the Always church feed. Free to use with attribution to the Always Foundation.' });
  });

  app.get('/v1/feed/churches.jsonl', async (c) => {
    await checkAppKey(c);
    const rows = await asService(sql, (tx) => tx`
      select ${FEED_COLUMNS(tx)}, null::float8 as distance_km
      from organisation o join org_readiness r on r.org_id = o.id
      where o.feed_opt_in_at is not null and not o.is_care_team order by o.state, o.display_name`);
    c.header('content-type', 'application/x-ndjson; charset=utf-8');
    c.header('cache-control', 'public, max-age=3600');
    return c.body(rows.map((r: any) => JSON.stringify(feedRow(r))).join('\n') + '\n');
  });

  app.get('/v1/verify/:slug', async (c) => {
    await checkAppKey(c);
    const [r] = await asService(sql, (tx) => tx`
      select o.slug, o.display_name, o.trust_level::text as trust_level, o.verified_at, o.youth_verified_at, r.welcoming_now, r.youth_partner
      from organisation o join org_readiness r on r.org_id = o.id
      where o.slug = ${c.req.param('slug')} and not o.is_care_team`);
    if (!r) throw new HttpError(404, 'not_found');
    c.header('cache-control', 'public, max-age=300');
    return c.json({
      slug: r.slug, name: r.display_name,
      verified: ['verified', 'verified_youth'].includes(r.trust_level), youthPartner: !!r.youth_partner,
      welcomingNow: !!r.welcoming_now, verifiedAt: r.verified_at ?? null,
    });
  });

  app.get('/v1/org/feed', async (c) => {
    const p = requirePrincipal(c, 'profile');
    const [o] = await asService(sql, (tx) => tx`
      select o.feed_opt_in_at, o.slug, r.welcoming_now, r.youth_partner, r.on_time_rate, r.recent_offers,
             o.trust_level::text as trust_level, o.connect_trained_at, o.last_confirmed_at
      from organisation o join org_readiness r on r.org_id = o.id where o.id = ${p.orgId}`);
    if (!o) throw new HttpError(404, 'not_found');
    // Only this organisation sees its own response rate.
    return c.json({
      optedIn: !!o.feed_opt_in_at, at: o.feed_opt_in_at ?? null, slug: o.slug, welcomingNow: !!o.welcoming_now, youthPartner: !!o.youth_partner,
      checks: {
        verified: ['verified', 'verified_youth'].includes(o.trust_level), trained: !!o.connect_trained_at,
        confirmedRecently: !!o.last_confirmed_at && new Date(o.last_confirmed_at).getTime() > Date.now() - 90 * 86_400_000,
        onTimeRate: o.on_time_rate == null ? null : Number(o.on_time_rate), recentOffers: o.recent_offers,
      },
    });
  });

  app.put('/v1/org/feed', async (c) => {
    const p = requirePrincipal(c, 'profile');
    const body = parse(z.object({ optIn: z.boolean() }), await c.req.json());
    const [o] = await asService(sql, async (tx) => {
      const rows = await tx`update organisation set feed_opt_in_at = ${body.optIn ? now() : null} where id = ${p.orgId} returning feed_opt_in_at`;
      await audit(tx, { actor: p.userId, orgId: p.orgId, action: body.optIn ? 'feed.opt_in' : 'feed.opt_out', subject: `org:${p.orgId}` });
      return rows;
    });
    return c.json({ optedIn: !!o?.feed_opt_in_at, at: o?.feed_opt_in_at ?? null });
  });

  app.post('/v1/ops/app-keys', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const body = parse(z.object({ name: z.string().min(2).max(80), contactEmail: z.string().email(), kind: z.enum(['test', 'live']).default('test') }), await c.req.json());
    const t = newToken(`alk_${body.kind}`);
    const k = await asService(sql, async (tx) => {
      const [row] = await tx`insert into app_key (name, contact_email_ct, kind, key_hash) values (${body.name}, ${encrypt(body.contactEmail)}, ${body.kind}, ${t.hash}) returning id`;
      await audit(tx, { actor: p.userId, orgId: p.orgId, action: 'app_key.create', subject: `app_key:${row!.id}` });
      return row!;
    });
    return c.json({ id: k.id, key: t.token, kind: body.kind, note: 'Shown once. Store it in your server environment.' }, 201);
  });

  // ---------------------------------------------------------------- Responses (senders)
  /** Create a consenting response and start its introduction. Shared by senders and hosted response pages. */
  async function createResponse(senderOrgId: string, body: z.output<typeof NewResponse>) {
    const rules = rulesFor(body.ageBand);

    // Minors rules run first (CY rules). Under 13: no child data; a parent gives their own details.
    if (body.ageBand === 'under13') {
      if (body.consent.party !== 'parent') throw new HttpError(422, 'under13_requires_parent');
      if (body.firstName) throw new HttpError(422, 'under13_no_child_data');
    }
    if (rules.requiresParentConfirmation && body.consent.party !== 'parent' && !body.parentContact) {
      throw new HttpError(422, 'parent_contact_required');
    }
    // Under 15: the child agrees as well as the parent. A child filling the form is agreeing themselves;
    // a parent filling it must confirm the child agrees.
    if (rules.requiresChildAssent && body.consent.party === 'parent' && body.consent.childAssent !== true) {
      throw new HttpError(422, 'child_assent_required');
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
        values (${senderOrgId}, ${body.campaignId ?? null}, ${body.placementId ?? null},
                ${body.ageBand === 'under13' ? null : encrypt(body.firstName)}, ${encrypt(JSON.stringify(body.contact))},
                ${body.suburb}, ${body.postcode}, ${place?.lat ?? null}, ${place?.lng ?? null},
                ${body.ageBand}, ${body.step}, ${body.language ?? null}, ${encrypt(body.note)}, ${t},
                ${new Date(t.getTime() + retentionDays * 86_400_000)})
        returning id`;
      if (!r) throw new Error('insert_failed');
      const childAssentAt = rules.requiresChildAssent ? t : null; // checked above for parents; a child's own yes is their assent
      await tx`insert into consent (response_id, purposes, recipients, allow_next_nearby, wording_version, party, age_band, collected_at,
                                    child_assent_at, expires_at)
               values (${r.id}, ${body.consent.purposes}, ${body.consent.recipients}, ${body.consent.allowNextNearby},
                       ${body.consent.wordingVersion}, ${body.consent.party}, ${body.ageBand}, ${t},
                       ${childAssentAt}, ${consentExpiresAt({ collectedAt: t })})`;
      const self = newToken('alp');
      await tx`insert into person_link (token_hash, response_id, purpose, expires_at)
               values (${self.hash}, ${r.id}, 'self_service', ${new Date(t.getTime() + 90 * 86_400_000)})`;
      await tx`insert into outbox (channel, template, response_id, params_ct, not_before)
               values ('sms', 'person.thanks', ${r.id}, ${encrypt(JSON.stringify({ link: self.token }))}, ${t})`;
      let parentToken: string | undefined;
      if (rules.requiresParentConfirmation && body.consent.party !== 'parent') {
        const pt = newToken('alg');
        parentToken = pt.token;
        await tx`insert into person_link (token_hash, response_id, purpose, expires_at)
                 values (${pt.hash}, ${r.id}, 'parent_confirm', ${new Date(t.getTime() + POLICY.retention.parentConfirmationDays * 86_400_000)})`;
        await tx`insert into outbox (channel, template, response_id, params_ct, not_before)
                 values ('sms', 'parent.confirm', ${r.id}, ${encrypt(JSON.stringify({ link: pt.token, to: body.parentContact }))}, ${t})`;
      }
      const handoff = await engine.start(tx, randomUUID(), r.id, t);
      await audit(tx, { orgId: senderOrgId, action: 'response.create', subject: `response:${r.id}` });
      return { responseId: r.id, handoffId: handoff.id, state: handoff.state, selfToken: self.token, parentToken };
    });
    return result;
  }

  function responseBody(result: Awaited<ReturnType<typeof createResponse>>) {
    const expose = process.env.EXPOSE_LINKS_FOR_TESTS === '1';
    return {
        responseId: result.responseId,
        handoffId: result.handoffId,
        state: result.state,
        ...(expose ? { selfToken: result.selfToken, parentToken: result.parentToken } : {}),
    };
  }

  app.post('/v1/responses', async (c) => {
    const p = requirePrincipal(c, 'responses:write');
    const body = parse(NewResponse, await c.req.json());
    return c.json(responseBody(await createResponse(p.orgId, body as z.output<typeof NewResponse>)), 201);
  });

  // ---------------------------------------------------------------- Events (public)
  const EventKind = z.enum(['worship', 'music', 'outreach', 'conference', 'youth', 'course', 'prayer', 'training', 'other']);
  const State = z.enum(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT']);
  const NewEvent = z.object({
    title: z.string().min(3).max(140),
    kind: EventKind.default('other'),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }).optional(),
    venue: z.string().max(140).optional(),
    suburb: z.string().max(80).optional(),
    state: State,
    postcode: z.string().regex(/^\d{4}$/).optional(),
    url: z.string().url().startsWith('https://').optional(),
  });

  app.get('/v1/events', async (c) => {
    const state = c.req.query('state') ?? null;
    const kind = c.req.query('kind') ?? null;
    const limit = Math.min(Number(c.req.query('limit') ?? 50), 200);
    const rows = await sql`
      select id, title, kind::text, starts_at, ends_at, venue, suburb, state, url, source::text
      from event
      where status = 'published' and coalesce(ends_at, starts_at) >= ${now()}
        and (${state}::text is null or state = ${state}) and (${kind}::text is null or kind::text = ${kind})
      order by starts_at limit ${limit}`;
    return c.json({ items: rows });
  });

  // A church or ministry adds its own event. Verified partners publish straight away; others wait for a check.
  app.post('/v1/org/events', async (c) => {
    const p = requirePrincipal(c, 'events');
    const e = parse(NewEvent, await c.req.json());
    const row = await asService(sql, async (tx) => {
      const [o] = await tx`select trust_level from organisation where id = ${p.orgId}`;
      const status = o && ['verified', 'verified_youth'].includes(o.trust_level) ? 'published' : 'pending';
      const [ev] = await tx`insert into event (org_id, title, kind, starts_at, ends_at, venue, suburb, state, postcode, url, source, status)
        values (${p.orgId}, ${e.title}, ${e.kind}, ${e.startsAt}, ${e.endsAt ?? null}, ${e.venue ?? null}, ${e.suburb ?? null}, ${e.state},
                ${e.postcode ?? null}, ${e.url ?? null}, 'org', ${status}) returning id, status::text`;
      await audit(tx, { orgId: p.orgId, action: 'event.create', subject: `event:${ev!.id}` });
      return ev!;
    });
    return c.json(row, 201);
  });

  // Anyone can suggest an event. It shows only after the foundation checks it.
  app.post('/v1/events/suggest', async (c) => {
    const raw = await c.req.json();
    if (!(await verifyHuman(raw?.humanToken, c.req.header('cf-connecting-ip')))) throw new HttpError(403, 'human_check_failed');
    const e = parse(NewEvent, raw);
    const [ev] = await asService(sql, (tx) => tx`insert into event (title, kind, starts_at, ends_at, venue, suburb, state, postcode, url, source, status)
      values (${e.title}, ${e.kind}, ${e.startsAt}, ${e.endsAt ?? null}, ${e.venue ?? null}, ${e.suburb ?? null}, ${e.state},
              ${e.postcode ?? null}, ${e.url ?? null}, 'suggested', 'pending') returning id, status::text`);
    return c.json(ev, 202);
  });

  // ---------------------------------------------------------------- Hosted response pages (online, print, street)
  app.get('/v1/pages/:slug', async (c) => {
    const [pg] = await sql`select rp.slug, rp.title, rp.channel, rp.steps::text[] as steps, rp.brand, o.display_name as ministry
      from response_page rp join organisation o on o.id = rp.org_id where rp.slug = ${c.req.param('slug')} and rp.active`;
    if (!pg) throw new HttpError(404, 'not_found');
    return c.json(pg);
  });

  // The person submits the hosted page: an invisible human check, then the same consent rules as every response.
  app.post('/v1/pages/:slug/respond', async (c) => {
    const raw = await c.req.json();
    if (!(await verifyHuman(raw?.humanToken, c.req.header('cf-connecting-ip')))) throw new HttpError(403, 'human_check_failed');
    const [pg] = await sql`select id, org_id, steps::text[] as steps from response_page where slug = ${c.req.param('slug')} and active`;
    if (!pg) throw new HttpError(404, 'not_found');
    const body = parse(NewResponse, raw);
    if (!pg.steps.includes(body.step)) throw new HttpError(422, 'step_not_offered');
    return c.json(responseBody(await createResponse(pg.org_id, { ...body, placementId: pg.id } as z.output<typeof NewResponse>)), 201);
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

  /** Renew consent for another 12 months. Adults only: a young person's family renews through a new response. */
  app.post('/v1/me/:token/renew', async (c) => {
    const l = await linkFor(c.req.param('token'), 'self_service');
    const t = now();
    const renewed = await asService(sql, async (tx) => {
      const [row] = await tx`update consent set expires_at = ${consentExpiresAt({ collectedAt: t })}
                             where response_id = ${l.response_id} and withdrawn_at is null and age_band = '18+'
                             returning expires_at`;
      if (row) await audit(tx, { action: 'consent.renew', subject: `response:${l.response_id}` });
      return row;
    });
    if (!renewed) throw new HttpError(409, 'cannot_renew');
    return c.json({ expiresAt: renewed.expires_at });
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

  /** The foundation team's queue: what needs a person today. The Always Agent reads this too, and a person decides each item. */
  app.get('/v1/ops/queue', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const q = await asService(sql, async (tx) => {
      const [claims] = await tx`select count(*)::int as n from claim_request where status = 'pending'`;
      const [events] = await tx`select count(*)::int as n from event where status = 'pending'`;
      const [feedback] = await tx`select count(*)::int as n from feedback where status = 'new'`;
      const [care] = await tx`select count(*)::int as n from handoff where state = 'care_team'`;
      const [stale] = await tx`select count(*)::int as n from handoff where state = 'accepted' and first_contact_at is null`;
      return { claims: claims?.n ?? 0, events: events?.n ?? 0, feedback: feedback?.n ?? 0, careTeam: care?.n ?? 0, acceptedNoContact: stale?.n ?? 0 };
    });
    return c.json(q);
  });

  app.get('/v1/ops/claims', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const rows = await asService(sql, (tx) => tx`
      select cr.id, cr.requester_role as role, cr.evidence, cr.created_at, cr.requester_email_ct,
             o.id as org_id, o.display_name, o.suburb, o.state, o.trust_level::text as trust_level
      from claim_request cr join organisation o on o.id = cr.org_id
      where cr.status = 'pending' order by cr.created_at limit 100`);
    return c.json({ items: rows.map(({ requester_email_ct, ...r }: any) => ({ ...r, email: decrypt(requester_email_ct) })) });
  });

  app.post('/v1/ops/claims/:id/decide', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const b = parse(z.object({ decision: z.enum(['approve', 'reject']), note: z.string().max(500).optional() }), await c.req.json());
    const out = await asService(sql, async (tx) => {
      const [cr] = await tx`select id, org_id, requester_email_ct, requester_email_hash, requester_role, status::text as status from claim_request where id = ${c.req.param('id')} for update`;
      if (!cr) throw new HttpError(404, 'not_found');
      if (cr.status !== 'pending') throw new HttpError(409, 'already_decided');
      await tx`update claim_request set status = ${b.decision === 'approve' ? 'approved' : 'rejected'}, decided_by = ${p.userId ?? null},
               decided_at = ${now()}, decision_note = ${b.note ?? null} where id = ${cr.id}`;
      if (b.decision === 'approve') {
        let [u] = await tx`select id from app_user_account where email_hash = ${cr.requester_email_hash}`;
        if (!u) [u] = await tx`insert into app_user_account (email_ct, email_hash, display_name) values (${cr.requester_email_ct}, ${cr.requester_email_hash}, ${cr.requester_role}) returning id`;
        if (!u) throw new Error('user_create_failed');
        await tx`insert into membership (user_id, org_id, role) values (${u.id}, ${cr.org_id}, 'admin') on conflict do nothing`;
        await tx`update organisation set trust_level = 'claimed' where id = ${cr.org_id} and trust_level = 'listed'`;
      }
      await tx`insert into outbox (channel, template, org_id, params_ct, not_before)
               values ('email', ${b.decision === 'approve' ? 'claim.approved' : 'claim.declined'}, ${cr.org_id},
                       ${encrypt(JSON.stringify({ to: decrypt(cr.requester_email_ct) }))}, ${now()})`;
      await audit(tx, { actor: p.userId, orgId: p.orgId, action: `claim.${b.decision}`, subject: `org:${cr.org_id}` });
      return { status: b.decision === 'approve' ? 'approved' : 'rejected' };
    });
    return c.json(out);
  });

  app.get('/v1/ops/events', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const rows = await asService(sql, (tx) => tx`select id, title, kind::text as kind, starts_at, suburb, state, url, source::text as source
      from event where status = 'pending' order by starts_at limit 100`);
    return c.json({ items: rows });
  });

  app.post('/v1/ops/events/:id/decide', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const b = parse(z.object({ decision: z.enum(['publish', 'hide']) }), await c.req.json());
    const [ev] = await asService(sql, async (tx) => {
      const r = await tx`update event set status = ${b.decision === 'publish' ? 'published' : 'hidden'}, reviewed_by = ${p.userId ?? null}, reviewed_at = ${now()}
                         where id = ${c.req.param('id')} and status = 'pending' returning id, status::text as status`;
      if (r[0]) await audit(tx, { actor: p.userId, orgId: p.orgId, action: `event.${b.decision}`, subject: `event:${r[0].id}` });
      return r;
    });
    if (!ev) throw new HttpError(404, 'not_found_or_decided');
    return c.json(ev);
  });

  // ---------------------------------------------------------------- Reports (de-identified totals for ministries, churches and funders)
  const ReportQ = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    view: z.enum(['sender', 'receiver']).default('sender'),
    source: z.string().uuid().optional(),
  });
  const readQuery = (c: any) => { const q = parse(ReportQ, Object.fromEntries(new URL(c.req.url).searchParams)); return { ...q, view: q.view ?? 'sender' }; };

  app.get('/v1/org/report', async (c) => {
    const p = requirePrincipal(c, 'reports');
    const q = readQuery(c);
    const r = await asService(sql, (tx) => buildReport(tx, { orgId: p.orgId, view: q.view, from: q.from, to: q.to, sourceId: q.source }));
    const [profile] = await asService(sql, (tx) => tx`select title, funder_name, intro from report_profile where org_id = ${p.orgId}`);
    const [org] = await asService(sql, (tx) => tx`select display_name from organisation where id = ${p.orgId}`);
    return c.json({ organisation: org?.display_name, profile: profile ?? null, ...r });
  });

  app.get('/v1/org/report.csv', async (c) => {
    const p = requirePrincipal(c, 'reports');
    const q = readQuery(c);
    const r = await asService(sql, (tx) => buildReport(tx, { orgId: p.orgId, view: q.view, from: q.from, to: q.to, sourceId: q.source }));
    return c.body(toCsv(r), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="always-report-${q.from}-to-${q.to}.csv"` });
  });

  app.put('/v1/org/report-profile', async (c) => {
    const p = requirePrincipal(c, 'reports');
    const b = parse(z.object({ title: z.string().max(120).optional(), funderName: z.string().max(120).optional(), intro: z.string().max(1200).optional() }), await c.req.json());
    await asService(sql, async (tx) => {
      await tx`insert into report_profile (org_id, title, funder_name, intro, updated_at) values (${p.orgId}, ${b.title ?? null}, ${b.funderName ?? null}, ${b.intro ?? null}, ${now()})
               on conflict (org_id) do update set title = excluded.title, funder_name = excluded.funder_name, intro = excluded.intro, updated_at = excluded.updated_at`;
      await audit(tx, { actor: p.userId, orgId: p.orgId, action: 'report.profile', subject: `org:${p.orgId}` });
    });
    return c.json({ ok: true });
  });

  /** A private, revocable link a ministry can send to a funder. Shown once. */
  app.post('/v1/org/report-shares', async (c) => {
    const p = requirePrincipal(c, 'reports');
    const b = parse(z.object({ label: z.string().min(2).max(80), from: ReportQ.shape.from, to: ReportQ.shape.to, source: z.string().uuid().optional(), days: z.number().int().min(1).max(366).default(90) }), await c.req.json());
    const t = newToken('alr');
    const [row] = await asService(sql, async (tx) => {
      const report = await buildReport(tx, { orgId: p.orgId, view: 'sender', from: b.from, to: b.to, sourceId: b.source });
      const [profile] = await tx`select title, funder_name, intro from report_profile where org_id = ${p.orgId}`;
      const [org] = await tx`select display_name from organisation where id = ${p.orgId}`;
      const snapshot = { organisation: org?.display_name, profile: profile ?? null, ...report, sharedAt: now().toISOString() };
      const r = await tx`insert into report_share (org_id, token_hash, label, from_day, to_day, source_id, snapshot, expires_at)
                         values (${p.orgId}, ${t.hash}, ${b.label}, ${b.from}, ${b.to}, ${b.source ?? null}, ${tx.json(snapshot as any)},
                                 ${new Date(now().getTime() + (b.days ?? 90) * 86_400_000)}) returning id, expires_at`;
      await audit(tx, { actor: p.userId, orgId: p.orgId, action: 'report.share', subject: `report_share:${r[0]?.id}` });
      return r;
    });
    return c.json({ id: row?.id, token: t.token, expiresAt: row?.expires_at, note: 'Shown once. Anyone with this link can see these totals until it expires or you switch it off.' }, 201);
  });

  app.get('/v1/org/report-shares', async (c) => {
    const p = requirePrincipal(c, 'reports');
    const rows = await asService(sql, (tx) => tx`select id, label, from_day, to_day, expires_at, revoked_at, views, last_viewed_at, created_at from report_share where org_id = ${p.orgId} order by created_at desc`);
    return c.json({ items: rows });
  });

  app.post('/v1/org/report-shares/:id/revoke', async (c) => {
    const p = requirePrincipal(c, 'reports');
    const r = await asService(sql, (tx) => tx`update report_share set revoked_at = ${now()} where id = ${c.req.param('id')} and org_id = ${p.orgId} and revoked_at is null returning id`);
    if (!r[0]) throw new HttpError(404, 'not_found');
    return c.json({ ok: true });
  });

  app.get('/v1/reports/shared/:token', async (c) => {
    const out = await asService(sql, async (tx) => {
      const [s] = await tx`update report_share set views = views + 1, last_viewed_at = ${now()}
                           where token_hash = ${tokenHash(c.req.param('token'))} and revoked_at is null and expires_at > ${now()}
                           returning label, snapshot`;
      if (!s) throw new HttpError(404, 'not_found');
      return { label: s.label, ...s.snapshot };
    });
    return c.json(out);
  });

  app.get('/v1/ops/report', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const q = readQuery(c);
    return c.json(await asService(sql, (tx) => buildReport(tx, { view: 'network', from: q.from, to: q.to })));
  });

  // ---------------------------------------------------------------- Feedback (public, with the human check)
  app.post('/v1/feedback', async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    if (!(await verifyHuman(raw?.humanToken, c.req.header('cf-connecting-ip')))) throw new HttpError(403, 'human_check_failed');
    const b = parse(z.object({ kind: z.enum(['idea', 'bug', 'missing']), area: z.string().min(2).max(80), message: z.string().min(3).max(4000), email: z.string().email().optional().or(z.literal('')) }), raw);
    await asService(sql, (tx) => tx`insert into feedback (kind, area, message, email_ct) values (${b.kind}, ${b.area}, ${b.message}, ${b.email ? encrypt(b.email) : null})`);
    return c.json({ status: 'received' }, 202);
  });

  app.get('/v1/ops/feedback', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const rows = await asService(sql, (tx) => tx`select id, kind::text as kind, area, message, created_at, (email_ct is not null) as wants_reply
      from feedback where status = 'new' order by created_at desc limit 200`);
    return c.json({ items: rows });
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

  // ---------------------------------------------------------------- Always Compliance (RFC 0003)
  registerComplianceRoutes(app, sql, now);
  registerWebhookRoutes(app, sql);

  // ---------------------------------------------------------------- Scheduled jobs (called by cron)
  // On Supabase the cron secret is generated inside the database (Vault) by db/supabase/jobs.sql,
  // so no person ever copies it. Read once and cached; absent outside Supabase.
  let cronSecret: string | null | undefined;
  const vaultCronSecret = async () => {
    if (cronSecret !== undefined) return cronSecret;
    try {
      const [r] = await sql`select decrypted_secret as s from vault.decrypted_secrets where name = 'always_cron_secret'`;
      cronSecret = (r?.s as string | undefined) ?? null;
    } catch { cronSecret = null; }
    return cronSecret;
  };
  const job = (fn: (sql: Sql, t: Date, a: Adapters) => Promise<unknown>) => async (c: any) => {
    // Vercel Cron sends GET with "Authorization: Bearer <CRON_SECRET>"; other schedulers use x-cron-secret.
    const given = c.req.header('x-cron-secret') ?? c.req.header('authorization')?.replace(/^Bearer /, '') ?? '';
    const secret = process.env.CRON_SECRET || (await vaultCronSecret());
    if (!secret || !given || !safeEqual(given, secret)) throw new HttpError(401, 'bad_cron_secret');
    return c.json(await fn(sql, now(), opts.adapters));
  };
  const complianceWatch = (s: Sql, t: Date) => runComplianceWatch(s, t, opts.complianceFetcher ?? httpFetcher, opts.complianceSummariser);
  for (const [path, fn] of [['/jobs/tick', runTick], ['/jobs/outbox', runOutbox], ['/jobs/retention', runRetention], ['/jobs/compliance-watch', complianceWatch], ['/jobs/compliance-quarterly', runComplianceQuarterly]] as const) {
    app.post(path, job(fn));
    app.get(path, job(fn));
  }

  mountMcp(app);
  return app;
}
