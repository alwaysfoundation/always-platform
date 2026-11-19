import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { SignJWT } from 'jose';
import { migrate, type Sql } from '@always/db';

/**
 * End-to-end tests against a real Postgres 16 (CI starts one as a service).
 * Synthetic data only. Each run uses a fresh database.
 */
const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = `always_journey_test_${Date.now()}`;
const sent: { channel: string; template: string }[] = [];

process.env.FIELD_KEY = randomBytes(32).toString('base64');
process.env.HASH_KEY = randomBytes(32).toString('base64');
process.env.LINK_KEY = randomBytes(32).toString('base64');
process.env.ORG_CODE_KEY = randomBytes(32).toString('base64');
process.env.AUTH_JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.CRON_SECRET = 'cron-test';
process.env.EXPOSE_LINKS_FOR_TESTS = '1';

let admin: Sql;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test queries read rows loosely
let sql: any;
let app: ReturnType<typeof import('../src/app.js').createApp>;
// The next Wednesday at 00:00 UTC (11am in Sydney, staffed), always ahead of the database clock.
const nextWednesday = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + 1 + ((3 - d.getUTCDay() + 7) % 7 || 7)); return d; };
const inDays = (n: number, hourUtc: number) => new Date(nextWednesday().getTime() + n * 86_400_000 + hourUtc * 3_600_000).toISOString();
let clock = nextWednesday();
const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};

async function call(method: string, path: string, opts: { token?: string; org?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.org) headers['x-always-org'] = opts.org;
  const res = await app.request(path, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  return { status: res.status, body: (await res.json()) as any };
}

async function userJwt(userId: string) {
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.AUTH_JWT_SECRET));
}

const baseResponse = {
  firstName: 'Sam',
  contact: { kind: 'mobile', value: '0400000000' },
  suburb: 'Parramatta',
  postcode: '2150',
  state: 'NSW',
  ageBand: '18+',
  step: 'church',
  consent: { purposes: ['connect.church', 'notify.sender'], recipients: [], allowNextNearby: true, wordingVersion: 'v1', party: 'self' },
};

beforeAll(async () => {
  admin = postgres(ADMIN_URL, { max: 1 }) as unknown as Sql;
  await admin.unsafe(`create database ${DB}`);
  sql = postgres(ADMIN_URL.replace(/\/[^/]*$/, `/${DB}`), { max: 4, onnotice: () => {} });
  await migrate(sql, fileURLToPath(new URL('../../../db/migrations', import.meta.url)));

  const { createApp } = await import('../src/app.js');
  const { encrypt, lookupHash, newToken } = await import('../src/crypto.js');
  app = createApp(sql, {
    now: () => clock,
    verifyHuman: async (t) => t === 'human-ok',
    adapters: {
      email: async (m) => void sent.push({ channel: 'email', template: m.template }),
      sms: async (m) => void sent.push({ channel: 'sms', template: m.template }),
      webhook: async () => void sent.push({ channel: 'webhook', template: 'webhook' }),
    },
  });

  await sql`insert into place_centroid values ('2150','Parramatta','NSW',-33.815,151.003), ('2151','North Parramatta','NSW',-33.80,151.00), ('2000','Sydney','NSW',-33.8688,151.2093)`;
  const mk = async (name: string, slug: string, lat: number, lng: number, trust: string, extra: Record<string, unknown> = {}) => {
    const [o] = await sql`insert into organisation (kind, display_name, slug, suburb, state, postcode, geo_lat, geo_lng, trust_level, last_confirmed_at, notify_email_ct, is_care_team)
      values ('church', ${name}, ${slug}, 'Parramatta', 'NSW', '2150', ${lat}, ${lng}, ${trust}, now(), ${encrypt(`${slug}@example.org`)}, ${!!extra.care})
      returning id`;
    await sql`insert into capacity (org_id, monthly_limit, area_radius_km) values (${o.id}, 10, 10)`;
    for (const cat of ['church', 'explore', 'youth']) await sql`insert into offer_category (org_id, category) values (${o.id}, ${cat})`;
    return o.id as string;
  };
  ids.a = await mk('Hope Church Parramatta', 'hope-parramatta', -33.815, 151.004, 'verified_youth');
  ids.b = await mk('Grace Church North Parramatta', 'grace-north-parramatta', -33.801, 151.0, 'verified');
  ids.listed = await mk('Unverified Fellowship', 'unverified', -33.816, 151.004, 'listed');
  ids.care = await mk('Always care team', 'care-team', -33.86, 151.2, 'verified', { care: true });
  ids.sender = await mk('City Events', 'city-events', -34.9, 138.6, 'verified');
  await sql`update organisation set connect_trained_at = now() where id in (${ids.a}, ${ids.b})`;

  for (const [key, org, scopes] of [
    ['sender', ids.sender, ['responses:write']],
    ['a', ids.a, ['inbox', 'profile', 'activity', 'events']],
    ['listed', ids.listed, ['profile']],
    ['b', ids.b, ['inbox', 'profile', 'activity', 'reports']],
  ] as const) {
    const t = newToken('alw_test');
    await sql`insert into api_token (org_id, name, token_hash, scopes) values (${org}, ${key}, ${t.hash}, ${scopes as unknown as string[]})`;
    tokens[key] = t.token;
  }
  const [u] = await sql`insert into app_user_account (email_ct, email_hash, display_name) values (${encrypt('ops@example.org')}, ${lookupHash('ops@example.org')}, 'Ops') returning id`;
  ids.opsUser = u.id;
  await sql`insert into membership (user_id, org_id, role) values (${u.id}, ${ids.care}, 'admin')`;
  tokens.ops = await userJwt(u.id);
});

