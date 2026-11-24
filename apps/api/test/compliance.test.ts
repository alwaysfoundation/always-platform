import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { SignJWT } from 'jose';
import { migrate, type Sql } from '@always/db';

/**
 * Always Safety (compliance module), end to end against a real Postgres 16. Synthetic organisations only.
 * Organisation facts and assessments only: no people's details are involved.
 */
const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = `always_compliance_test_${Date.now()}`;
const sent: { channel: string; template: string; url?: string; body?: string }[] = [];
const pages: Record<string, string> = {};

process.env.FIELD_KEY = randomBytes(32).toString('base64');
process.env.HASH_KEY = randomBytes(32).toString('base64');
process.env.AUTH_JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.CRON_SECRET = 'cron-test';
process.env.REGION = 'ap-southeast-2';

let admin: Sql;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test queries read rows loosely
let sql: any;
let app: ReturnType<typeof import('../src/app.js').createApp>;
let clock = new Date('2026-11-19T01:00:00Z');
const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};
const register = JSON.parse(readFileSync(fileURLToPath(new URL('../../../spec/safety/register.json', import.meta.url)), 'utf8'));

const profile = {
  states: ['NSW'], collectsPersonalInfo: true, turnoverOver3m: false, providesHealthService: false, usesOverseasServices: false,
  worksWithChildren: true, onlineServicesForChildren: false, sendsEmailOrSms: true, acncRegistered: true, basicReligiousCharity: true, acncMediumOrLarge: false,
};

