import { describe, expect, it } from 'vitest';
import { canProcess, consentExpiresAt, withdrawConsent as withdraw } from '../src/consent.js';
import { rulesFor, lowerBand } from '../src/minors.js';
import { rankCandidates, exclusionReason } from '../src/matching.js';
import { retentionPlan, suppress } from '../src/retention.js';
import { followUpAdvice, contactAllowedNow } from '../src/followup.js';
import { isStaffed, staffedMinutesBetween, addStaffedMinutes } from '../src/staffed-time.js';
import { consent, org, response, SYD_8PM, hours, minutes } from './fixtures.js';

describe('minors rules', () => {
  it('treats a missing age band as under 13', () => {
    expect(rulesFor(undefined).collectOwnDetails).toBe(false);
  });
  it('requires a parent for under 15 and youth partners for all minors', () => {
    expect(rulesFor('13-14').requiresParentConfirmation).toBe(true);
    expect(rulesFor('15-17').requiresParentConfirmation).toBe(false);
    expect(rulesFor('15-17').youthPartnersOnly).toBe(true);
    expect(rulesFor('15-17').aiAllowed).toBe(false);
  });
  it('takes the lower band when in doubt', () => {
    expect(lowerBand('18+', '15-17')).toBe('15-17');
  });
});

const NOW = new Date('2026-11-18T09:00:00Z');

describe('consent gate', () => {
  it('fails closed without a record', () => {
    expect(canProcess(undefined, 'connect.church', 'a', { now: NOW })).toEqual({ ok: false, reason: 'no_consent_record' });
  });
  it('allows the named church', () => {
    expect(canProcess(consent(), 'connect.church', 'a', { now: NOW }).ok).toBe(true);
  });
  it('refuses a purpose that was not granted', () => {
    expect(canProcess(consent(), 'notify.sender', null, { now: NOW })).toEqual({ ok: false, reason: 'purpose_not_granted' });
  });
  it('allows the next nearby church only if the person agreed', () => {
    expect(canProcess(consent(), 'connect.church', 'b', { isNextNearby: true, now: NOW }).ok).toBe(true);
    expect(canProcess(consent({ allowNextNearby: false }), 'connect.church', 'b', { isNextNearby: true, now: NOW }).ok).toBe(false);
  });
  it('refuses after withdrawal', () => {
    expect(canProcess(withdraw(consent(), new Date()), 'connect.church', 'a', { now: NOW })).toEqual({ ok: false, reason: 'withdrawn' });
  });
  it('requires parent confirmation for a 13-14 year old', () => {
    const c = consent({ ageBand: '13-14', childAssentAt: NOW });
    expect(canProcess(c, 'connect.church', 'a', { now: NOW })).toEqual({ ok: false, reason: 'parent_confirmation_required' });
    expect(canProcess({ ...c, parentConfirmedAt: new Date() }, 'connect.church', 'a', { now: NOW }).ok).toBe(true);
  });
});

describe('child assent (under 15)', () => {
  it('requires the child to agree as well as the parent', () => {
    expect(rulesFor('under13').requiresChildAssent).toBe(true);
    expect(rulesFor('13-14').requiresChildAssent).toBe(true);
    expect(rulesFor('15-17').requiresChildAssent).toBe(false);
    expect(rulesFor('18+').requiresChildAssent).toBe(false);
  });
  it('refuses a parent-given consent without the child agreeing', () => {
    const c = consent({ ageBand: 'under13', party: 'parent' });
    expect(canProcess(c, 'connect.church', 'a', { now: NOW })).toEqual({ ok: false, reason: 'child_assent_required' });
    expect(canProcess({ ...c, childAssentAt: NOW }, 'connect.church', 'a', { now: NOW }).ok).toBe(true);
  });
  it('still needs the parent when the child has agreed', () => {
    const c = consent({ ageBand: '13-14', childAssentAt: NOW });
    expect(canProcess(c, 'connect.church', 'a', { now: NOW })).toEqual({ ok: false, reason: 'parent_confirmation_required' });
  });
  it('does not ask 15-17 year olds for separate assent', () => {
    expect(canProcess(consent({ ageBand: '15-17' }), 'connect.church', 'a', { now: NOW }).ok).toBe(true);
  });
});

describe('12-month consent', () => {
  it('lapses 12 months after it was given', () => {
    const c = consent({ collectedAt: new Date('2026-01-31T00:00:00Z') });
    expect(consentExpiresAt(c).toISOString()).toBe('2027-01-31T00:00:00.000Z');
    expect(canProcess(c, 'connect.church', 'a', { now: new Date('2027-01-30T23:59:59Z') }).ok).toBe(true);
    expect(canProcess(c, 'connect.church', 'a', { now: new Date('2027-01-31T00:00:00Z') })).toEqual({ ok: false, reason: 'expired' });
  });
  it('honours a renewed expiry date', () => {
    const c = consent({ collectedAt: new Date('2025-01-01T00:00:00Z'), expiresAt: new Date('2027-06-01T00:00:00Z') });
    expect(canProcess(c, 'connect.church', 'a', { now: NOW }).ok).toBe(true);
  });
  it('checks withdrawal before expiry', () => {
    const c = withdraw(consent({ collectedAt: new Date('2020-01-01T00:00:00Z') }), NOW);
    expect(canProcess(c, 'connect.church', 'a', { now: NOW })).toEqual({ ok: false, reason: 'withdrawn' });
  });
});

