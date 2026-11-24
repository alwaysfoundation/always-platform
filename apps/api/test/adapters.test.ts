import { describe, expect, it } from 'vitest';
import { resendEmail, sesEmail, sesRegion } from '../src/adapters.js';

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
    let seen: Request | undefined;
    const fake = (async (req: Request) => {
      seen = req;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    await sesEmail(env, fake)({ template: 'offer.new', to: 'person@example.org', params: {} });
    expect(seen!.url).toBe('https://email.ap-southeast-2.amazonaws.com/v2/email/outbound-emails');
    expect(seen!.headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/ap-southeast-2\/ses\/aws4_request/);
    const body = await seen!.json();
    expect(body.Destination.ToAddresses).toEqual(['person@example.org']);
    expect(body.FromEmailAddress).toBe('Always <hello@example.org>');
  });

  it('keeps the address out of errors', async () => {
    const fake = (async () => new Response('Address person@example.org rejected', { status: 400 })) as unknown as typeof fetch;
    const send = sesEmail(env, fake);
    await expect(send({ template: 'offer.new', to: 'person@example.org' })).rejects.toThrow(/^email_http_400$/);
  });
});

describe('email through Resend', () => {
  const renv = { RESEND_API_KEY: 're_example_not_real', EMAIL_FROM: 'Always <hello@example.org>' };
  it('sends the rendered template with the key as a bearer token', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fake = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response('{}', { status: 200 }); }) as unknown as typeof fetch;
    await resendEmail(renv, fake)({ template: 'team.invite', to: 'person@example.org', params: { org: 'Example Church', inviteUrl: 'https://example.org/i' } });
    expect(seen!.url).toBe('https://api.resend.com/emails');
    expect((seen!.init.headers as Record<string, string>).authorization).toBe('Bearer re_example_not_real');
    const body = JSON.parse(String(seen!.init.body));
    expect(body.to).toEqual(['person@example.org']);
    expect(body.text).toContain('Example Church');
    expect(body.text).toContain('https://example.org/i');
  });

  it('keeps the address out of errors', async () => {
    const fake = (async () => new Response('person@example.org rejected', { status: 422 })) as unknown as typeof fetch;
    await expect(resendEmail(renv, fake)({ template: 'offer.new', to: 'person@example.org' })).rejects.toThrow(/^email_http_422$/);
  });
});
