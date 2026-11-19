import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Hono } from 'hono';
import { z } from 'zod';
import { asApp, asService, type Sql } from '@always/db';
import { assess, diffRegisters, quarterOf, validateRegister, JURISDICTIONS, type Answers, type ComplianceProfile, type PlatformSignals, type Register } from '@always/core';
import { requirePrincipal, HttpError, type Env } from './auth.js';
import { audit } from './audit.js';

/**
 * Always Compliance (RFC 0003). Organisation facts and assessments only: nothing here
 * touches people's details. Every register change is approved by a person before members
 * see it; every quarterly assessment is approved by a person at the ministry.
 */

const BUNDLED = fileURLToPath(new URL('../../../spec/compliance/register.json', import.meta.url));

export const Profile = z.object({
  states: z.array(z.enum(JURISDICTIONS as unknown as [string, ...string[]])).min(1).max(8),
  collectsPersonalInfo: z.boolean(),
  turnoverOver3m: z.boolean(),
  providesHealthService: z.boolean(),
  usesOverseasServices: z.boolean(),
  worksWithChildren: z.boolean(),
  onlineServicesForChildren: z.boolean(),
  sendsEmailOrSms: z.boolean(),
  acncRegistered: z.boolean(),
  basicReligiousCharity: z.boolean(),
  acncMediumOrLarge: z.boolean(),
});

const AnswersBody = z.object({
  answers: z.array(z.object({
    evidenceId: z.string().regex(/^[a-z0-9-]{2,60}$/),
    answer: z.enum(['yes', 'no', 'unsure', 'not_applicable']),
    note: z.string().max(1000).optional(),
  })).min(1).max(100),
});

/** The latest approved register, or the bundled draft when none is published yet. */
export async function currentRegister(sql: Sql): Promise<Register> {
  const [row] = await sql`select content from compliance_register order by published_at desc limit 1`;
  if (row) return row.content as Register;
  return JSON.parse(readFileSync(BUNDLED, 'utf8')) as Register;
}

/** What Always Platform enforces in code, so members don't have to prove it themselves. */
export function platformSignals(region = process.env.REGION ?? ''): PlatformSignals {
  const inAustralia = /ap-southeast-2|syd|australia/i.test(region);
  return {
    consent_records: true, // every response carries a consent receipt (packages/core/consent)
    access_controls: true, // row-level security and roles on every table with personal data
    retention_schedule: true, // nightly retention job deletes on the Data Governance schedule
    minors_rules: true, // age band first, parent confirmation, verified youth partners only
    data_in_australia: inAustralia,
  };
}

async function loadState(sql: Sql, orgId: string) {
  const [p] = await sql`select profile from compliance_profile where org_id = ${orgId}`;
  const rows = await sql`select evidence_id, answer from compliance_answer where org_id = ${orgId}`;
  const answers: Answers = Object.fromEntries(rows.map((r) => [r.evidence_id, r.answer]));
  return { profile: (p?.profile ?? null) as ComplianceProfile | null, answers };
}

