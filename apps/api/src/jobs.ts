import type { Sql } from '@always/db';
import { decrypt, hmacSign } from './crypto.js';
import { onboardingStopToken } from './onboarding.js';
import * as engine from './engine.js';

/**
 * Scheduled jobs. In production Vercel Cron (or Supabase pg_cron + pg_net) calls
 * /jobs/tick every minute, /jobs/outbox every minute and /jobs/retention nightly.
 * Each job is idempotent and safe to run twice.
 */

export interface Message {
  template: string;
  to: string;
  params?: Record<string, unknown>;
  /** Outbox id, used as the provider's idempotency key so a retry never sends twice. */
  id?: string;
}

export interface Adapters {
  email: (m: Message) => Promise<void>;
  sms: (m: Message) => Promise<void>;
  webhook: (url: string, body: string, headers: Record<string, string>) => Promise<void>;
}

/** Development adapters: print the template id only, never personal data. */
export const logAdapters: Adapters = {
  email: async (m) => console.log(JSON.stringify({ level: 'info', msg: 'email', template: m.template })),
  sms: async (m) => console.log(JSON.stringify({ level: 'info', msg: 'sms', template: m.template })),
  webhook: async (url) => console.log(JSON.stringify({ level: 'info', msg: 'webhook', host: new URL(url).host })),
};

export async function runTick(sql: Sql, now: Date) {
  const due = await sql`select id from handoff where next_check_at <= ${now} and state in ('awaiting_parent','routing','offered','accepted') order by next_check_at limit 500`;
  let advanced = 0;
  for (const { id } of due) {
    try {
      await sql.begin((tx) => engine.tickOne(tx, id, now));
      advanced++;
    } catch (e) {
      console.error(JSON.stringify({ level: 'error', msg: 'tick_failed', handoff: id, err: (e as Error).message }));
    }
  }
  return { checked: due.length, advanced };
}

const MAX_ATTEMPTS = 6;

export async function runOutbox(sql: Sql, now: Date, adapters: Adapters) {
  const rows = await sql`
    update outbox set attempts = attempts + 1
    where id in (select id from outbox where status = 'pending' and not_before <= ${now} order by id limit 200 for update skip locked)
    returning *`;
  let sent = 0;
  for (const m of rows) {
    try {
      await deliver(sql, m, adapters, now);
      await sql`update outbox set status = 'sent', sent_at = ${now}, last_error = null where id = ${m.id}`;
      sent++;
    } catch (e) {
      const dead = m.attempts >= MAX_ATTEMPTS;
      const backoffMs = Math.min(2 ** m.attempts * 60_000, 6 * 3_600_000);
      await sql`update outbox set status = ${dead ? 'dead' : 'pending'}, last_error = ${(e as Error).message.slice(0, 200)},
                not_before = ${new Date(now.getTime() + backoffMs)} where id = ${m.id}`;
    }
  }
  return { picked: rows.length, sent };
}

async function deliver(sql: Sql, m: Record<string, any>, a: Adapters, now: Date) {
  const params = m.params_ct ? JSON.parse(decrypt(m.params_ct) ?? '{}') : {};
  switch (m.channel) {
    case 'email': {
      const [o] = params.to ? [undefined] : await sql`select notify_email_ct from organisation where id = ${m.org_id}`;
      const to = params.to ?? decrypt(o?.notify_email_ct);
      if (!to) return; // no address yet: nothing to send, mark sent
      // Email says "someone is waiting" and links to the inbox. No names, no faith details (PV-8).
      const extra = m.template.startsWith('onboard.') && m.org_id ? await onboardingParams(sql, m.org_id) : {};
      await a.email({ id: String(m.id), template: m.template, to, params: { ...extra, inboxUrl: `${process.env.APP_URL ?? ''}/inbox`, appUrl: process.env.APP_URL ?? '', safetyUrl: `${process.env.SITE_URL ?? 'https://alwaysfoundation.org'}/#/safety/my`, ...(params.confirm ? { confirmUrl: `${process.env.API_URL ?? ''}/v1/claims/confirm/${params.confirm}` } : {}), ...(params.invite ? { inviteUrl: `${process.env.APP_URL ?? 'https://my.alwaysfoundation.org'}/sign-in?invite=${params.invite}`, org: params.org ?? '' } : {}) } });
      return;
    }
    case 'sms': {
      const [r] = await sql`select contact_ct from response where id = ${m.response_id}`;
      if (!r) return; // deleted or withdrawn
      const target = params.to ?? JSON.parse(decrypt(r.contact_ct) ?? 'null');
      if (!target || target.kind !== 'mobile') return;
      const [org] = m.org_id ? await sql`select display_name from organisation where id = ${m.org_id}` : [undefined];
      await a.sms({ template: m.template, to: target.value, params: { church: org?.display_name, link: params.link ? `${process.env.PERSON_URL ?? ''}/${params.link}` : undefined } });
      return;
    }
    case 'webhook': {
      const endpoints = m.org_id
        ? await sql`select url, secret_ct, events from webhook_endpoint where org_id = ${m.org_id} and active`
        : await sql`select w.url, w.secret_ct, w.events from webhook_endpoint w join response r on r.sender_org_id = w.org_id where r.id = ${m.response_id} and w.active`;
      for (const ep of endpoints) {
        // Endpoints that subscribed under the earlier always.compliance.* names still get those names.
        const legacy = m.template.replace(/^always\.safety\./, 'always.compliance.');
        const type = ep.events.includes(m.template) || ep.events.includes('*') ? m.template : ep.events.includes(legacy) ? legacy : null;
        if (!type) continue;
        // CloudEvents 1.0, structured mode. Data carries ids only; safety events carry register facts, never people.
        const body = JSON.stringify({
          specversion: '1.0',
          id: `outbox-${m.id}`,
          source: 'https://api.alwaysfoundation.org',
          type,
          time: now.toISOString(),
          datacontenttype: 'application/json',
          data: m.template.startsWith('always.safety.') || m.template.startsWith('always.compliance.') ? params : { responseId: m.response_id },
        });
        const ts = Math.floor(now.getTime() / 1000).toString();
        const sig = hmacSign(decrypt(ep.secret_ct)!, `${ts}.${body}`);
        await a.webhook(ep.url, body, { 'content-type': 'application/cloudevents+json', 'always-timestamp': ts, 'always-signature': `v1=${sig}` });
      }
      return;
    }
  }
}

