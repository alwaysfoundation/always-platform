import { describe, expect, it } from 'vitest';
import { canSync, elvanto, planningCenter, syncToChms } from '../src/index.js';
import { consent, ctx, fakeFetch, handoff, NOW, org, packet } from './fixtures.js';

const auConnector = () => elvanto({ apiKey: 'test-key', accountDomain: 'grace.elvanto.com.au' }, fakeFetch([]).fetcher);

describe('minors run first', () => {
  for (const band of ['under13', '13-14', '15-17'] as const) {
    it(`never syncs a ${band} person, even with full consent`, () => {
      const c = ctx({
        packet: packet({ ageBand: band }),
        consent: consent({ ageBand: band, party: 'parent', parentConfirmedAt: NOW, childAssentAt: NOW }),
        handoff: handoff({ ageBand: band }),
        org: org({ trustLevel: 'verified_youth' }),
      });
      expect(canSync(c, auConnector())).toEqual({ ok: false, reason: 'minor_not_synced' });
    });
  }

  it('refuses when any of the three age bands says minor', () => {
    expect(canSync(ctx({ handoff: handoff({ ageBand: '15-17' }) }), auConnector())).toEqual({ ok: false, reason: 'minor_not_synced' });
    expect(canSync(ctx({ consent: consent({ ageBand: '13-14' }) }), auConnector())).toEqual({ ok: false, reason: 'minor_not_synced' });
  });

  it('treats a missing consent age band as under 13', () => {
    expect(canSync(ctx({ consent: undefined }), auConnector())).toEqual({ ok: false, reason: 'minor_not_synced' });
  });
});

describe('consent travels with the data', () => {
  it('refuses after withdrawal', () => {
    expect(canSync(ctx({ consent: consent({ withdrawnAt: NOW }) }), auConnector())).toEqual({ ok: false, reason: 'consent_withdrawn' });
  });

  it('refuses a church the person did not name', () => {
    expect(canSync(ctx({ consent: consent({ recipients: ['org-other'] }) }), auConnector())).toEqual({ ok: false, reason: 'consent_recipient_not_covered' });
  });

  it('refuses without the connect purpose', () => {
    expect(canSync(ctx({ consent: consent({ purposes: ['resources'] }) }), auConnector())).toEqual({ ok: false, reason: 'consent_purpose_not_granted' });
  });

  it('refuses expired consent', () => {
    expect(canSync(ctx({ consent: consent({ expiresAt: new Date('2026-11-19T06:00:00Z') }) }), auConnector())).toEqual({ ok: false, reason: 'consent_expired' });
  });
});

describe('handoff, trust and residency', () => {
  it('refuses until this church has accepted', () => {
    const pending = handoff({ state: 'offered', offers: [{ ...handoff().offers[0]!, outcome: 'pending' }] });
    expect(canSync(ctx({ handoff: pending }), auConnector())).toEqual({ ok: false, reason: 'not_accepted_by_org' });
  });

  it('refuses another church acting on the handoff', () => {
    expect(canSync(ctx({ org: org({ id: 'org-other' }) }), auConnector())).toEqual({ ok: false, reason: 'not_accepted_by_org' });
  });

  it('refuses a church that is not verified', () => {
    expect(canSync(ctx({ org: org({ trustLevel: 'claimed' }) }), auConnector())).toEqual({ ok: false, reason: 'org_not_verified' });
  });

  it('refuses an Elvanto account outside Australia', () => {
    const us = elvanto({ apiKey: 'k', accountDomain: 'grace.elvanto.com' }, fakeFetch([]).fetcher);
    expect(canSync(ctx(), us)).toEqual({ ok: false, reason: 'data_leaves_australia' });
  });

  it('refuses Planning Center, which keeps data offshore', () => {
    const pc = planningCenter({ auth: { kind: 'oauth', accessToken: 't' } }, fakeFetch([]).fetcher);
    expect(canSync(ctx(), pc)).toEqual({ ok: false, reason: 'data_leaves_australia' });
  });

  it('allows an accepted adult with consent to an Australian Elvanto account', () => {
    expect(canSync(ctx(), auConnector())).toEqual({ ok: true });
  });
});

describe('syncToChms', () => {
  it('makes no network call when the gate refuses', async () => {
    const f = fakeFetch([]);
    const out = await syncToChms(ctx({ packet: packet({ ageBand: '15-17' }) }), elvanto({ apiKey: 'k', accountDomain: 'grace.elvanto.com.au' }, f.fetcher));
    expect(out).toEqual({ ok: false, reason: 'minor_not_synced' });
    expect(f.calls).toHaveLength(0);
  });

  it('creates the person, adds the pathway and reports ids only', async () => {
    const f = fakeFetch([
      { json: { status: 'ok', person: { id: 'elv-person-1', family_id: 1 } } },
      { json: { status: 'ok' } },
    ]);
    const c = elvanto({ apiKey: 'k', accountDomain: 'grace.elvanto.com.au', categoryId: 'cat-new', pathwayGroupId: 'grp-welcome' }, f.fetcher);
    const out = await syncToChms(ctx(), c);
    expect(out).toEqual({ ok: true, result: { externalPersonId: 'elv-person-1', pathway: 'grp-welcome', followUp: 'cat-new' } });
    expect(JSON.stringify(out)).not.toContain('Testy');
  });

  it('does not create the person twice', async () => {
    const f = fakeFetch([]);
    const out = await syncToChms(ctx(), elvanto({ apiKey: 'k', accountDomain: 'grace.elvanto.com.au' }, f.fetcher), 'elv-person-1');
    expect(out).toEqual({ ok: true, result: { externalPersonId: 'elv-person-1' } });
    expect(f.calls).toHaveLength(0);
  });
});
