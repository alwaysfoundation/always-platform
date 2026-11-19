import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { SignJWT } from 'jose';
import { migrate, type Sql } from '@always/db';

/**
 * Always Compliance, end to end against a real Postgres 16. Synthetic organisations only.
 * Organisation facts and assessments only: no people's details are involved.
 */
const ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const DB = `always_compliance_test_${Date.now()}`;
const sent: { channel: string; template: string }[] = [];
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
const register = JSON.parse(readFileSync(fileURLToPath(new URL('../../../spec/compliance/register.json', import.meta.url)), 'utf8'));

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
      webhook: async () => void sent.push({ channel: 'webhook', template: 'webhook' }),
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

describe('fingerprint', () => {
  it('ignores scripts and styles, including end tags with spaces or attributes', async () => {
    const { fingerprint } = await import('../src/compliance.js');
    const plain = fingerprint('<p>The Code is registered.</p>');
    expect(fingerprint('<p>The Code is registered.</p><script>x()</script >')).toBe(plain);
    expect(fingerprint('<style media="all">p{}</style foo="bar"><p>The Code is registered.</p>')).toBe(plain);
  });
});
