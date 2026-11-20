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
const DB = `always_test_${Date.now()}`;
const sent: { channel: string; template: string }[] = [];

process.env.FIELD_KEY = randomBytes(32).toString('base64');
process.env.HASH_KEY = randomBytes(32).toString('base64');
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
    ['b', ids.b, ['inbox', 'profile', 'activity']],
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

describe('directory', () => {
  it('lists churches publicly and counts them', async () => {
    const r = await call('GET', '/v1/directory?q=parramatta');
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: any) => i.display_name)).toContain('Hope Church Parramatta');
    expect(r.body.items.map((i: any) => i.display_name)).not.toContain('Always care team');
    const t = await call('GET', '/v1/directory/tally');
    expect(t.body.total).toBe(4);
  });

  it('serves a church page by slug', async () => {
    const r = await call('GET', '/v1/orgs/hope-parramatta');
    expect(r.status).toBe(200);
    expect(r.body.offers).toContain('church');
  });
});

describe('response to welcome: the happy path', () => {
  let handoffId = '';
  let selfToken = '';

  it('refuses a response without a sender token', async () => {
    const r = await call('POST', '/v1/responses', { body: baseResponse });
    expect(r.status).toBe(401);
  });

  it('creates a response and offers it to the nearest verified church', async () => {
    const r = await call('POST', '/v1/responses', { token: tokens.sender, body: baseResponse });
    expect(r.status).toBe(201);
    expect(r.body.state).toBe('offered');
    handoffId = r.body.handoffId;
    selfToken = r.body.selfToken;
    const [offer] = await sql`select org_id from handoff_offer where handoff_id = ${handoffId}`;
    expect(offer.org_id).toBe(ids.a);
  });

  it('stores names and contacts as ciphertext only', async () => {
    const [row] = await sql`select first_name_ct, contact_ct from response limit 1`;
    expect(Buffer.from(row.first_name_ct).toString('utf8')).not.toContain('Sam');
    expect(Buffer.from(row.contact_ct).toString('utf8')).not.toContain('0400000000');
  });

  it('shows the offer to the church without contact details until accepted', async () => {
    const r = await call('GET', '/v1/inbox', { token: tokens.a });
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].firstName).toBe('Sam');
    expect(r.body.items[0].contact).toBeUndefined();
  });

  it('hides the person from a church that does not hold the offer (RLS)', async () => {
    const r = await call('GET', '/v1/inbox', { token: tokens.b });
    expect(r.body.items).toHaveLength(0);
    const act = await call('POST', `/v1/handoffs/${handoffId}/activity`, { token: tokens.b, body: { kind: 'note' } });
    expect(act.status).toBe(404);
  });

  it('lets only the holding church accept', async () => {
    const wrong = await call('POST', `/v1/handoffs/${handoffId}/accept`, { token: tokens.b });
    expect(wrong.status).toBe(409);
    const ok = await call('POST', `/v1/handoffs/${handoffId}/accept`, { token: tokens.a });
    expect(ok.status).toBe(200);
    expect(ok.body.state).toBe('accepted');
  });

  it('reveals contact details after acceptance', async () => {
    const r = await call('GET', '/v1/inbox', { token: tokens.a });
    expect(r.body.items[0].contact).toEqual({ kind: 'mobile', value: '0400000000' });
  });

  it('records first contact and activity', async () => {
    expect((await call('POST', `/v1/handoffs/${handoffId}/contacted`, { token: tokens.a })).body.state).toBe('contacted');
    expect((await call('POST', `/v1/handoffs/${handoffId}/activity`, { token: tokens.a, body: { kind: 'met', note: 'Coffee on Sunday' } })).status).toBe(201);
  });

  it('lets the person see which church and confirm they are connected', async () => {
    const me = await call('GET', `/v1/me/${selfToken}`);
    expect(me.body.church).toBe('Hope Church Parramatta');
    const done = await call('POST', `/v1/me/${selfToken}/connected`, { body: { companion: true } });
    expect(done.body.state).toBe('closed');
  });

  it('sends notifications through the outbox with no personal data in templates', async () => {
    const r = await call('POST', '/jobs/outbox', { headers: { 'x-cron-secret': 'cron-test' } });
    expect(r.status).toBe(200);
    expect(sent.some((s) => s.template === 'offer.new')).toBe(true);
    expect(sent.some((s) => s.template === 'person.church_will_contact')).toBe(true);
  });
});

