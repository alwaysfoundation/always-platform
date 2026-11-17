import type { ConsentRecord, EngineAction, Handoff, Offer, Organisation, PassReason, ResponseRecord } from './types.js';
import { POLICY } from './policy.js';
import { addStaffedMinutes, staffedMinutesBetween } from './staffed-time.js';
import { rankCandidates } from './matching.js';
import { canProcess } from './consent.js';
import { rulesFor } from './minors.js';

/**
 * The handoff engine. Pure functions: given a handoff, the time and the world,
 * return the next handoff and the actions to perform (send alerts, offers, etc.).
 *
 * Two clocks (see "Beating Explorers on seeker handoff"):
 * - each church has POLICY.acceptWindowStaffedMinutes to accept or pass,
 *   at most POLICY.maxSequentialOffers churches in turn;
 * - the whole network has a POLICY.networkCeilingHours ceiling, after which the care team holds the person;
 * - if no church has accepted within POLICY.careHelloStaffedMinutes, the care team sends a human hello.
 */

export interface World {
  response: ResponseRecord;
  consent: ConsentRecord | undefined;
  orgs: Organisation[];
}

export interface Step {
  handoff: Handoff;
  actions: EngineAction[];
}

const HOUR = 3_600_000;

function currentOffer(h: Handoff): Offer | undefined {
  const last = h.offers[h.offers.length - 1];
  return last && last.outcome === 'pending' ? last : undefined;
}

function offeredSet(h: Handoff): Set<string> {
  return new Set(h.offers.map((o) => o.orgId));
}

export function createHandoff(id: string, world: World, now: Date): Step {
  const rules = rulesFor(world.response.ageBand);
  const base: Handoff = {
    id,
    responseId: world.response.id,
    createdAt: now,
    ageBand: world.response.ageBand,
    state: 'routing',
    offers: [],
  };
  if (rules.requiresParentConfirmation && !world.consent?.parentConfirmedAt && world.consent?.party !== 'parent') {
    return { handoff: { ...base, state: 'awaiting_parent' }, actions: [] };
  }
  return route(base, world, now);
}

/** Offer to the next suitable church, or hand to the care team. */
function route(h: Handoff, world: World, now: Date): Step {
  const ceiling = new Date(h.createdAt.getTime() + POLICY.networkCeilingHours * HOUR);
  if (now >= ceiling) return toCare(h, 'network_ceiling');
  if (h.offers.length >= POLICY.maxSequentialOffers) return toCare(h, 'max_offers');

  const candidates = rankCandidates(world.response, world.orgs, now, offeredSet(h));
  for (const c of candidates) {
    const isNextNearby = h.offers.length > 0;
    const decision = canProcess(world.consent, 'connect.church', c.org.id, { isNextNearby: isNextNearby || !world.consent?.recipients.includes(c.org.id) });
    if (!decision.ok) continue;
    let deadline = addStaffedMinutes(now, POLICY.acceptWindowStaffedMinutes);
    if (deadline > ceiling) deadline = ceiling;
    const offer: Offer = { orgId: c.org.id, offeredAt: now, deadline, outcome: 'pending' };
    return { handoff: { ...h, state: 'offered', offers: [...h.offers, offer] }, actions: [{ kind: 'offer', orgId: c.org.id, deadline }] };
  }
  return toCare(h, 'no_match');
}

function toCare(h: Handoff, reason: Extract<EngineAction, { kind: 'care.assign' }>['reason']): Step {
  return { handoff: { ...h, state: 'care_team' }, actions: [{ kind: 'care.assign', reason }] };
}

/** Parent or guardian confirmed: start routing. */
export function parentConfirmed(h: Handoff, world: World, now: Date): Step {
  if (h.state !== 'awaiting_parent') return { handoff: h, actions: [] };
  return route({ ...h, state: 'routing' }, world, now);
}

