import { describe, expect, it } from 'vitest';
import { accept, createHandoff, parentConfirmed, pass, recordFirstContact, tick, type World } from '../src/handoff.js';
import { consent, org, response, SYD_8PM, hours, minutes } from './fixtures.js';

// SYD_8PM is a staffed hour (8am-9pm Sydney). 8am Sydney the next day is 2026-11-17T21:00Z.
const world = (over: Partial<World> = {}): World => ({
  response: response({ createdAt: SYD_8PM }),
  consent: consent(),
  orgs: [org('a', { medianAcceptMinutes: 10 }), org('b', { medianAcceptMinutes: 30 }), org('c', { medianAcceptMinutes: 60 })],
  ...over,
});

describe('handoff engine', () => {
  it('offers the best match straight away', () => {
    const s = createHandoff('h1', world(), SYD_8PM);
    expect(s.handoff.state).toBe('offered');
    expect(s.actions[0]).toMatchObject({ kind: 'offer', orgId: 'a' });
  });

  it('holds under-15s until a parent confirms', () => {
    const w = world({ response: response({ createdAt: SYD_8PM, ageBand: '13-14', step: 'youth' }), consent: consent({ ageBand: '13-14' }), orgs: [org('y', { offers: ['youth'], trustLevel: 'verified_youth' })] });
    const s = createHandoff('h2', w, SYD_8PM);
    expect(s.handoff.state).toBe('awaiting_parent');
    const w2 = { ...w, consent: { ...w.consent!, parentConfirmedAt: minutes(SYD_8PM, 10) } };
    const s2 = parentConfirmed(s.handoff, w2, minutes(SYD_8PM, 10));
    expect(s2.handoff.state).toBe('offered');
  });

  it('expires the parent request after 7 days', () => {
    const w = world({ response: response({ createdAt: SYD_8PM, ageBand: '13-14', step: 'youth' }), consent: consent({ ageBand: '13-14' }) });
    const s = createHandoff('h3', w, SYD_8PM);
    const t = tick(s.handoff, w, hours(SYD_8PM, 24 * 7));
    expect(t.handoff.state).toBe('withdrawn');
    expect(t.actions).toContainEqual({ kind: 'parent.expired' });
  });

  it('re-offers to the next church when the first passes', () => {
    const w = world();
    const s = createHandoff('h4', w, SYD_8PM);
    const p = pass(s.handoff, 'a', 'capacity', w, minutes(SYD_8PM, 5));
    expect(p.handoff.state).toBe('offered');
    expect(p.actions[0]).toMatchObject({ kind: 'offer', orgId: 'b' });
  });

  it('sends to the care team after two churches, not a third', () => {
    const w = world();
    let h = createHandoff('h5', w, SYD_8PM).handoff;
    h = pass(h, 'a', 'capacity', w, minutes(SYD_8PM, 5)).handoff;
    const s = pass(h, 'b', 'language', w, minutes(SYD_8PM, 10));
    expect(s.handoff.state).toBe('care_team');
    expect(s.actions).toContainEqual({ kind: 'care.assign', reason: 'max_offers' });
  });

  it('sends a care-team hello after one staffed hour without acceptance', () => {
    const w = world();
    const h = createHandoff('h6', w, SYD_8PM).handoff;
    const t = tick(h, w, minutes(SYD_8PM, 60));
    expect(t.actions).toContainEqual({ kind: 'care.hello' });
    expect(tick(t.handoff, w, minutes(SYD_8PM, 61)).actions).not.toContainEqual({ kind: 'care.hello' });
  });

  it('expires an offer after 2 staffed hours, pausing overnight', () => {
    const w = world();
    const h = createHandoff('h7', w, SYD_8PM).handoff;
    // 8pm offer: 60 staffed minutes tonight, then 60 from 8am, so it is still live at 8:30am
    expect(tick(h, w, new Date('2026-11-17T21:30:00Z')).handoff.state).toBe('offered');
    const t = tick(h, w, new Date('2026-11-17T22:00:00Z'));
    expect(t.actions).toContainEqual({ kind: 'expire', orgId: 'a' });
    expect(t.handoff.offers.at(-1)).toMatchObject({ orgId: 'b', outcome: 'pending' });
  });

  it('never lets anyone wait past the 48-hour ceiling', () => {
    const w = world();
    const h = createHandoff('h8', w, SYD_8PM).handoff;
    const t = tick(h, w, hours(SYD_8PM, 48));
    expect(['care_team', 'offered']).toContain(t.handoff.state);
    const t2 = tick(t.handoff, w, hours(SYD_8PM, 48));
    expect(t2.handoff.state).toBe('care_team');
  });

  it('returns the person to routing if first contact is overdue', () => {
    const w = world();
    let h = createHandoff('h9', w, SYD_8PM).handoff;
    h = accept(h, 'a', w, minutes(SYD_8PM, 7)).handoff;
    const t = tick(h, w, hours(minutes(SYD_8PM, 7), 24));
    expect(t.actions).toContainEqual({ kind: 'first_contact.overdue', orgId: 'a' });
    expect(t.handoff.state).toBe('offered');
  });

  it('keeps the person with the church once contacted', () => {
    const w = world();
    let h = createHandoff('h10', w, SYD_8PM).handoff;
    h = accept(h, 'a', w, minutes(SYD_8PM, 7)).handoff;
    h = recordFirstContact(h, minutes(SYD_8PM, 9));
    expect(tick(h, w, hours(SYD_8PM, 30)).handoff.state).toBe('contacted');
  });

  it('stops everything when consent is withdrawn', () => {
    const w = world();
    const h = createHandoff('h11', w, SYD_8PM).handoff;
    const t = tick(h, { ...w, consent: { ...w.consent!, withdrawnAt: minutes(SYD_8PM, 3) } }, minutes(SYD_8PM, 4));
    expect(t.handoff.state).toBe('withdrawn');
  });

  it('refuses acceptance by a church that does not hold the offer', () => {
    const w = world();
    const h = createHandoff('h12', w, SYD_8PM).handoff;
    expect(() => accept(h, 'b', w, minutes(SYD_8PM, 1))).toThrow('no_pending_offer_for_org');
  });
});