describe('passing, timers and the care team', () => {
  it('moves to the next church when the first passes', async () => {
    const r = await call('POST', '/v1/responses', { token: tokens.sender, body: { ...baseResponse, step: 'explore' } });
    const p = await call('POST', `/v1/handoffs/${r.body.handoffId}/pass`, { token: tokens.a, body: { reason: 'capacity' } });
    expect(p.body.state).toBe('offered');
    const inbox = await call('GET', '/v1/inbox', { token: tokens.b });
    expect(inbox.body.items.some((i: any) => i.handoffId === r.body.handoffId)).toBe(true);
  });

  it('expires an offer after 2 staffed hours and hands to the care team after two churches', async () => {
    const r = await call('POST', '/v1/responses', { token: tokens.sender, body: { ...baseResponse, step: 'explore' } });
    const id = r.body.handoffId;
    clock = new Date(clock.getTime() + 3 * 3_600_000); // still within staffed hours
    await call('POST', '/jobs/tick', { headers: { 'x-cron-secret': 'cron-test' } });
    clock = new Date(clock.getTime() + 3 * 3_600_000);
    await call('POST', '/jobs/tick', { headers: { 'x-cron-secret': 'cron-test' } });
    const [h] = await sql`select state, care_hello_at from handoff where id = ${id}`;
    expect(h.state).toBe('care_team');
    expect(h.care_hello_at).not.toBeNull();
  });

  it('refuses the cron endpoints without the secret', async () => {
    expect((await call('POST', '/jobs/tick')).status).toBe(401);
  });
});

