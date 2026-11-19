import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { buildConsent, verifyWebhook, AlwaysClient } from '@always/sdk';

describe('consent primitive', () => {
  it('always includes connect.church and forces parent consent under 13', () => {
    const c = buildConsent({ ageBand: 'under13', connect: true, resources: true });
    expect(c.party).toBe('parent');
    expect(c.purposes).toEqual(['connect.church']); // no resources for minors
  });
  it('refuses to build consent without agreement to connect', () => {
    expect(() => buildConsent({ ageBand: '18+', connect: false })).toThrow();
  });
});

describe('webhooks', () => {
  it('verifies a valid signature and rejects replays', async () => {
    const body = '{"type":"always.offer.created"}';
    const ts = '1800000000';
    const sig = 'v1=' + createHmac('sha256', 's3cret').update(`${ts}.${body}`).digest('hex');
    expect(await verifyWebhook({ secret: 's3cret', body, timestamp: ts, signature: sig, now: 1800000010 })).toBe(true);
    expect(await verifyWebhook({ secret: 's3cret', body, timestamp: ts, signature: sig, now: 1800001000 })).toBe(false);
    expect(await verifyWebhook({ secret: 'wrong', body, timestamp: ts, signature: sig, now: 1800000010 })).toBe(false);
  });
});

describe('client', () => {
  it('sends the token and org headers and surfaces API errors', async () => {
    const calls: any[] = [];
    const fake = (async (url: string, init: any) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ error: 'no_pending_offer_for_org' }), { status: 409 });
    }) as unknown as typeof fetch;
    const c = new AlwaysClient({ baseUrl: 'https://api.test', token: 'alw_test_x', org: 'org-1', fetch: fake });
    await expect(c.handoffs.accept('h1')).rejects.toThrow('409 no_pending_offer_for_org');
    expect(calls[0].init.headers.authorization).toBe('Bearer alw_test_x');
    expect(calls[0].url).toBe('https://api.test/v1/handoffs/h1/accept');
  });
});

describe('church feed', () => {
  it('builds the feed query and sends the app key', async () => {
    const calls: any[] = [];
    const fake = (async (url: string, init: any) => { calls.push({ url, init }); return new Response(JSON.stringify({ items: [], licence: 'x' }), { status: 200 }); }) as any;
    const c = new AlwaysClient({ appKey: 'alk_test_abc', fetch: fake, baseUrl: 'https://api.test' });
    await c.feed.churches({ postcode: '2150', welcoming: true, step: 'youth' });
    expect(calls[0].url).toBe('https://api.test/v1/feed/churches?postcode=2150&welcoming=true&step=youth');
    expect(calls[0].init.headers['x-always-key']).toBe('alk_test_abc');
    await c.feed.verify('hope church');
    expect(calls[1].url).toBe('https://api.test/v1/verify/hope%20church');
  });
});
