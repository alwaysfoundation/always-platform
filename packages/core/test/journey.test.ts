import { describe, it, expect } from 'vitest';
import { canLinkJourney, normaliseMobile, journeyView, withhold, withdrawConsent, type ConsentRecord } from '../src/index.js';

const NOW = new Date('2026-11-20T00:00:00Z');
const consent = (over: Partial<ConsentRecord> = {}): ConsentRecord => ({
  id: 'c1', responseId: 'r1', purposes: ['connect.church', 'share.journey'], recipients: [], allowNextNearby: true,
  wordingVersion: 'v1', party: 'self', ageBand: '18+', collectedAt: new Date('2026-11-01T00:00:00Z'), ...over,
});

describe('journeys across ministries', () => {
  it('links an adult who said yes to sharing their journey', () => {
    expect(canLinkJourney(consent(), NOW)).toEqual({ ok: true });
  });

  it('never links anyone under 18, even with the purpose granted', () => {
    for (const ageBand of ['under13', '13-14', '15-17'] as const) {
      expect(canLinkJourney(consent({ ageBand, party: 'parent', parentConfirmedAt: NOW, childAssentAt: NOW }), NOW)).toEqual({ ok: false, reason: 'minors_never_linked' });
    }
  });

  it('needs its own consent, separate from being introduced to a church', () => {
    expect(canLinkJourney(consent({ purposes: ['connect.church'] }), NOW)).toEqual({ ok: false, reason: 'purpose_not_granted' });
  });

  it('stops linking once consent is withdrawn or lapses', () => {
    expect(canLinkJourney(withdrawConsent(consent(), NOW), NOW).ok).toBe(false);
    expect(canLinkJourney(consent({ collectedAt: new Date('2025-01-01T00:00:00Z') }), NOW)).toEqual({ ok: false, reason: 'expired' });
    expect(canLinkJourney(undefined, NOW).ok).toBe(false);
  });

  it('normalises Australian mobiles so the same number links the same way', () => {
    expect(normaliseMobile('0400 000 000')).toBe('+61400000000');
    expect(normaliseMobile('+61 400-000-000')).toBe('+61400000000');
    expect(normaliseMobile('61400000000')).toBe('+61400000000');
    expect(normaliseMobile('02 9999 9999')).toBeNull();
  });

  it('shows only the milestone and month, never exact dates or other ministries', () => {
    const v = journeyView([
      { milestone: 'connected', at: new Date('2026-03-20T03:00:00Z') },
      { milestone: 'responded', at: new Date('2026-02-10T03:00:00Z') },
      { milestone: 'responded', at: new Date('2026-02-11T03:00:00Z') },
      { milestone: 'baptised', at: new Date('2026-04-02T03:00:00Z'), byViewer: true },
    ]);
    expect(v.map((e) => e.milestone)).toEqual(['responded', 'connected', 'baptised']);
    expect(v[0]).toEqual({ milestone: 'responded', label: 'Said yes to a next step', month: '2026-02', byYou: false });
    expect(Object.keys(v[0]!)).toEqual(['milestone', 'label', 'month', 'byYou']);
  });

  it('withholds small numbers', () => {
    expect(withhold(9, 10)).toBeNull();
    expect(withhold(10, 10)).toBe(10);
  });
});
