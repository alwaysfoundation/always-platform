import type { Message } from './jobs.js';
import { TEMPLATES } from './templates.js';

/**
 * Production adapters. Each sends only what the message needs:
 * - Email: Resend (transactional API). Staff alerts carry no personal data, only a link to the inbox.
 * - SMS: an Australian SMS provider's HTTP API (e.g. MessageMedia, Mobile Message). Texts to the
 *   person carry the church name and a link, never faith details.
 * - Webhooks: HTTPS POST with HMAC signature and a 10 s timeout.
 */
export function resendEmail() {
  return async (m: Message) => {
    const t = TEMPLATES[m.template] ?? { subject: 'Always', body: 'You have an update in Always.' };
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        // Outbox ids are unique, so a retry never sends twice.
        'idempotency-key': `always-${m.id ?? ''}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [m.to],
        subject: t.subject,
        text: render(t.body, m.params),
        tags: [{ name: 'template', value: m.template.replace(/[^a-zA-Z0-9_-]/g, '_') }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
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