describe('matching', () => {
  const now = new Date('2026-11-17T09:00:00Z');
  it('excludes unverified, paused, full, stale and out-of-area churches', () => {
    const r = response();
    expect(exclusionReason(org('x', { trustLevel: 'claimed' }), r, now, new Set())).toBe('not_verified');
    expect(exclusionReason(org('x', { pausedUntil: hours(now, 24) }), r, now, new Set())).toBe('paused');
    expect(exclusionReason(org('x', { receivedThisMonth: 10 }), r, now, new Set())).toBe('at_capacity');
    expect(exclusionReason(org('x', { lastConfirmedAt: new Date('2026-06-01T00:00:00Z') }), r, now, new Set())).toBe('stale_profile');
    expect(exclusionReason(org('x', { location: { lat: -33.87, lng: 151.21 } }), r, now, new Set())).toBe('out_of_area');
  });
  it('sends minors only to verified youth partners', () => {
    const r = response({ ageBand: '15-17', step: 'youth' });
    expect(exclusionReason(org('x', { offers: ['youth'] }), r, now, new Set())).toBe('not_youth_verified');
    expect(exclusionReason(org('y', { offers: ['youth'], trustLevel: 'verified_youth' }), r, now, new Set())).toBeNull();
  });
  it('ranks nearby faster churches first', () => {
    const r = response();
    const ranked = rankCandidates(r, [org('slow', { medianAcceptMinutes: 300 }), org('fast', { medianAcceptMinutes: 20 })], now);
    expect(ranked.map((c) => c.org.id)).toEqual(['fast', 'slow']);
  });
});

describe('staffed hours (8am to 9pm Sydney)', () => {
  it('knows 8pm is staffed and 10pm is not', () => {
    expect(isStaffed(SYD_8PM)).toBe(true);
    expect(isStaffed(hours(SYD_8PM, 2))).toBe(false);
  });
  it('pauses the clock overnight', () => {
    // 8pm + 120 staffed minutes = 60 tonight (to 9pm) + 60 tomorrow from 8am = 9am next day
    const due = addStaffedMinutes(SYD_8PM, 120);
    expect(due.toISOString()).toBe('2026-11-17T22:00:00.000Z');
    expect(staffedMinutesBetween(SYD_8PM, minutes(SYD_8PM, 30))).toBe(30);
  });
});

describe('follow-up persistence', () => {
  const accepted = SYD_8PM;
  it('asks for a first attempt straight away', () => {
    expect(followUpAdvice([], accepted, accepted).reason).toBe('first_attempt_due');
  });
  it('schedules a second attempt 8 hours later if there is no reply', () => {
    const a = followUpAdvice([{ kind: 'text', at: accepted }], accepted, minutes(accepted, 5));
    expect(a.reason).toBe('second_attempt_window');
    expect(a.nextAttemptAt?.toISOString()).toBe(hours(accepted, 8).toISOString());
  });
  it('stops once the person replies', () => {
    expect(followUpAdvice([{ kind: 'text', at: accepted }, { kind: 'reply_received', at: minutes(accepted, 9) }], accepted, hours(accepted, 1)).nextAttemptAt).toBeNull();
  });
  it('limits contact hours for minors', () => {
    expect(contactAllowedNow('15-17', 21)).toBe(false);
    expect(contactAllowedNow('18+', 21)).toBe(true);
  });
});

describe('retention', () => {
  const created = new Date('2026-11-17T00:00:00Z');
  it('deletes unreceived adults at 30 days and minors at 14', () => {
    expect(retentionPlan({ ageBand: '18+', createdAt: created, state: 'routing' }).deleteAt.toISOString()).toBe('2026-12-17T00:00:00.000Z');
    expect(retentionPlan({ ageBand: '15-17', createdAt: created, state: 'routing' }).deleteAt.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });
  it('deletes within 7 days of withdrawal', () => {
    expect(retentionPlan({ ageBand: '18+', createdAt: created, state: 'contacted', acceptedAt: created, withdrawnAt: created }).deleteAt.toISOString()).toBe('2026-11-24T00:00:00.000Z');
  });
  it('suppresses small groups', () => {
    expect(suppress(9, false)).toBeNull();
    expect(suppress(19, true)).toBeNull();
    expect(suppress(20, true)).toBe(20);
  });
});