export function accept(h: Handoff, orgId: string, world: World, now: Date): Step {
  const offer = currentOffer(h);
  if (h.state !== 'offered' || !offer || offer.orgId !== orgId) throw new Error('no_pending_offer_for_org');
  if (now > offer.deadline) throw new Error('offer_expired');
  const decision = canProcess(world.consent, 'connect.church', orgId, { isNextNearby: h.offers.length > 1 || !world.consent?.recipients.includes(orgId) });
  if (!decision.ok) throw new Error(`consent:${decision.reason}`);
  const offers = h.offers.map((o) => (o === offer ? { ...o, outcome: 'accepted' as const, decidedAt: now } : o));
  return { handoff: { ...h, state: 'accepted', offers, acceptedAt: now }, actions: [] };
}

export function pass(h: Handoff, orgId: string, reason: PassReason, world: World, now: Date): Step {
  const offer = currentOffer(h);
  if (h.state !== 'offered' || !offer || offer.orgId !== orgId) throw new Error('no_pending_offer_for_org');
  const offers = h.offers.map((o) => (o === offer ? { ...o, outcome: 'passed' as const, decidedAt: now, passReason: reason } : o));
  return route({ ...h, state: 'routing', offers }, world, now);
}

export function recordFirstContact(h: Handoff, now: Date): Handoff {
  if (h.state !== 'accepted') return h;
  return { ...h, state: 'contacted', firstContactAt: now };
}

export function withdraw(h: Handoff): Handoff {
  return { ...h, state: 'withdrawn' };
}

/**
 * Advance time. Call on a schedule (every minute) for every open handoff.
 * Idempotent: running twice at the same instant gives the same result.
 */
export function tick(h: Handoff, world: World, now: Date): Step {
  const actions: EngineAction[] = [];
  let handoff = h;

  if (world.consent?.withdrawnAt && handoff.state !== 'withdrawn') {
    return { handoff: withdraw(handoff), actions };
  }

  if (handoff.state === 'awaiting_parent') {
    const expiry = new Date(handoff.createdAt.getTime() + POLICY.retention.parentConfirmationDays * 24 * HOUR);
    if (now >= expiry) return { handoff: { ...handoff, state: 'withdrawn' }, actions: [{ kind: 'parent.expired' }] };
    return { handoff, actions };
  }

  // Care team hello: nobody has accepted within the first staffed hour.
  const accepted = handoff.offers.some((o) => o.outcome === 'accepted');
  if (!accepted && !handoff.careHelloAt && ['routing', 'offered', 'care_team'].includes(handoff.state)) {
    if (staffedMinutesBetween(handoff.createdAt, now) >= POLICY.careHelloStaffedMinutes) {
      handoff = { ...handoff, careHelloAt: now };
      actions.push({ kind: 'care.hello' });
    }
  }

  if (handoff.state === 'offered') {
    const offer = currentOffer(handoff)!;
    const ceiling = new Date(handoff.createdAt.getTime() + POLICY.networkCeilingHours * HOUR);
    if (now >= offer.deadline || now >= ceiling) {
      const offers = handoff.offers.map((o) => (o === offer ? { ...o, outcome: 'expired' as const, decidedAt: now } : o));
      actions.push({ kind: 'expire', orgId: offer.orgId });
      const next = route({ ...handoff, state: 'routing', offers }, world, now);
      return { handoff: next.handoff, actions: [...actions, ...next.actions] };
    }
    // Remind once, on the tick where the elapsed staffed time first reaches the reminder mark.
    if (staffedMinutesBetween(offer.offeredAt, now) === POLICY.remindAtStaffedMinutes) {
      actions.push({ kind: 'remind', orgId: offer.orgId });
    }
  }

  if (handoff.state === 'accepted' && handoff.acceptedAt) {
    const due = new Date(handoff.acceptedAt.getTime() + POLICY.firstContactHours * HOUR);
    if (now >= due) {
      const offer = handoff.offers.find((o) => o.outcome === 'accepted')!;
      const offers = handoff.offers.map((o) => (o === offer ? { ...o, outcome: 'returned' as const, decidedAt: now } : o));
      actions.push({ kind: 'first_contact.overdue', orgId: offer.orgId });
      const next = route({ ...handoff, state: 'routing', offers, acceptedAt: undefined }, world, now);
      return { handoff: next.handoff, actions: [...actions, ...next.actions] };
    }
  }

  return { handoff, actions };
}
