import type { Sql } from '@always/db';
import { decrypt, hmacSign } from './crypto.js';
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
      const [o] = await sql`select notify_email_ct from organisation where id = ${m.org_id}`;
      const to = decrypt(o?.notify_email_ct);
      if (!to) return; // no address yet: nothing to send, mark sent
      // Email says "someone is waiting" and links to the inbox. No names, no faith details (PV-8).
      await a.email({ template: m.template, to, params: { inboxUrl: `${process.env.APP_URL ?? ''}/inbox` } });
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
        if (!ep.events.includes(m.template) && !ep.events.includes('*')) continue;
        // CloudEvents 1.0, structured mode. Data carries ids only.
        const body = JSON.stringify({
          specversion: '1.0',
          id: `outbox-${m.id}`,
          source: 'https://api.alwaysfoundation.org',
          type: m.template,
          time: now.toISOString(),
          datacontenttype: 'application/json',
          data: { responseId: m.response_id },
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