export function registerComplianceRoutes(app: Hono<Env>, sql: Sql, now: () => Date) {
  // Public: the open register and the feed of approved changes. No sign-in.
  app.get('/v1/compliance/register', async (c) => c.json(await currentRegister(sql)));

  app.get('/v1/compliance/changes', async (c) => {
    const versions = await sql`select version, content, published_at, change_summary from compliance_register order by published_at`;
    const feed = [];
    for (let i = 1; i < versions.length; i++) {
      const [prev, cur] = [versions[i - 1]!, versions[i]!];
      feed.push({ version: cur.version, publishedAt: cur.published_at, summary: cur.change_summary, changes: diffRegisters(prev.content as Register, cur.content as Register) });
    }
    return c.json({ versions: feed.reverse() });
  });

  // Public, stateless check-up: nothing is stored. Powers the website onboarding.
  app.post('/v1/compliance/check', async (c) => {
    const body = z.object({ profile: Profile, answers: z.record(z.string().max(60), z.enum(['yes', 'no', 'unsure', 'not_applicable'])).default({}) }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw new HttpError(422, 'invalid_body');
    const register = await currentRegister(sql);
    return c.json(assess(register, body.data.profile as ComplianceProfile, body.data.answers as Answers, {}, now()));
  });

  // Members (admins, or tokens with the compliance scope).
  app.get('/v1/compliance/profile', async (c) => {
    const p = requirePrincipal(c, 'compliance');
    const state = await asApp(sql, { orgId: p.orgId, userId: p.userId }, (tx) => loadState(tx as unknown as Sql, p.orgId));
    return c.json(state);
  });

  app.put('/v1/compliance/profile', async (c) => {
    const p = requirePrincipal(c, 'compliance');
    const parsed = Profile.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(422, 'invalid_body');
    await asApp(sql, { orgId: p.orgId, userId: p.userId }, async (tx) => {
      await tx`insert into compliance_profile (org_id, profile, updated_by) values (${p.orgId}, ${tx.json(parsed.data)}, ${p.userId ?? null})
               on conflict (org_id) do update set profile = excluded.profile, updated_at = now(), updated_by = excluded.updated_by`;
    });
    return c.json({ ok: true });
  });

  app.put('/v1/compliance/answers', async (c) => {
    const p = requirePrincipal(c, 'compliance');
    const parsed = AnswersBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) throw new HttpError(422, 'invalid_body');
    const known = new Set((await currentRegister(sql)).obligations.flatMap((o) => o.evidence.map((e) => e.id)));
    const unknown = parsed.data.answers.filter((a) => !known.has(a.evidenceId)).map((a) => a.evidenceId);
    if (unknown.length) return c.json({ error: 'unknown_evidence', unknown }, 422);
    await asApp(sql, { orgId: p.orgId, userId: p.userId }, async (tx) => {
      for (const a of parsed.data.answers) {
        await tx`insert into compliance_answer (org_id, evidence_id, answer, note, updated_by) values (${p.orgId}, ${a.evidenceId}, ${a.answer}, ${a.note ?? null}, ${p.userId ?? null})
                 on conflict (org_id, evidence_id) do update set answer = excluded.answer, note = excluded.note, updated_at = now(), updated_by = excluded.updated_by`;
      }
    });
    return c.json({ ok: true, saved: parsed.data.answers.length });
  });

  /** The live assessment, from the latest register and today's answers. */
  app.get('/v1/compliance/assessment', async (c) => {
    const p = requirePrincipal(c, 'compliance');
    const { profile, answers } = await asApp(sql, { orgId: p.orgId, userId: p.userId }, (tx) => loadState(tx as unknown as Sql, p.orgId));
    if (!profile) throw new HttpError(409, 'profile_needed');
    return c.json(assess(await currentRegister(sql), profile, answers, platformSignals(), now()));
  });

  app.get('/v1/compliance/assessments', async (c) => {
    const p = requirePrincipal(c, 'compliance');
    const rows = await asApp(sql, { orgId: p.orgId, userId: p.userId }, (tx) =>
      tx`select id, quarter, register_version, created_at, approved_at, result->'summary' as summary from compliance_assessment order by quarter desc`);
    return c.json({ assessments: rows });
  });

  app.get('/v1/compliance/assessments/:id', async (c) => {
    const p = requirePrincipal(c, 'compliance');
    const [row] = await asApp(sql, { orgId: p.orgId, userId: p.userId }, (tx) =>
      tx`select id, quarter, register_version, created_at, approved_at, result from compliance_assessment where id = ${c.req.param('id')}`);
    if (!row) throw new HttpError(404, 'not_found');
    return c.json(row);
  });

  /** A person at the ministry approves the quarterly draft. Then it goes to their notify address. */
  app.post('/v1/compliance/assessments/:id/approve', async (c) => {
    const p = requirePrincipal(c, 'compliance');
    if (!p.userId) throw new HttpError(403, 'person_required'); // tokens and agents can't approve
    await asApp(sql, { orgId: p.orgId, userId: p.userId }, async (tx) => {
      const [row] = await tx`update compliance_assessment set approved_at = ${now()}, approved_by = ${p.userId!}
                             where id = ${c.req.param('id')} and approved_at is null returning id`;
      if (!row) throw new HttpError(404, 'not_found_or_approved');
    });
    await asService(sql, async (tx) => {
      await tx`insert into outbox (channel, template, org_id, not_before) values ('email', 'compliance.ready', ${p.orgId}, ${now()})`;
      await audit(tx, { actor: p.userId, orgId: p.orgId, action: 'compliance.approve', subject: `assessment:${c.req.param('id')}` });
    });
    return c.json({ ok: true });
  });

  // The foundation team: review what the watcher found, and publish register versions.
  app.get('/v1/ops/compliance/changes', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam) throw new HttpError(403, 'care_team_only');
    const rows = await sql`select c.id, c.detected_at, c.draft_summary, c.status, s.name, s.url, s.jurisdiction
                           from compliance_change c join compliance_source s on s.id = c.source_id
                           where c.status = 'pending' order by c.detected_at`;
    return c.json({ changes: rows });
  });

  app.post('/v1/ops/compliance/changes/:id/decide', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam || !p.userId) throw new HttpError(403, 'care_team_only');
    const b = z.object({ decision: z.enum(['approved', 'dismissed']), note: z.string().max(2000).optional() }).safeParse(await c.req.json().catch(() => null));
    if (!b.success) throw new HttpError(422, 'invalid_body');
    await asService(sql, async (tx) => {
      const [row] = await tx`update compliance_change set status = ${b.data.decision}, decided_by = ${p.userId!}, decided_at = ${now()}, decision_note = ${b.data.note ?? null}
                             where id = ${c.req.param('id')} and status = 'pending' returning id`;
      if (!row) throw new HttpError(404, 'not_found');
      await audit(tx, { actor: p.userId, orgId: p.orgId, action: `compliance.change.${b.data.decision}`, subject: `change:${row.id}` });
    });
    return c.json({ ok: true });
  });

  /** Publish a register version. A named reviewer is required; the register must validate. */
  app.post('/v1/ops/compliance/register', async (c) => {
    const p = requirePrincipal(c);
    if (!p.careTeam || !p.userId) throw new HttpError(403, 'care_team_only');
    const b = z.object({ register: z.record(z.string(), z.unknown()), approvedBy: z.string().min(3).max(120), changeSummary: z.string().max(4000).optional() }).safeParse(await c.req.json().catch(() => null));
    if (!b.success) throw new HttpError(422, 'invalid_body');
    const reg = b.data.register as unknown as Register;
    const problems = Array.isArray(reg.obligations) ? validateRegister(reg) : ['no obligations'];
    if (problems.length) return c.json({ error: 'invalid_register', problems }, 422);
    await asService(sql, async (tx) => {
      const [exists] = await tx`select 1 from compliance_register where version = ${reg.version}`;
      if (exists) throw new HttpError(409, 'version_exists');
      await tx`insert into compliance_register (version, content, status, approved_by, change_summary)
               values (${reg.version}, ${tx.json(b.data.register as never)}, ${reg.status === 'reviewed' ? 'reviewed' : 'draft'}, ${b.data.approvedBy}, ${b.data.changeSummary ?? null})`;
      await audit(tx, { actor: p.userId, orgId: p.orgId, action: 'compliance.register.publish', subject: `register:${reg.version}` });
    });
    return c.json({ ok: true, version: reg.version }, 201);
  });
}