afterAll(async () => {
  await sql?.end();
  await admin?.unsafe(`drop database if exists ${DB} with (force)`);
  await admin?.end();
});


const journeyConsent = { purposes: ['connect.church', 'share.journey'], recipients: [], allowNextNearby: true, wordingVersion: 'v1', party: 'self' };

describe('journeys across ministries', () => {
  let first: any, second: any;

  it('refuses share.journey for anyone under 18', async () => {
    const r = await call('POST', '/v1/responses', { token: tokens.sender, body: { ...baseResponse, contact: { kind: 'mobile', value: '0411111111' }, ageBand: '15-17', step: 'youth', consent: journeyConsent } });
    expect(r.status).toBe(422);
    expect(r.body.error ?? r.body.message).toContain('journey_adults_only');
  });

  it('links two responses from the same adult through different ministries, and keeps the link inside the platform', async () => {
    first = (await call('POST', '/v1/responses', { token: tokens.sender, body: { ...baseResponse, contact: { kind: 'mobile', value: '0422 222 222' }, consent: journeyConsent } })).body;
    expect((await call('POST', `/v1/handoffs/${first.handoffId}/accept`, { token: tokens.a })).status).toBe(200);
    await call('POST', `/v1/handoffs/${first.handoffId}/contacted`, { token: tokens.a });
    await call('POST', `/v1/me/${first.selfToken}/connected`, { body: {} });
    expect((await call('POST', `/v1/me/${first.selfToken}/milestones`, { body: { milestone: 'baptised' } })).status).toBe(201);
    second = (await call('POST', '/v1/responses', { token: tokens.sender, body: { ...baseResponse, step: 'explore', contact: { kind: 'mobile', value: '+61422222222' }, consent: journeyConsent } })).body;
    const [{ n }] = await sql`select count(distinct journey_id)::int as n from journey_response`;
    expect(n).toBe(1);
    const [j] = await sql`select link_hash from journey`;
    expect(Buffer.from(j.link_hash).toString('utf8')).not.toContain('422');
  });

  it('shows the receiving church earlier steps by month, with its own code and nothing else', async () => {
    const holder = (await sql`select org_id from handoff_offer where handoff_id = ${second.handoffId} order by seq desc limit 1`)[0].org_id;
    const tok = holder === ids.a ? tokens.a : tokens.b;
    expect((await call('POST', `/v1/handoffs/${second.handoffId}/accept`, { token: tok })).status).toBe(200);
    const v = await call('GET', `/v1/handoffs/${second.handoffId}/journey`, { token: tok });
    expect(v.status).toBe(200);
    expect(v.body.linked).toBe(true);
    expect(v.body.code).toMatch(/^jny_/);
    const ms = v.body.steps.map((s: any) => s.milestone);
    expect(ms).toEqual(expect.arrayContaining(['responded', 'introduced', 'accepted', 'connected', 'baptised']));
    expect(JSON.stringify(v.body)).not.toMatch(/Hope Church|Grace Church|Sam|0422|Parramatta/);
    for (const s of v.body.steps) expect(s.month).toMatch(/^\d{4}-\d{2}$/);
    const [{ n }] = await sql`select count(*)::int as n from audit_event where action = 'journey.view'`;
    expect(n).toBe(1);
  });

  it('gives each ministry a different code for the same person', async () => {
    const v1 = await call('GET', `/v1/handoffs/${first.handoffId}/journey`, { token: tokens.a });
    const holder = (await sql`select org_id from handoff_offer where handoff_id = ${second.handoffId} and outcome = 'accepted'`)[0].org_id;
    const v2 = await call('GET', `/v1/handoffs/${second.handoffId}/journey`, { token: holder === ids.a ? tokens.a : tokens.b });
    if (holder !== ids.a) expect(v1.body.code).not.toBe(v2.body.code);
    else expect(v1.body.code).toBe(v2.body.code);
  });

  it('shows nothing to a church that has not accepted the person', async () => {
    const holder = (await sql`select org_id from handoff_offer where handoff_id = ${second.handoffId} and outcome = 'accepted'`)[0].org_id;
    const other = holder === ids.a ? tokens.b : tokens.a;
    expect((await call('GET', `/v1/handoffs/${second.handoffId}/journey`, { token: other })).status).toBe(404);
  });

  it('stops showing the journey once the person withdraws', async () => {
    await call('POST', `/v1/me/${first.selfToken}/withdraw`, { body: {} });
    const holder = (await sql`select org_id from handoff_offer where handoff_id = ${second.handoffId} and outcome = 'accepted'`)[0].org_id;
    const v = await call('GET', `/v1/handoffs/${second.handoffId}/journey`, { token: holder === ids.a ? tokens.a : tokens.b });
    expect(v.body.steps.map((s: any) => s.milestone)).not.toContain('baptised');
    expect(v.body.steps.filter((s: any) => s.milestone === 'responded')).toHaveLength(1);
  });

  it('reports network totals with small numbers withheld', async () => {
    const r = await call('GET', '/v1/network/journeys', { token: tokens.b });
    expect(r.status).toBe(200);
    const responded = r.body.milestones.find((m: any) => m.milestone === 'responded');
    expect(responded.total).toBeNull();
    expect(JSON.stringify(r.body)).not.toMatch(/Sam|0422|jny_/);
    expect(r.body.privacy).toContain('Totals only');
  });
});