describe('hosted pages on foundation subdomains', () => {
  it('allows a foundation subdomain and refuses other origins', async () => {
    const ok = await app.request('/v1/pages/anything', { method: 'OPTIONS', headers: { origin: 'https://sydneyfire.alwaysfoundation.org', 'access-control-request-method': 'POST' } });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://sydneyfire.alwaysfoundation.org');
    const bad = await app.request('/v1/pages/anything', { method: 'OPTIONS', headers: { origin: 'https://alwaysfoundation.org.evil.example', 'access-control-request-method': 'POST' } });
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('minors', () => {
  it('refuses child data for under-13s', async () => {
    const r = await call('POST', '/v1/responses', { token: tokens.sender, body: { ...baseResponse, ageBand: 'under13', consent: { ...baseResponse.consent, party: 'parent' } } });
    expect(r.status).toBe(422);
    expect(r.body.error).toBe('under13_no_child_data');
  });

  it('waits for a parent for 13 to 14 year olds, then routes only to a verified youth partner', async () => {
    const r = await call('POST', '/v1/responses', {
      token: tokens.sender,
      body: { ...baseResponse, ageBand: '13-14', step: 'youth', parentContact: { kind: 'mobile', value: '0411111111' } },
    });
    expect(r.body.state).toBe('awaiting_parent');
    const c = await call('POST', `/v1/parent/${r.body.parentToken}/confirm`);
    expect(c.body.state).toBe('offered');
    const [o] = await sql`select org_id from handoff_offer where handoff_id = ${r.body.handoffId}`;
    expect(o.org_id).toBe(ids.a); // verified_youth only
  });
  it('records a 13 to 14 year old\'s own yes as their assent', async () => {
    const r = await call('POST', '/v1/responses', {
      token: tokens.sender,
      body: { ...baseResponse, ageBand: '13-14', step: 'youth', parentContact: { kind: 'mobile', value: '0411111111' } },
    });
    const [c] = await sql`select child_assent_at, party from consent where response_id = ${r.body.responseId}`;
    expect(c.party).toBe('self');
    expect(c.child_assent_at).not.toBeNull();
  });

  it('needs a parent to confirm their under-13 child agrees too', async () => {
    const parentBody = { ...baseResponse, firstName: undefined, ageBand: 'under13', step: 'youth' };
    const refused = await call('POST', '/v1/responses', { token: tokens.sender, body: { ...parentBody, consent: { ...baseResponse.consent, party: 'parent' } } });
    expect(refused.status).toBe(422);
    expect(refused.body.error).toBe('child_assent_required');
    const ok = await call('POST', '/v1/responses', { token: tokens.sender, body: { ...parentBody, consent: { ...baseResponse.consent, party: 'parent', childAssent: true } } });
    expect(ok.status).toBe(201);
    const [c] = await sql`select child_assent_at from consent where response_id = ${ok.body.responseId}`;
    expect(c.child_assent_at).not.toBeNull();
  });

  it('refuses a stored under-15 consent with no assent at the database', async () => {
    const [r] = await sql`select response_id from consent where age_band = '13-14' limit 1`;
    await expect(sql`update consent set child_assent_at = null where response_id = ${r.response_id}`).rejects.toThrow(/under15_child_assent/);
  });
});

describe('12-month consent', () => {
  it('sets consent to lapse after 12 months, and lets an adult renew it', async () => {
    const r = await call('POST', '/v1/responses', { token: tokens.sender, body: baseResponse });
    const [c] = await sql`select collected_at, expires_at from consent where response_id = ${r.body.responseId}`;
    const months = (new Date(c.expires_at).getTime() - new Date(c.collected_at).getTime()) / (86_400_000 * 30.4);
    expect(Math.round(months)).toBe(12);
    const renew = await call('POST', `/v1/me/${r.body.selfToken}/renew`);
    expect(renew.status).toBe(200);
    expect(new Date(renew.body.expiresAt).getTime()).toBeGreaterThanOrEqual(new Date(c.expires_at).getTime());
  });

  it('stops a church accepting once consent has lapsed', async () => {
    const r = await call('POST', '/v1/responses', { token: tokens.sender, body: baseResponse });
    await sql`update consent set expires_at = now() - interval '1 minute' where response_id = ${r.body.responseId}`;
    const [o] = await sql`select org_id from handoff_offer where handoff_id = ${r.body.handoffId} and outcome = 'pending'`;
    const token = o.org_id === ids.a ? tokens.a : tokens.b;
    const res = await call('POST', `/v1/handoffs/${r.body.handoffId}/accept`, { token });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('consent:expired');
  });

  it('does not let a young person\'s consent be renewed by link', async () => {
    const r = await call('POST', '/v1/responses', { token: tokens.sender, body: { ...baseResponse, ageBand: '15-17', step: 'youth' } });
    const renew = await call('POST', `/v1/me/${r.body.selfToken}/renew`);
    expect(renew.status).toBe(409);
  });
});

describe('withdrawal and retention', () => {
  it('withdraws and deletes the person', async () => {
    const r = await call('POST', '/v1/responses', { token: tokens.sender, body: baseResponse });
    const w = await call('POST', `/v1/me/${r.body.selfToken}/withdraw`);
    expect(w.body.state).toBe('withdrawn');
    const job = await call('POST', '/jobs/retention', { headers: { 'x-cron-secret': 'cron-test' } });
    expect(job.body.responsesDeleted).toBeGreaterThanOrEqual(1);
    const [gone] = await sql`select count(*)::int as n from response where id = ${r.body.responseId}`;
    expect(gone.n).toBe(0);
  });
});

describe('church profile and operations', () => {
  it('lets a church customise its page', async () => {
    const r = await call('PUT', '/v1/org/profile', {
      token: tokens.a,
      body: { welcomeLine: 'Come as you are', brandColour: '#0F5C4D', pageLayout: { style: 'warm', sections: ['welcome', 'times', 'next_steps'] }, offers: ['church', 'youth'] },
    });
    expect(r.status).toBe(200);
    const page = await call('GET', '/v1/orgs/hope-parramatta');
    expect(page.body.welcome_line).toBe('Come as you are');
    expect(page.body.page_layout.style).toBe('warm');
  });

  it('lets the care team verify a church and issue tokens, and nobody else', async () => {
    const no = await call('POST', `/v1/ops/orgs/${ids.listed}/verify`, { token: tokens.a, body: {} });
    expect(no.status).toBe(403);
    const ok = await call('POST', `/v1/ops/orgs/${ids.listed}/verify`, { token: tokens.ops, org: ids.care, body: {} });
    expect(ok.status).toBe(200);
    const t = await call('POST', '/v1/ops/tokens', { token: tokens.ops, org: ids.care, body: { orgId: ids.b, name: 'Elvanto sync', scopes: ['inbox'] } });
    expect(t.body.token).toMatch(/^alw_test_/);
  });

  it('keeps an unbroken audit chain', async () => {
    const { verifyChain } = await import('../src/audit.js');
    const broken = await sql.begin((tx: any) => verifyChain(tx));
    expect(broken).toBeNull();
    const [n] = await sql`select count(*)::int as n from audit_event`;
    expect(n.n).toBeGreaterThan(5);
  });
});

describe('events', () => {
  const ev = { title: 'City worship night', kind: 'worship', startsAt: inDays(3, 8.5), suburb: 'Parramatta', state: 'NSW', url: 'https://example.org/worship' };
  it('publishes a verified church\'s event straight away and lists it publicly', async () => {
    const r = await call('POST', '/v1/org/events', { token: tokens.a, body: ev });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('published');
    const list = await call('GET', '/v1/events?state=NSW');
    expect(list.body.items.map((e: any) => e.title)).toContain('City worship night');
  });
  it('holds a suggested event until it is checked, and needs the human check', async () => {
    const bad = await call('POST', '/v1/events/suggest', { body: { ...ev, title: 'Youth gig' } });
    expect(bad.status).toBe(403);
    const ok = await call('POST', '/v1/events/suggest', { body: { ...ev, title: 'Youth gig', humanToken: 'human-ok' } });
    expect(ok.status).toBe(202);
    expect(ok.body.status).toBe('pending');
    const list = await call('GET', '/v1/events');
    expect(list.body.items.map((e: any) => e.title)).not.toContain('Youth gig');
  });
  it('refuses an event link that is not https', async () => {
    const r = await call('POST', '/v1/org/events', { token: tokens.a, body: { ...ev, url: 'http://example.org' } });
    expect(r.status).toBe(422);
  });
});

describe('hosted response pages', () => {
  const person = { firstName: 'Ana', contact: { kind: 'mobile', value: '0400 000 111' }, suburb: 'Parramatta', postcode: '2150', state: 'NSW', ageBand: '18+', step: 'church',
    consent: { purposes: ['connect.church'], recipients: [], allowNextNearby: true, wordingVersion: 'v1', party: 'self' } };
  beforeAll(async () => {
    await sql`insert into response_page (org_id, slug, title, channel) values (${ids.sender}, 'testimony-video', 'After the testimony', 'online')`;
  });
  it('serves the page publicly', async () => {
    const r = await call('GET', '/v1/pages/testimony-video');
    expect(r.status).toBe(200);
    expect(r.body.channel).toBe('online');
  });
  it('refuses a response without the human check', async () => {
    const r = await call('POST', '/v1/pages/testimony-video/respond', { body: person });
    expect(r.status).toBe(403);
  });
  it('creates a response and starts an introduction when the check passes', async () => {
    const r = await call('POST', '/v1/pages/testimony-video/respond', { body: { ...person, humanToken: 'human-ok' } });
    expect(r.status).toBe(201);
    expect(['offered', 'routing', 'care_team']).toContain(r.body.state);
    const [row] = await sql`select sender_org_id, placement_id from response where id = ${r.body.responseId}`;
    expect(row.sender_org_id).toBe(ids.sender);
    expect(row.placement_id).toBeTruthy();
  });
  it('refuses a step the page does not offer', async () => {
    const r = await call('POST', '/v1/pages/testimony-video/respond', { body: { ...person, step: 'help', humanToken: 'human-ok' } });
    expect(r.status).toBe(422);
  });
});

describe('foundation team queue', () => {
  it('takes a church claim, and lets only the foundation team approve it', async () => {
    const claim = await call('POST', `/v1/orgs/${ids.listed}/claims`, { body: { email: 'pastor@example.org', role: 'Senior pastor', evidence: 'Listed on the network site' } });
    expect(claim.status).toBe(202);
    const no = await call('GET', '/v1/ops/claims', { token: tokens.a });
    expect(no.status).toBe(403);
    const list = await call('GET', '/v1/ops/claims', { token: tokens.ops, org: ids.care });
    const item = list.body.items.find((i: any) => i.org_id === ids.listed);
    expect(item.email).toBe('pastor@example.org');
    const q = await call('GET', '/v1/ops/queue', { token: tokens.ops, org: ids.care });
    expect(q.body.claims).toBeGreaterThanOrEqual(1);
    const ok = await call('POST', `/v1/ops/claims/${item.id}/decide`, { token: tokens.ops, org: ids.care, body: { decision: 'approve' } });
    expect(ok.body).toEqual({ status: 'approved' });
    const again = await call('POST', `/v1/ops/claims/${item.id}/decide`, { token: tokens.ops, org: ids.care, body: { decision: 'reject' } });
    expect(again.status).toBe(409);
    const [m] = await sql`select count(*)::int as n from membership m join app_user_account u on u.id = m.user_id where m.org_id = ${ids.listed}`;
    expect(m.n).toBe(1);
  });

  it('publishes a suggested event once the foundation team checks it', async () => {
    const s = await call('POST', '/v1/events/suggest', { body: { title: 'Campus night', kind: 'outreach', startsAt: inDays(13, 8), state: 'NSW', humanToken: 'human-ok' } });
    expect(s.status).toBe(202);
    const list = await call('GET', '/v1/ops/events', { token: tokens.ops, org: ids.care });
    const ev = list.body.items.find((e: any) => e.title === 'Campus night');
    const d = await call('POST', `/v1/ops/events/${ev.id}/decide`, { token: tokens.ops, org: ids.care, body: { decision: 'publish' } });
    expect(d.body.status).toBe('published');
  });

  it('takes feedback with the human check and shows it to the team', async () => {
    const bad = await call('POST', '/v1/feedback', { body: { kind: 'idea', area: 'Website', message: 'Add a map' } });
    expect(bad.status).toBe(403);
    const ok = await call('POST', '/v1/feedback', { body: { kind: 'idea', area: 'Website', message: 'Add a map', humanToken: 'human-ok' } });
    expect(ok.status).toBe(202);
    const list = await call('GET', '/v1/ops/feedback', { token: tokens.ops, org: ids.care });
    expect(list.body.items.map((f: any) => f.message)).toContain('Add a map');
  });
});

describe('reports', () => {
  const from = `${clock.getUTCFullYear() - 1}-01-01`, to = `${clock.getUTCFullYear() + 1}-12-31`;
  it('counts each step of the journey without storing anyone\'s details', async () => {
    const [cols] = await sql`select string_agg(column_name, ',') as c from information_schema.columns where table_name = 'journey_tally'`;
    expect(cols.c).not.toMatch(/name|contact|suburb|postcode|response_id/);
    const [t] = await sql`select sum(n)::int as n from journey_tally where milestone = 'responded'`;
    expect(t.n).toBeGreaterThan(0);
  });

  it('withholds figures for small groups', async () => {
    const r = await call('GET', `/v1/org/report?from=${from}&to=${to}`, { token: tokens.ops, org: ids.sender });
    // ops is not a member of the sender: refused
    expect(r.status).toBe(403);
    const { safe } = await import('../src/reports.js');
    expect(safe(0, 0)).toBe(0);
    expect(safe(9, 0)).toBeNull();
    expect(safe(10, 0)).toBe(10);
    expect(safe(15, 1)).toBeNull();
    expect(safe(20, 1)).toBe(20);
  });

  it('gives a ministry its totals, a spreadsheet, and a link it can switch off', async () => {
    const { newToken } = await import('../src/crypto.js');
    const t = newToken('alw_test');
    await sql`insert into api_token (org_id, name, token_hash, scopes) values (${ids.sender}, 'reports', ${t.hash}, ${['reports']})`;
    // Enough synthetic responses that the totals can be shown (earlier tests include young people, so 20 is the minimum).
    for (let i = 0; i < 20; i++) {
      const r = await call('POST', '/v1/responses', { token: tokens.sender, body: { ...baseResponse, firstName: `Test${i}` } });
      expect(r.status).toBe(201);
    }
    const rep = await call('GET', `/v1/org/report?from=${from}&to=${to}`, { token: t.token });
    expect(rep.status).toBe(200);
    expect(rep.body.totals.responded).toBeGreaterThanOrEqual(10);
    expect(rep.body.byStep.find((s: any) => s.step === 'church').count).toBeGreaterThanOrEqual(10);
    expect(rep.body.definitions.connected).toMatch(/told us themselves/);
    expect(JSON.stringify(rep.body)).not.toMatch(/Test\d|0400000000|Parramatta/);

    const csv = await app.request(`/v1/org/report.csv?from=${from}&to=${to}`, { headers: { authorization: `Bearer ${t.token}` } });
    expect(csv.headers.get('content-type')).toMatch(/text\/csv/);
    expect(await csv.text()).toMatch(/^Always report,/);

    const share = await call('POST', '/v1/org/report-shares', { token: t.token, body: { label: 'Board, November', from, to } });
    expect(share.status).toBe(201);
    const seen = await call('GET', `/v1/reports/shared/${share.body.token}`);
    expect(seen.body.totals.responded).toBe(rep.body.totals.responded);
    const off = await call('POST', `/v1/org/report-shares/${share.body.id}/revoke`, { token: t.token, body: {} });
    expect(off.status).toBe(200);
    const gone = await call('GET', `/v1/reports/shared/${share.body.token}`);
    expect(gone.status).toBe(404);
  });

  it('gives the foundation a network view, and nobody else', async () => {
    const no = await call('GET', `/v1/ops/report?from=${from}&to=${to}`, { token: tokens.a });
    expect(no.status).toBe(403);
    const ok = await call('GET', `/v1/ops/report?from=${from}&to=${to}`, { token: tokens.ops, org: ids.care });
    expect(ok.status).toBe(200);
    expect(ok.body.view).toBe('network');
  });
});

describe('no linking of people across organisations (ADR 0013)', () => {
  it('refuses the retired share.journey consent purpose', async () => {
    const r = await call('POST', '/v1/responses', { token: tokens.sender, body: { ...baseResponse, contact: { kind: 'mobile', value: '0433333333' }, consent: { ...baseResponse.consent, purposes: ['connect.church', 'share.journey'] } } });
    expect(r.status).toBe(422);
  });

  it('has no linkage tables, keys or journey endpoints', async () => {
    const [t] = await sql`select count(*)::int as n from information_schema.tables where table_name in ('journey', 'journey_response', 'journey_self_milestone')`;
    expect(t.n).toBe(0);
    const crypto = await import('../src/crypto.js');
    expect(Object.keys(crypto)).not.toContain('journeyLink');
    expect(Object.keys(crypto)).not.toContain('ministryCode');
    for (const path of ['/v1/handoffs/00000000-0000-0000-0000-000000000000/journey', '/v1/responses/00000000-0000-0000-0000-000000000000/journey']) {
      expect((await app.request(path, { headers: { authorization: `Bearer ${tokens.a}` } })).status).toBe(404);
    }
  });

  it('reports network totals by step only, with small numbers withheld', async () => {
    const r = await call('GET', '/v1/network/totals', { token: tokens.ops, org: ids.care });
    expect(r.status).toBe(200);
    expect(r.body.milestones.map((m: any) => m.milestone)).toEqual(['responded', 'introduced', 'accepted', 'contacted', 'connected']);
    expect(r.body.privacy).toContain('Totals only');
  });
});

describe('church feed', () => {
  it('lists only churches that opted in, with no personal details', async () => {
    let r = await call('GET', '/v1/feed/churches?postcode=2150');
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(0);

    for (const t of [tokens.a, tokens.b, tokens.listed]) {
      const o = await call('PUT', '/v1/org/feed', { token: t, body: { optIn: true } });
      expect(o.status).toBe(200);
    }
    r = await call('GET', '/v1/feed/churches?postcode=2150');
    const names = r.body.items.map((i: any) => i.name);
    expect(names).toEqual(expect.arrayContaining(['Hope Church Parramatta', 'Grace Church North Parramatta', 'Unverified Fellowship']));
    const hope = r.body.items.find((i: any) => i.slug === 'hope-parramatta');
    expect(hope.welcomingNow).toBe(true);
    expect(hope.youthPartner).toBe(true);
    expect(hope.distanceKm).toBeLessThan(2);
    expect(hope.steps).toContain('church');
    expect(JSON.stringify(r.body)).not.toMatch(/example\.org|notify|email/i);
    const listed = r.body.items.find((i: any) => i.slug === 'unverified');
    expect(listed.welcomingNow).toBe(false);
  });

  it('shows a church its own readiness checks', async () => {
    const r = await call('GET', '/v1/org/feed', { token: tokens.a });
    expect(r.body).toMatchObject({ optedIn: true, welcomingNow: true, checks: { verified: true, trained: true } });
  });

  it('filters to churches welcoming young people now', async () => {
    const r = await call('GET', '/v1/feed/churches?postcode=2150&welcoming=true&youth=true');
    expect(r.body.items.map((i: any) => i.slug)).toEqual(['hope-parramatta']);
  });

  it('stops welcoming when a church pauses, and when it opts out', async () => {
    await sql`update capacity set paused_until = now() + interval '7 days' where org_id = ${ids.b}`;
    let r = await call('GET', '/v1/feed/churches?postcode=2150&welcoming=true');
    expect(r.body.items.map((i: any) => i.slug)).not.toContain('grace-north-parramatta');
    await sql`update capacity set paused_until = null where org_id = ${ids.b}`;
    await call('PUT', '/v1/org/feed', { token: tokens.listed, body: { optIn: false } });
    r = await call('GET', '/v1/feed/churches?postcode=2150');
    expect(r.body.items.map((i: any) => i.slug)).not.toContain('unverified');
  });

  it('can be called from any website', async () => {
    const res = await app.request('/v1/feed/churches?postcode=2150', { headers: { origin: 'https://uen.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const inbox = await app.request('/v1/inbox', { headers: { origin: 'https://uen.example' } });
    expect(inbox.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('offers the whole feed as a daily download', async () => {
    const res = await app.request('/v1/feed/churches.jsonl');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/ndjson/);
    const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.map((l: any) => l.slug)).toContain('hope-parramatta');
  });

  it('answers whether a church is verified', async () => {
    let r = await call('GET', '/v1/verify/hope-parramatta');
    expect(r.body).toMatchObject({ slug: 'hope-parramatta', verified: true, youthPartner: true });
    await sql`insert into organisation (kind, display_name, slug, suburb, state, trust_level) values ('church', 'Listed Only Chapel', 'listed-only', 'Parramatta', 'NSW', 'listed')`;
    r = await call('GET', '/v1/verify/listed-only');
    expect(r.body).toMatchObject({ verified: false, youthPartner: false, welcomingNow: false });
    r = await call('GET', '/v1/verify/no-such-church');
    expect(r.status).toBe(404);
  });

  it('issues developer keys and refuses unknown ones', async () => {
    const k = await call('POST', '/v1/ops/app-keys', { token: tokens.ops, org: ids.care, body: { name: 'UEN website', contactEmail: 'dev@example.org', kind: 'test' } });
    expect(k.status).toBe(201);
    expect(k.body.key).toMatch(/^alk_test_/);
    let r = await call('GET', '/v1/feed/churches?postcode=2150', { headers: { 'x-always-key': k.body.key } });
    expect(r.status).toBe(200);
    r = await call('GET', '/v1/feed/churches?postcode=2150', { headers: { 'x-always-key': 'alk_test_nope' } });
    expect(r.status).toBe(401);
  });
});

describe('MCP server (read-only, no personal data)', () => {
  const rpc = async (method: string, params?: unknown) => {
    const res = await app.request('/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    return (await res.json()) as any;
  };
  it('initialises and lists only read-only tools', async () => {
    expect((await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } })).result.serverInfo.name).toBe('always');
    const tools = (await rpc('tools/list')).result.tools;
    expect(tools.map((t: any) => t.name)).toEqual(['find_churches', 'verify_church', 'list_events', 'how_always_works']);
    expect(tools.every((t: any) => t.annotations.readOnlyHint)).toBe(true);
  });
  it('finds churches from the feed', async () => {
    const r = await rpc('tools/call', { name: 'find_churches', arguments: { postcode: '2150', welcoming: true } });
    expect(r.result.isError).toBe(false);
    expect(r.result.content[0].text).toMatch(/Hope Church Parramatta/);
    expect(JSON.stringify(r.result)).not.toMatch(/example\.org|Sam/);
  });
  it('acknowledges notifications without a body', async () => {
    const res = await app.request('/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) });
    expect(res.status).toBe(202);
  });
});