/** Delete what we no longer need (DG retention schedule). Runs nightly. */
export async function runRetention(sql: Sql, now: Date) {
  const deleted = await sql`delete from response where delete_after <= ${now} returning id`;
  const links = await sql`delete from person_link where expires_at <= ${now} returning token_hash`;
  const outbox = await sql`delete from outbox where status in ('sent','dead') and created_at <= ${new Date(now.getTime() - 30 * 86_400_000)} returning id`;
  return { responsesDeleted: deleted.length, linksDeleted: links.length, outboxPurged: outbox.length };
}

const DAY = 86_400_000;
type Step = 'welcome' | 'look' | 'team' | 'checkin' | 'story';

/** Which setup email, if any, an organisation should get now. Steps already done are skipped. */
export function nextOnboardingStep(o: { ageDays: number; hasLogo: boolean; teamSize: number; sent: Step[]; lastSentDaysAgo: number | null }): Step | null {
  const due: [Step, boolean][] = [
    ['welcome', true],
    ['look', o.ageDays >= 2 && !o.hasLogo],
    ['team', o.ageDays >= 5 && o.teamSize <= 1],
    ['checkin', o.ageDays >= 14],
    ['story', o.ageDays >= 90],
  ];
  for (const [step, ok] of due) {
    if (!ok || o.sent.includes(step)) continue;
    // Never two setup emails within two days of each other.
    if (step !== 'welcome' && o.lastSentDaysAgo !== null && o.lastSentDaysAgo < 2) return null;
    return step;
  }
  return null;
}

/** Hourly. Sends at most one setup email per organisation per run, and none to anyone who stopped them. */
export async function runOnboarding(sql: Sql, now: Date) {
  const orgs = await sql`
    select o.id, o.created_at, o.logo_data is not null as has_logo,
      (select count(*)::int from membership m where m.org_id = o.id) + (select count(*)::int from org_invite i where i.org_id = o.id) as team_size,
      coalesce((select array_agg(step) from onboarding_email e where e.org_id = o.id), '{}') as sent,
      (select max(sent_at) from onboarding_email e where e.org_id = o.id) as last_sent
    from organisation o
    where o.onboarding_emails and o.notify_email_ct is not null and o.created_at > ${new Date(now.getTime() - 100 * DAY)}
      and exists (select 1 from membership m where m.org_id = o.id and m.role = 'admin')`;
  let queued = 0;
  for (const o of orgs) {
    const step = nextOnboardingStep({
      ageDays: (now.getTime() - new Date(o.created_at).getTime()) / DAY,
      hasLogo: o.has_logo, teamSize: o.team_size, sent: o.sent as Step[],
      lastSentDaysAgo: o.last_sent ? (now.getTime() - new Date(o.last_sent).getTime()) / DAY : null,
    });
    if (!step) continue;
    const inserted = await sql`insert into onboarding_email (org_id, step, sent_at) values (${o.id}, ${step}, ${now}) on conflict do nothing returning step`;
    if (!inserted.length) continue;
    await sql`insert into outbox (channel, template, org_id, not_before) values ('email', ${`onboard.${step}`}, ${o.id}, ${now})`;
    queued++;
  }
  return { checked: orgs.length, queued };
}

async function onboardingParams(sql: Sql, orgId: string) {
  const [pg] = await sql`select slug from response_page where org_id = ${orgId} order by created_at limit 1`;
  const app = process.env.APP_URL ?? 'https://my.alwaysfoundation.org';
  return {
    pageUrl: pg ? `${app}/p/${pg.slug}` : app,
    settingsUrl: `${app}/settings`,
    stopUrl: `${process.env.API_URL ?? 'https://api.alwaysfoundation.org'}/v1/onboarding/stop/${orgId}.${onboardingStopToken(orgId)}`,
  };
}
