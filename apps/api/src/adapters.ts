import type { Message } from './jobs.js';
import { TEMPLATES } from './templates.js';

/**
 * Production adapters. All three keep personal data in Australia or send only what
 * the message needs:
 * - Email: Amazon SES in ap-southeast-2 (Sydney). Staff alerts carry no personal data.
 * - SMS: an Australian SMS provider's HTTP API (e.g. MessageMedia, Mobile Message). Confirmation
 *   texts to the person carry the church name and a link, never faith details.
 * - Webhooks: HTTPS POST with HMAC signature and a 10 s timeout.
 */
export function sesEmail() {
  return async (m: Message) => {
    const { SESv2Client, SendEmailCommand } = await import('@aws-sdk/client-sesv2' as string);
    const client = new SESv2Client({ region: process.env.SES_REGION });
    const t = TEMPLATES[m.template] ?? { subject: 'Always', body: 'You have an update in Always.' };
    await client.send(new SendEmailCommand({
      FromEmailAddress: process.env.EMAIL_FROM,
      Destination: { ToAddresses: [m.to] },
      Content: { Simple: { Subject: { Data: t.subject }, Body: { Text: { Data: render(t.body, m.params) } } } },
    }));
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