// ---------------------------------------------------------------- Scheduled jobs

export type Fetcher = (url: string) => Promise<string>;
/** Optional agent that drafts a plain-English summary of a change. A person always decides. */
export type Summariser = (sourceName: string, url: string) => Promise<string>;

/** Strip markup and whitespace so cosmetic page changes don't raise a change. */
export function fingerprint(page: string): string {
  const text = page
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return createHash('sha256').update(text).digest('hex');
}

/** Daily: check each official source; record a pending change for a person to review. */
export async function runComplianceWatch(sql: Sql, at: Date, fetcher: Fetcher, summarise?: Summariser) {
  const sources = await sql`select id, name, url, last_hash from compliance_source where enabled order by id`;
  let changed = 0;
  let failed = 0;
  for (const s of sources) {
    try {
      const hash = fingerprint(await fetcher(s.url));
      if (s.last_hash && s.last_hash !== hash) {
        const draft = summarise ? await summarise(s.name, s.url).catch(() => null) : null;
        await sql`insert into compliance_change (source_id, draft_summary) values (${s.id}, ${draft ?? `${s.name} has changed. Review the page and decide whether the register needs an update.`})`;
        await sql`update compliance_source set last_changed_at = ${at} where id = ${s.id}`;
        changed++;
      }
      await sql`update compliance_source set last_hash = ${hash}, last_checked_at = ${at} where id = ${s.id}`;
    } catch (e) {
      failed++;
      console.error(JSON.stringify({ level: 'error', msg: 'compliance_watch_failed', source: s.id, err: (e as Error).message }));
    }
  }
  return { checked: sources.length, changed, failed };
}

/** Daily: on the first run of each quarter, draft every member's assessment and tell them it's ready to review. */
export async function runComplianceQuarterly(sql: Sql, at: Date) {
  const quarter = quarterOf(at);
  const register = await currentRegister(sql);
  const [hasRegister] = await sql`select 1 from compliance_register where version = ${register.version}`;
  if (!hasRegister) return { quarter, drafted: 0, skipped: 'no_published_register' };
  const due = await sql`select p.org_id, p.profile from compliance_profile p
                        where not exists (select 1 from compliance_assessment a where a.org_id = p.org_id and a.quarter = ${quarter})`;
  let drafted = 0;
  for (const row of due) {
    const answers = await sql`select evidence_id, answer from compliance_answer where org_id = ${row.org_id}`;
    const result = assess(register, row.profile as ComplianceProfile, Object.fromEntries(answers.map((a) => [a.evidence_id, a.answer])), platformSignals(), at);
    await sql.begin(async (tx) => {
      const [ins] = await tx`insert into compliance_assessment (org_id, quarter, register_version, result) values (${row.org_id}, ${quarter}, ${register.version}, ${tx.json(result as never)})
                             on conflict (org_id, quarter) do nothing returning id`;
      if (ins) await tx`insert into outbox (channel, template, org_id, not_before) values ('email', 'compliance.draft', ${row.org_id}, ${at})`;
    });
    drafted++;
  }
  return { quarter, drafted };
}

/** Production fetcher: official pages only, with a timeout and a clear user agent. */
export const httpFetcher: Fetcher = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'AlwaysComplianceWatcher/1.0 (+https://alwaysfoundation.org)' }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return res.text();
};
