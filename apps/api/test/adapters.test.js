import { describe, expect, it } from 'vitest';
import { sesEmail, sesRegion } from '../src/adapters.js';
// Synthetic values only (CLAUDE.md rule 1 and 2): no real addresses or keys.
const env = {
    SES_ACCESS_KEY_ID: 'AKIDEXAMPLE',
    SES_SECRET_ACCESS_KEY: 'example-secret-not-real',
    EMAIL_FROM: 'Always <hello@example.org>',
};
describe('email stays in Australia', () => {
    it('uses Sydney by default and allows Melbourne', () => {
        expect(sesRegion({})).toBe('ap-southeast-2');
        expect(sesRegion({ SES_REGION: 'ap-southeast-4' })).toBe('ap-southeast-4');
    });
    it('refuses any region outside Australia', () => {
        expect(() => sesRegion({ SES_REGION: 'us-east-1' })).toThrow('ses_region_not_australian:us-east-1');
        expect(() => sesEmail({ ...env, SES_REGION: 'ap-northeast-1' })).toThrow(/not_australian/);
    });
    it('sends a signed request to the Sydney SES endpoint', async () => {
        let seen;
        const fake = (async (req) => {
            seen = req;
            return new Response('{}', { status: 200 });
        });
        await sesEmail(env, fake)({ template: 'offer.new', to: 'person@example.org', params: {} });
        expect(seen.url).toBe('https://email.ap-southeast-2.amazonaws.com/v2/email/outbound-emails');
        expect(seen.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/ap-southeast-2\/ses\/aws4_request/);
        const body = await seen.json();
        expect(body.Destination.ToAddresses).toEqual(['person@example.org']);
        expect(body.FromEmailAddress).toBe('Always <hello@example.org>');
    });
    it('keeps the address out of errors', async () => {
        const fake = (async () => new Response('Address person@example.org rejected', { status: 400 }));
        const send = sesEmail(env, fake);
        await expect(send({ template: 'offer.new', to: 'person@example.org' })).rejects.toThrow(/^email_http_400$/);
    });
});