async function call(method: string, path: string, opts: { token?: string; org?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', ...(opts.headers ?? {}) };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.org) headers['x-always-org'] = opts.org;
  const res = await app.request(path, { method, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  return { status: res.status, body: (await res.json()) as any };
}
const cron = (path: string) => call('POST', path, { headers: { 'x-cron-secret': 'cron-test' } });

async function userJwt(userId: string) {
  return new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setAudience('authenticated')
    .setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_JWT_SECRET));
}

beforeAll(async () => {
  admin = postgres(ADMIN_URL, { max: 1 }) as unknown as Sql;
  await admin.unsafe(`create database ${DB}`);
  sql = postgres(ADMIN_URL.replace(/\/[^/]*$/, `/${DB}`), { max: 4, onnotice: () => {} });
  await migrate(sql, fileURLToPath(new URL('../../../db/migrations', import.meta.url)));
  const { createApp } = await import('../src/app.js');
  const { encrypt, lookupHash, newToken } = await import('../src/crypto.js');
  app = createApp(sql, {
    now: () => clock,
    adapters: {
      email: async (m) => void sent.push({ channel: 'email', template: m.template }),
      sms: async (m) => void sent.push({ channel: 'sms', template: m.template }),
      webhook: async (url, body) => void sent.push({ channel: 'webhook', template: 'webhook', url, body }),
    },
    complianceFetcher: async (url) => pages[url] ?? '<html><body>unchanged</body></html>',
  });
  const mkOrg = async (name: string, slug: string, care = false) => {
    const [o] = await sql`insert into organisation (kind, display_name, slug, state, trust_level, notify_email_ct, is_care_team)
                          values ('church', ${name}, ${slug}, 'NSW', 'verified', ${encrypt(`${slug}@example.org`)}, ${care}) returning id`;
    return o.id as string;
  };
  const mkAdmin = async (org: string, email: string) => {
    const [u] = await sql`insert into app_user_account (email_ct, email_hash, display_name) values (${encrypt(email)}, ${lookupHash(email)}, 'Admin') returning id`;
    await sql`insert into membership (user_id, org_id, role) values (${u.id}, ${org}, 'admin')`;
    return userJwt(u.id);
  };
  ids.a = await mkOrg('Hope Church', 'hope');
  ids.b = await mkOrg('Grace Church', 'grace');
  ids.care = await mkOrg('Always foundation team', 'foundation', true);
  tokens.a = await mkAdmin(ids.a, 'a-admin@example.org');
  tokens.b = await mkAdmin(ids.b, 'b-admin@example.org');
  tokens.ops = await mkAdmin(ids.care, 'ops@example.org');
  const t = newToken('alw_test');
  await sql`insert into api_token (org_id, name, token_hash, scopes) values (${ids.a}, 'integration', ${t.hash}, ${['compliance']})`;
  tokens.integration = t.token;
});

afterAll(async () => {
  await sql?.end();
  await admin?.unsafe(`drop database if exists ${DB} with (force)`);
  await admin?.end();
});

describe('the open register', () => {
  it('is public, and is the bundled draft until a version is published', async () => {
    const r = await call('GET', '/v1/compliance/register');
    expect(r.status).toBe(200);
    expect(r.body.version).toBe(register.version);
    expect(r.body.status).toBe('draft');
  });

  it('the public check-up stores nothing and returns an assessment', async () => {
    const r = await call('POST', '/v1/compliance/check', { body: { profile, answers: { 'pp-published': 'no' } } });
    expect(r.status).toBe(200);
    expect(r.body.items.find((i: any) => i.obligationId === 'privacy-policy').status).toBe('attention');
    const [{ n }] = await sql`select count(*)::int as n from compliance_profile`;
    expect(n).toBe(0);
  });

  it('rejects a malformed check-up', async () => {
    expect((await call('POST', '/v1/compliance/check', { body: { profile: { states: [] } } })).status).toBe(422);
  });
});

describe('Always Safety paths', () => {
  it('serves the register and check-up under /v1/safety', async () => {
    const r = await app.request('/v1/safety/register');
    expect(r.status).toBe(200);
    const c = await call('POST', '/v1/safety/check', { body: { profile: { countries: ['GB'], collectsPersonalInfo: true, providesHealthService: false, usesOverseasServices: false,
      worksWithChildren: true, onlineServicesForChildren: false, sendsEmailOrSms: true, registeredCharity: true } } });
    expect(c.status).toBe(200);
    expect(c.body.items.map((i: any) => i.obligationId)).toEqual(expect.arrayContaining(['gb-breach', 'gb-annual-return']));
  });
  it('keeps the earlier /v1/compliance paths working, marked as deprecated', async () => {
    const r = await app.request('/v1/compliance/register');
    expect(r.status).toBe(200);
    expect(r.headers.get('deprecation')).toBe('true');
  });
  it('asks for an Australian state when Australia is chosen', async () => {
    const c = await call('POST', '/v1/safety/check', { body: { profile: { ...profile, countries: ['AU'], states: [] } } });
    expect(c.status).toBe(422);
  });
});

describe('a member', () => {
  it('needs to sign in', async () => {
    expect((await call('GET', '/v1/compliance/profile')).status).toBe(401);
  });

  it('asks for a profile before assessing', async () => {
    expect((await call('GET', '/v1/compliance/assessment', { token: tokens.a, org: ids.a })).status).toBe(409);
  });

  it('saves a profile and answers, and sees a live assessment that includes what Always Platform guarantees', async () => {
    expect((await call('PUT', '/v1/compliance/profile', { token: tokens.a, org: ids.a, body: profile })).status).toBe(200);
    const saved = await call('PUT', '/v1/compliance/answers', { token: tokens.a, org: ids.a, body: { answers: [{ evidenceId: 'cn-forms', answer: 'yes' }, { evidenceId: 'wwcc-register', answer: 'no' }] } });
    expect(saved.body.saved).toBe(2);
    const a = await call('GET', '/v1/compliance/assessment', { token: tokens.a, org: ids.a });
    expect(a.status).toBe(200);
    expect(a.body.items.find((i: any) => i.obligationId === 'collection-notice').status).toBe('met'); // consent records come from the platform
    expect(a.body.items[0].obligationId).toBe('working-with-children-checks'); // what needs attention comes first
  });

  it('cannot answer evidence that is not in the register', async () => {
    const r = await call('PUT', '/v1/compliance/answers', { token: tokens.a, org: ids.a, body: { answers: [{ evidenceId: 'made-up', answer: 'yes' }] } });
    expect(r.status).toBe(422);
    expect(r.body.unknown).toEqual(['made-up']);
  });

  it("never sees another member's profile or answers (row-level security)", async () => {
    const b = await call('GET', '/v1/compliance/profile', { token: tokens.b, org: ids.b });
    expect(b.body.profile).toBeNull();
    expect(b.body.answers).toEqual({});
    // Org B claiming to be org A is refused at sign-in, before any query.
    expect((await call('GET', '/v1/compliance/profile', { token: tokens.b, org: ids.a })).status).toBeGreaterThanOrEqual(401);
  });
});

describe('publishing the register', () => {
  it('is for the foundation team only', async () => {
    const r = await call('POST', '/v1/ops/compliance/register', { token: tokens.a, org: ids.a, body: { register, approvedBy: 'Reviewer' } });
    expect(r.status).toBe(403);
  });

  it('refuses an invalid register', async () => {
    const bad = { ...register, version: 'bad', obligations: [{ ...register.obligations[0], law: [] }] };
    const r = await call('POST', '/v1/ops/compliance/register', { token: tokens.ops, org: ids.care, body: { register: bad, approvedBy: 'Reviewer' } });
    expect(r.status).toBe(422);
    expect(r.body.problems[0]).toMatch(/no legal source/);
  });

  it('publishes a version with a named reviewer', async () => {
    const r = await call('POST', '/v1/ops/compliance/register', { token: tokens.ops, org: ids.care, body: { register, approvedBy: 'Foundation legal reviewer' } });
    expect(r.status).toBe(201);
    expect((await call('POST', '/v1/ops/compliance/register', { token: tokens.ops, org: ids.care, body: { register, approvedBy: 'Again' } })).status).toBe(409);
  });
});

describe('the quarterly assessment', () => {
  it('drafts one assessment per member per quarter and tells them it is ready', async () => {
    const r = await cron('/jobs/compliance-quarterly');
    expect(r.body).toEqual({ quarter: '2026-Q4', drafted: 1 });
    expect((await cron('/jobs/compliance-quarterly')).body.drafted).toBe(0); // idempotent
    const [o] = await sql`select count(*)::int as n from outbox where template = 'compliance.draft' and org_id = ${ids.a}`;
    expect(o.n).toBe(1);
  });

  it('only a person can approve it, once', async () => {
    const list = await call('GET', '/v1/compliance/assessments', { token: tokens.a, org: ids.a });
    const id = list.body.assessments[0].id;
    expect((await call('POST', `/v1/compliance/assessments/${id}/approve`, { token: tokens.integration })).status).toBe(403);
    expect((await call('POST', `/v1/compliance/assessments/${id}/approve`, { token: tokens.a, org: ids.a })).status).toBe(200);
    expect((await call('POST', `/v1/compliance/assessments/${id}/approve`, { token: tokens.a, org: ids.a })).status).toBe(404);
    expect((await call('GET', `/v1/compliance/assessments/${id}`, { token: tokens.b, org: ids.b })).status).toBe(404); // not theirs
    await cron('/jobs/outbox');
    expect(sent.some((s) => s.template === 'compliance.ready')).toBe(true);
  });
});

describe('watching the law', () => {
  it('records a change for a person to review when an official page changes', async () => {
    expect((await cron('/jobs/compliance-watch')).body.changed).toBe(0); // first look sets the baseline
    pages['https://www.oaic.gov.au/privacy/privacy-registers/privacy-codes/childrens-online-privacy-code'] = '<html><body>The Code is registered.</body></html>';
    const r = await cron('/jobs/compliance-watch');
    expect(r.body).toMatchObject({ changed: 1, failed: 0 });
    const q = await call('GET', '/v1/ops/compliance/changes', { token: tokens.ops, org: ids.care });
    expect(q.body.changes).toHaveLength(1);
    expect(q.body.changes[0].name).toMatch(/Children's Online Privacy Code/);
    expect((await call('GET', '/v1/ops/compliance/changes', { token: tokens.a, org: ids.a })).status).toBe(403);
    const d = await call('POST', `/v1/ops/compliance/changes/${q.body.changes[0].id}/decide`, { token: tokens.ops, org: ids.care, body: { decision: 'approved', note: 'Update status when commencement is set' } });
    expect(d.status).toBe(200);
  });

  it('ignores cosmetic changes (markup and whitespace)', async () => {
    pages['https://www.oaic.gov.au/privacy/privacy-registers/privacy-codes/childrens-online-privacy-code'] = '<html>\n<body><p>The Code   is registered.</p><script>x()</script></body></html>';
    expect((await cron('/jobs/compliance-watch')).body.changed).toBe(0);
  });

  it('publishes what changed between register versions', async () => {
    const next = JSON.parse(JSON.stringify(register));
    next.version = '2027.01.0';
    next.obligations.find((o: any) => o.id === 'childrens-online-privacy-code').status = 'in_force';
    expect((await call('POST', '/v1/ops/compliance/register', { token: tokens.ops, org: ids.care, body: { register: next, approvedBy: 'Foundation legal reviewer', changeSummary: 'Children\'s Code in force' } })).status).toBe(201);
    clock = new Date('2027-01-05T01:00:00Z');
    const feed = await call('GET', '/v1/compliance/changes');
    expect(feed.body.versions[0].version).toBe('2027.01.0');
    expect(feed.body.versions[0].changes[0]).toMatchObject({ obligationId: 'childrens-online-privacy-code', change: 'changed' });
  });
});

describe('compliance infrastructure', () => {
  it('serves every published version, immutably, and the latest with an ETag', async () => {
    const v = await call('GET', '/v1/compliance/register/versions');
    expect(v.body.versions.map((x: any) => x.version)).toEqual(['2027.01.0', register.version]);
    const old = await app.request(`/v1/compliance/register/${register.version}`);
    expect(old.headers.get('cache-control')).toContain('immutable');
    expect(((await old.json()) as any).version).toBe(register.version);
    expect((await call('GET', '/v1/compliance/register/1999.01.0')).status).toBe(404);
    const latest = await app.request('/v1/compliance/register');
    expect(latest.headers.get('etag')).toBe('"2027.01.0"');
    expect((await app.request('/v1/compliance/register', { headers: { 'if-none-match': '"2027.01.0"' } })).status).toBe(304);
  });

  it('lets any site embed the open data and the check-up, without credentials', async () => {
    const pre = await app.request('/v1/compliance/check', { method: 'OPTIONS', headers: { origin: 'https://loveisourweapon.example', 'access-control-request-method': 'POST' } });
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    expect(pre.headers.get('access-control-allow-credentials')).toBeNull();
    const member = await app.request('/v1/compliance/profile', { headers: { origin: 'https://loveisourweapon.example' } });
    expect(member.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('only accepts public https webhook addresses', async () => {
    expect((await call('POST', '/v1/webhooks', { body: { url: 'https://hooks.example.org/a', events: ['*'] } })).status).toBe(401);
    for (const url of ['http://hooks.example.org/a', 'https://localhost/a', 'https://10.0.0.5/a', 'https://[::1]/a', 'https://user:pw@hooks.example.org/a', 'https://intranet/a']) {
      expect((await call('POST', '/v1/webhooks', { token: tokens.a, org: ids.a, body: { url, events: ['*'] } })).status).toBe(422);
    }
  });

  it('shows the signing secret once, and keeps endpoints within their organisation', async () => {
    const made = await call('POST', '/v1/webhooks', { token: tokens.a, org: ids.a, body: { url: 'https://hooks.example.org/always', events: ['always.compliance.register.published', 'always.compliance.obligations.affected'] } });
    expect(made.status).toBe(201);
    expect(made.body.secret).toMatch(/^whsec_/);
    ids.hook = made.body.id;
    const listed = await call('GET', '/v1/webhooks', { token: tokens.a, org: ids.a });
    expect(listed.body.endpoints).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain('whsec_');
    expect((await call('GET', '/v1/webhooks', { token: tokens.b, org: ids.b })).body.endpoints).toHaveLength(0);
    expect((await call('DELETE', `/v1/webhooks/${ids.hook}`, { token: tokens.b, org: ids.b })).status).toBe(404);
  });

  it('alerts subscribers and affected members when a published version changes their obligations', async () => {
    sent.length = 0;
    await sql`update outbox set status = 'sent' where status = 'pending'`;
    const next = JSON.parse(JSON.stringify(register));
    next.version = '2027.02.0';
    next.obligations.find((o: any) => o.id === 'childrens-online-privacy-code').status = 'in_force';
    next.obligations.find((o: any) => o.id === 'working-with-children-checks').summary = 'Updated summary for the NSW scheme.';
    const pub = await call('POST', '/v1/ops/compliance/register', { token: tokens.ops, org: ids.care, body: { register: next, approvedBy: 'Foundation legal reviewer', changeSummary: 'NSW checks wording' } });
    expect(pub.status).toBe(201);
    expect(pub.body.alerts).toEqual({ subscribers: 1, affected: 1 }); // only Hope Church has a profile
    await cron('/jobs/outbox');
    expect(sent.filter((m) => m.channel === 'email').map((m) => m.template)).toEqual(['compliance.changed']);
    const hooks = sent.filter((m) => m.channel === 'webhook').map((m) => JSON.parse(m.body!));
    expect(hooks.map((h) => h.type).sort()).toEqual(['always.compliance.obligations.affected', 'always.compliance.register.published']);
    const affected = hooks.find((h) => h.type === 'always.compliance.obligations.affected');
    expect(affected.data).toEqual({ version: '2027.02.0', obligationIds: ['working-with-children-checks'] });
    const published = hooks.find((h) => h.type === 'always.compliance.register.published');
    expect(published.data.changes.map((c: any) => c.obligationId)).toEqual(['working-with-children-checks']);
    expect(JSON.stringify(hooks)).not.toMatch(/@example\.org|responseId/);
  });

  it('removes an endpoint for its own organisation', async () => {
    expect((await call('DELETE', `/v1/webhooks/${ids.hook}`, { token: tokens.a, org: ids.a })).status).toBe(200);
    expect((await call('GET', '/v1/webhooks', { token: tokens.a, org: ids.a })).body.endpoints).toHaveLength(0);
  });
});

describe('fingerprint', () => {
  it('ignores scripts and styles, including end tags with spaces or attributes', async () => {
    const { fingerprint } = await import('../src/compliance.js');
    const plain = fingerprint('<p>The Code is registered.</p>');
    expect(fingerprint('<p>The Code is registered.</p><script>x()</script >')).toBe(plain);
    expect(fingerprint('<style media="all">p{}</style foo="bar"><p>The Code is registered.</p>')).toBe(plain);
  });
});

describe('first sign-in for a new ministry', () => {
  const newcomer = '6f1d2c3b-0000-4000-8000-000000000001';
  const stranger = '6f1d2c3b-0000-4000-8000-000000000002';
  const jwtWithEmail = (sub: string, email?: string) =>
    new SignJWT({ role: 'authenticated', ...(email ? { email } : {}) }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setAudience('authenticated')
      .setExpirationTime('1h').sign(new TextEncoder().encode(process.env.AUTH_JWT_SECRET));

  it('needs a session', async () => {
    expect((await call('GET', '/v1/account/orgs')).status).toBe(401);
  });

  it('starts with no organisations', async () => {
    const r = await call('GET', '/v1/account/orgs', { token: await jwtWithEmail(newcomer, 'admin@newchurch.example') });
    expect(r.body.orgs).toEqual([]);
  });

  it('creates a church on the map, with the person as admin', async () => {
    const r = await call('POST', '/v1/account/orgs', { token: await jwtWithEmail(newcomer, 'Admin@NewChurch.example'), body: { kind: 'church', displayName: 'New Test Church', state: 'VIC', postcode: '3000', affirmsCreed: true } });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ name: 'New Test Church', partner: false, role: 'admin' });
    ids.newcomer = r.body.id;
    const [o] = await sql`select trust_level, notify_email_hash is not null as has_notify from organisation where id = ${ids.newcomer}`;
    expect(o).toMatchObject({ trust_level: 'listed', has_notify: true });
  });

  it('lets the new admin save a compliance profile straight away', async () => {
    const t = await jwtWithEmail(newcomer, 'admin@newchurch.example');
    expect((await call('PUT', '/v1/compliance/profile', { token: t, org: ids.newcomer, body: profile })).status).toBe(200);
    expect((await call('GET', '/v1/compliance/assessment', { token: t, org: ids.newcomer })).status).toBe(200);
  });

  it('keeps another person out of that organisation', async () => {
    const t = await jwtWithEmail(stranger, 'someone@else.example');
    expect((await call('GET', '/v1/compliance/profile', { token: t, org: ids.newcomer })).status).toBe(403);
    expect((await call('GET', '/v1/account/orgs', { token: t })).body.orgs).toEqual([]);
  });

  it('refuses an email already linked to a different account', async () => {
    const r = await call('POST', '/v1/account/orgs', { token: await jwtWithEmail(stranger, 'admin@newchurch.example'), body: { kind: 'ministry', displayName: 'Other', state: 'NSW', affirmsCreed: true } });
    expect(r.status).toBe(409);
  });

  it('needs an email on the session and a valid body', async () => {
    expect((await call('POST', '/v1/account/orgs', { token: await jwtWithEmail(stranger), body: { kind: 'church', displayName: 'X Church', state: 'NSW', affirmsCreed: true } })).status).toBe(422);
    expect((await call('POST', '/v1/account/orgs', { token: await jwtWithEmail(stranger, 's@else.example'), body: { kind: 'network', displayName: 'X', state: 'NSW' } })).status).toBe(422);
  });

  it('needs the Nicene Creed affirmed', async () => {
    const t = await jwtWithEmail('6f1d2c3b-0000-4000-8000-000000000008', 'admin@creed.example');
    expect((await call('POST', '/v1/account/orgs', { token: t, body: { kind: 'church', displayName: 'Creed Church', state: 'NSW' } })).status).toBe(422);
    expect((await call('POST', '/v1/account/orgs', { token: t, body: { kind: 'church', displayName: 'Creed Church', state: 'NSW', affirmsCreed: false } })).status).toBe(422);
    const r = await call('POST', '/v1/account/orgs', { token: t, body: { kind: 'church', displayName: 'Creed Church', state: 'NSW', affirmsCreed: true } });
    expect(r.status).toBe(201);
    const [o] = await sql`select creed_affirmed_at is not null as affirmed from organisation where id = ${r.body.id}`;
    expect(o.affirmed).toBe(true);
  });

  it('caps how many organisations one person can create', async () => {
    const t = await jwtWithEmail(newcomer, 'admin@newchurch.example');
    for (let i = 0; i < 4; i++) expect((await call('POST', '/v1/account/orgs', { token: t, body: { kind: 'ministry', displayName: `Test Ministry ${i}`, state: 'NSW', affirmsCreed: true } })).status).toBe(201);
    expect((await call('POST', '/v1/account/orgs', { token: t, body: { kind: 'ministry', displayName: 'One too many', state: 'NSW', affirmsCreed: true } })).status).toBe(429);
  });

  it('starts with every module off', async () => {
    const r = await call('GET', '/v1/account/orgs', { token: await jwtWithEmail(newcomer, 'admin@newchurch.example') });
    expect(r.body.orgs.find((o: { id: string }) => o.id === ids.newcomer).modules).toEqual({ respond: 'off', connect: 'off', safety: 'off', reports: 'off' });
  });

  it('switches modules on and off for the admin, and records it', async () => {
    const t = await jwtWithEmail(newcomer, 'admin@newchurch.example');
    const r = await call('PUT', `/v1/account/orgs/${ids.newcomer}/modules`, { token: t, body: { modules: ['respond', 'safety', 'safety'] } });
    expect(r.status).toBe(200);
    expect(r.body.modules).toEqual({ respond: 'on', connect: 'off', safety: 'on', reports: 'off' });
    const off = await call('PUT', `/v1/account/orgs/${ids.newcomer}/modules`, { token: t, body: { modules: ['safety'] } });
    expect(off.body.modules.respond).toBe('off');
    const [a] = await sql`select count(*)::int as n from audit_event where org_id = ${ids.newcomer} and action = 'org.modules'`;
    expect(a.n).toBe(2);
  });

  it('holds Connect until the partner check is done', async () => {
    const t = await jwtWithEmail(newcomer, 'admin@newchurch.example');
    const r = await call('PUT', `/v1/account/orgs/${ids.newcomer}/modules`, { token: t, body: { modules: ['connect'] } });
    expect(r.body.modules.connect).toBe('awaiting_check');
    await sql`update organisation set trust_level = 'verified' where id = ${ids.newcomer}`;
    const after = await call('GET', '/v1/account/orgs', { token: t });
    expect(after.body.orgs.find((o: { id: string }) => o.id === ids.newcomer).modules.connect).toBe('on');
    await sql`update organisation set trust_level = 'listed' where id = ${ids.newcomer}`;
  });

  it('lets a church choose modules when it is created', async () => {
    const t = await jwtWithEmail('6f1d2c3b-0000-4000-8000-000000000009', 'admin@modules.example');
    const r = await call('POST', '/v1/account/orgs', { token: t, body: { kind: 'church', displayName: 'Modules Church', state: 'QLD', modules: ['respond', 'reports'], affirmsCreed: true } });
    expect(r.status).toBe(201);
    expect(r.body.modules).toEqual({ respond: 'on', connect: 'off', safety: 'off', reports: 'on' });
  });

  it('keeps modules to admins of that organisation', async () => {
    const t = await jwtWithEmail(stranger, 'someone@else.example');
    expect((await call('PUT', `/v1/account/orgs/${ids.newcomer}/modules`, { token: t, body: { modules: ['respond'] } })).status).toBe(403);
    expect((await call('PUT', `/v1/account/orgs/${ids.newcomer}/modules`, { token: await jwtWithEmail(newcomer, 'admin@newchurch.example'), body: { modules: ['giving'] } })).status).toBe(422);
  });

});
