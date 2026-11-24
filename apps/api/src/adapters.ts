import type { Message } from './jobs.js';
import { TEMPLATES } from './templates.js';
import { logAdapters } from './jobs.js';
import { AwsClient } from 'aws4fetch';

/**
 * Production adapters. Each sends only what the message needs:
 * - Email: Resend, or Amazon SES in an Australian region (ADR 0020). Staff alerts carry no personal
 *   data, only a link to the inbox.
 * - SMS: an Australian SMS provider's HTTP API (e.g. MessageMedia, Mobile Message). Texts to the
 *   person carry the church name and a link, never faith details.
 * - Webhooks: HTTPS POST with HMAC signature and a 10 s timeout.
 */

/** Australian AWS regions only: Sydney and Melbourne. Personal data must not leave Australia. */
export const AUSTRALIAN_REGIONS = ['ap-southeast-2', 'ap-southeast-4'] as const;

export function sesRegion(env: Record<string, string | undefined> = process.env): string {
  const region = env.SES_REGION ?? 'ap-southeast-2';
  if (!(AUSTRALIAN_REGIONS as readonly string[]).includes(region)) {
    throw new Error(`ses_region_not_australian:${region}`);
  }
  return region;
}

export function sesEmail(env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch) {
  const region = sesRegion(env);
  const aws = new AwsClient({
    accessKeyId: env.SES_ACCESS_KEY_ID!,
    secretAccessKey: env.SES_SECRET_ACCESS_KEY!,
    service: 'ses',
    region,
  });
  const endpoint = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;
  return async (m: Message) => {
    const t = TEMPLATES[m.template] ?? { subject: 'Always', body: 'You have an update in Always.' };
    const req = await aws.sign(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        FromEmailAddress: env.EMAIL_FROM,
        Destination: { ToAddresses: [m.to] },
        Content: { Simple: { Subject: { Data: t.subject, Charset: 'UTF-8' }, Body: { Text: { Data: render(t.body, m.params), Charset: 'UTF-8' } } } },
        EmailTags: [{ Name: 'template', Value: m.template.replace(/[^a-zA-Z0-9_-]/g, '_') }],
        ...(env.SES_CONFIGURATION_SET ? { ConfigurationSetName: env.SES_CONFIGURATION_SET } : {}),
      }),
    });
    const res = await fetcher(req, { signal: AbortSignal.timeout(10_000) });
    // Never include the response body: it can echo the address.
    if (!res.ok) throw new Error(`email_http_${res.status}`);
  };
}

export function resendEmail(env: Record<string, string | undefined> = process.env, fetcher: typeof fetch = fetch) {
  return async (m: Message) => {
    const t = TEMPLATES[m.template] ?? { subject: 'Always', body: 'You have an update in Always.' };
    const res = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [m.to], subject: t.subject, text: render(t.body, m.params), tags: [{ name: 'template', value: m.template.replace(/[^a-zA-Z0-9_-]/g, '_') }] }),
      signal: AbortSignal.timeout(10_000),
    });
    // Never include the response body: it can echo the address.
    if (!res.ok) throw new Error(`email_http_${res.status}`);
  };
}

export function httpSms() {
  return async (m: Message) => {
    const t = TEMPLATES[m.template];
    if (!t) throw new Error(`unknown_template:${m.template}`);
    const res = await fetch(process.env.SMS_API_URL!, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.SMS_API_KEY}` },
      body: JSON.stringify({ to: m.to, from: process.env.SMS_SENDER_ID ?? 'Always', message: render(t.body, m.params) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`sms_http_${res.status}`);
  };
}

export async function fetchWebhook(url: string, body: string, headers: Record<string, string>) {
  const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`webhook_http_${res.status}`);
}

export function render(text: string, params: Record<string, unknown> = {}): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
}

/** The adapters a deployed API uses: real providers when configured, otherwise log the template id only. */
export function defaultAdapters() {
  return {
    email: process.env.RESEND_API_KEY ? resendEmail() : process.env.SES_ACCESS_KEY_ID ? sesEmail() : logAdapters.email,
    sms: process.env.SMS_API_URL ? httpSms() : logAdapters.sms,
    webhook: process.env.NODE_ENV === 'production' ? fetchWebhook : logAdapters.webhook,
  };
}
