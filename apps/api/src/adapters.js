import { TEMPLATES } from './templates.js';
import { logAdapters } from './jobs.js';
import { AwsClient } from 'aws4fetch';
/**
 * Production adapters. Each sends only what the message needs:
 * - Email: Amazon SES in an Australian region (Sydney by default), so email addresses are processed
 *   in Australia. Staff alerts carry no personal data, only a link to the inbox.
 * - SMS: an Australian SMS provider's HTTP API (e.g. MessageMedia, Mobile Message). Texts to the
 *   person carry the church name and a link, never faith details.
 * - Webhooks: HTTPS POST with HMAC signature and a 10 s timeout.
 */
/** Australian AWS regions only: Sydney and Melbourne. Personal data must not leave Australia. */
export const AUSTRALIAN_REGIONS = ['ap-southeast-2', 'ap-southeast-4'];
export function sesRegion(env = process.env) {
    const region = env.SES_REGION ?? 'ap-southeast-2';
    if (!AUSTRALIAN_REGIONS.includes(region)) {
        throw new Error(`ses_region_not_australian:${region}`);
    }
    return region;
}
export function sesEmail(env = process.env, fetcher = fetch) {
    const region = sesRegion(env);
    const aws = new AwsClient({
        accessKeyId: env.SES_ACCESS_KEY_ID,
        secretAccessKey: env.SES_SECRET_ACCESS_KEY,
        service: 'ses',
        region,
    });
    const endpoint = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;
    return async (m) => {
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
        if (!res.ok)
            throw new Error(`email_http_${res.status}`);
    };
}
export function httpSms() {
    return async (m) => {
        const t = TEMPLATES[m.template];
        if (!t)
            throw new Error(`unknown_template:${m.template}`);
        const res = await fetch(process.env.SMS_API_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.SMS_API_KEY}` },
            body: JSON.stringify({ to: m.to, from: process.env.SMS_SENDER_ID ?? 'Always', message: render(t.body, m.params) }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok)
            throw new Error(`sms_http_${res.status}`);
    };
}
export async function fetchWebhook(url, body, headers) {
    const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(10_000) });
    if (!res.ok)
        throw new Error(`webhook_http_${res.status}`);
}
export function render(text, params = {}) {
    return text.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
}
/** The adapters a deployed API uses: real providers when configured, otherwise log the template id only. */
export function defaultAdapters() {
    return {
        email: process.env.SES_ACCESS_KEY_ID ? sesEmail() : logAdapters.email,
        sms: process.env.SMS_API_URL ? httpSms() : logAdapters.sms,
        webhook: process.env.NODE_ENV === 'production' ? fetchWebhook : logAdapters.webhook,
    };
}
