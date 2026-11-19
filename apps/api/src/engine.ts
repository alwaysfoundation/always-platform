import {
  createHandoff,
  accept as coreAccept,
  pass as corePass,
  parentConfirmed as coreParentConfirmed,
  recordFirstContact,
  tick as coreTick,
  withdraw as coreWithdraw,
  type ConsentRecord,
  type EngineAction,
  type Handoff,
  type Organisation,
  type PassReason,
  type ResponseRecord,
  type Offer,
  type World,
} from '@always/core';
import type { Tx } from '@always/db';
import { audit } from './audit.js';

/**
 * The bridge between the pure handoff engine (packages/core) and the database.
 * Every state change goes: load world -> core function -> save handoff -> write outbox.
 * All of it runs in one transaction with the handoff row locked.
 */

const SEARCH_RADIUS_DEG = 0.6; // ~60 km pre-filter; the engine applies each church's own radius

type Row = Record<string, any>;

function toResponse(r: Row): ResponseRecord {
  return {
    id: r.id,
    createdAt: new Date(r.created_at),
    ageBand: r.age_band,
    step: r.step,
    location: { lat: Number(r.geo_lat ?? 0), lng: Number(r.geo_lng ?? 0) },
    language: r.language ?? undefined,
  };
}

function toConsent(c: Row | undefined): ConsentRecord | undefined {
  if (!c) return undefined;
  return {
    id: c.id,
    responseId: c.response_id,
    purposes: c.purposes,
    recipients: c.recipients ?? [],
    allowNextNearby: c.allow_next_nearby,
    wordingVersion: c.wording_version,
    party: c.party,
    ageBand: c.age_band,
    collectedAt: new Date(c.collected_at),
    withdrawnAt: c.withdrawn_at ? new Date(c.withdrawn_at) : undefined,
    parentConfirmedAt: c.parent_confirmed_at ? new Date(c.parent_confirmed_at) : undefined,
    childAssentAt: c.child_assent_at ? new Date(c.child_assent_at) : undefined,
    expiresAt: c.expires_at ? new Date(c.expires_at) : undefined,
  };
}

function toOrg(o: Row): Organisation {
  return {
    id: o.id,
    displayName: o.display_name,
    trustLevel: o.trust_level,
    location: { lat: Number(o.geo_lat), lng: Number(o.geo_lng) },
    areaRadiusKm: Number(o.area_radius_km ?? 8),
    offers: o.offers ?? [],
    languages: o.languages ?? ['English'],
    monthlyCapacity: Number(o.monthly_limit ?? 10),
    receivedThisMonth: Number(o.received_this_month ?? 0),
    pausedUntil: o.paused_until ? new Date(o.paused_until) : undefined,
    lastConfirmedAt: new Date(o.last_confirmed_at ?? 0),
    medianAcceptMinutes: o.median_accept_minutes ?? undefined,
    currentOpenOffers: Number(o.open_offers ?? 0),
  };
}

function toHandoff(h: Row, offers: Row[]): Handoff {
  return {
    id: h.id,
    responseId: h.response_id,
    createdAt: new Date(h.created_at),
    ageBand: h.age_band,
    state: h.state,
    careHelloAt: h.care_hello_at ? new Date(h.care_hello_at) : undefined,
    acceptedAt: h.accepted_at ? new Date(h.accepted_at) : undefined,
    firstContactAt: h.first_contact_at ? new Date(h.first_contact_at) : undefined,
    personConfirmedConnectedAt: h.person_confirmed_connected_at ? new Date(h.person_confirmed_connected_at) : undefined,
    companionNamed: h.companion_named ?? undefined,
    offers: offers
      .sort((a, b) => a.seq - b.seq)
      .map(
        (o): Offer => ({
          orgId: o.org_id,
          offeredAt: new Date(o.offered_at),
          deadline: new Date(o.deadline),
          outcome: o.outcome,
          decidedAt: o.decided_at ? new Date(o.decided_at) : undefined,
          passReason: o.pass_reason ?? undefined,
        }),
      ),
  };
}

export async function loadWorld(tx: Tx, responseId: string, now: Date): Promise<World> {
  const [r] = await tx`select * from response where id = ${responseId}`;
  if (!r) throw new Error('response_not_found');
  const [c] = await tx`select * from consent where response_id = ${responseId} order by collected_at desc limit 1`;
  const lat = Number(r.geo_lat ?? 0);
  const lng = Number(r.geo_lng ?? 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const orgs = await tx`
    select o.id, o.display_name, o.trust_level, o.geo_lat, o.geo_lng, o.last_confirmed_at, o.median_accept_minutes,
           cap.area_radius_km, cap.monthly_limit, cap.languages, cap.paused_until,
           coalesce((select array_agg(oc.category) from offer_category oc where oc.org_id = o.id and oc.active), '{}') as offers,
           (select count(*) from handoff_offer ho where ho.org_id = o.id and ho.offered_at >= ${monthStart} and ho.outcome in ('accepted','pending')) as received_this_month,
           (select count(*) from handoff_offer ho where ho.org_id = o.id and ho.outcome = 'pending') as open_offers
    from organisation o
    left join capacity cap on cap.org_id = o.id
    where o.trust_level in ('verified', 'verified_youth')
      and not o.is_care_team
      and o.geo_lat between ${lat - SEARCH_RADIUS_DEG} and ${lat + SEARCH_RADIUS_DEG}
      and o.geo_lng between ${lng - SEARCH_RADIUS_DEG} and ${lng + SEARCH_RADIUS_DEG}`;
  return { response: toResponse(r), consent: toConsent(c), orgs: orgs.map(toOrg) };
}

export async function loadHandoff(tx: Tx, handoffId: string): Promise<Handoff> {
  const [h] = await tx`select * from handoff where id = ${handoffId} for update`;
  if (!h) throw new Error('handoff_not_found');
  const offers = await tx`select * from handoff_offer where handoff_id = ${handoffId}`;
  return toHandoff(h, offers);
}

const OPEN = new Set(['awaiting_parent', 'routing', 'offered', 'accepted']);

export async function saveHandoff(tx: Tx, h: Handoff, now: Date): Promise<void> {
  const nextCheck = OPEN.has(h.state) ? new Date(now.getTime() + 60_000) : null;
  await tx`
    insert into handoff (id, response_id, state, age_band, created_at, care_hello_at, accepted_at, first_contact_at,
                         person_confirmed_connected_at, companion_named, next_check_at)
    values (${h.id}, ${h.responseId}, ${h.state}, ${h.ageBand}, ${h.createdAt}, ${h.careHelloAt ?? null}, ${h.acceptedAt ?? null},
            ${h.firstContactAt ?? null}, ${h.personConfirmedConnectedAt ?? null}, ${h.companionNamed ?? null}, ${nextCheck})
    on conflict (id) do update set state = excluded.state, care_hello_at = excluded.care_hello_at, accepted_at = excluded.accepted_at,
      first_contact_at = excluded.first_contact_at, person_confirmed_connected_at = excluded.person_confirmed_connected_at,
      companion_named = excluded.companion_named, next_check_at = excluded.next_check_at`;
  for (const [i, o] of h.offers.entries()) {
    await tx`
      insert into handoff_offer (handoff_id, seq, org_id, offered_at, deadline, outcome, decided_at, pass_reason)
      values (${h.id}, ${i + 1}, ${o.orgId}, ${o.offeredAt}, ${o.deadline}, ${o.outcome}, ${o.decidedAt ?? null}, ${o.passReason ?? null})
      on conflict (handoff_id, seq) do update set outcome = excluded.outcome, decided_at = excluded.decided_at, pass_reason = excluded.pass_reason`;
  }
}

async function careTeamId(tx: Tx): Promise<string | null> {
  const [c] = await tx`select id from organisation where is_care_team limit 1`;
  return c?.id ?? null;
}

/** Turn engine actions into outbox rows. Payloads carry ids only, never personal data. */
/** Outbox rows use the engine's clock, so timers and tests agree on when a message is due. */
export async function enqueue(tx: Tx, h: Handoff, actions: EngineAction[], now: Date): Promise<void> {
  for (const a of actions) {
    switch (a.kind) {
      case 'offer':
        await tx`insert into outbox (channel, template, org_id, response_id, not_before) values ('email', 'offer.new', ${a.orgId}, ${h.responseId}, ${now})`;
        await tx`insert into outbox (channel, template, org_id, response_id, not_before) values ('webhook', 'always.offer.created', ${a.orgId}, ${h.responseId}, ${now})`;
        break;
      case 'remind':
        await tx`insert into outbox (channel, template, org_id, response_id, not_before) values ('email', 'offer.reminder', ${a.orgId}, ${h.responseId}, ${now})`;
        break;
      case 'expire':
        await tx`insert into outbox (channel, template, org_id, response_id, not_before) values ('email', 'offer.expired', ${a.orgId}, ${h.responseId}, ${now})`;
        break;
      case 'first_contact.overdue':
        await tx`insert into outbox (channel, template, org_id, response_id, not_before) values ('email', 'offer.returned', ${a.orgId}, ${h.responseId}, ${now})`;
        break;
      case 'care.hello':
      case 'care.assign': {
        const care = await careTeamId(tx);
        if (care) await tx`insert into outbox (channel, template, org_id, response_id, not_before) values ('email', ${a.kind}, ${care}, ${h.responseId}, ${now})`;
        break;
      }
      case 'parent.expired':
        break;
    }
  }
}

async function commit(tx: Tx, before: Handoff | null, step: { handoff: Handoff; actions: EngineAction[] }, now: Date) {
  await saveHandoff(tx, step.handoff, now);
  await enqueue(tx, step.handoff, step.actions, now);
  if (!before || before.state !== step.handoff.state) {
    await tx`insert into outbox (channel, template, response_id, not_before) values ('webhook', ${'always.handoff.' + step.handoff.state}, ${step.handoff.responseId}, ${now})`;
  }
  return step.handoff;
}

export async function start(tx: Tx, handoffId: string, responseId: string, now: Date): Promise<Handoff> {
  const world = await loadWorld(tx, responseId, now);
  return commit(tx, null, createHandoff(handoffId, world, now), now);
}

export async function accept(tx: Tx, handoffId: string, orgId: string, actor: string | undefined, now: Date): Promise<Handoff> {
  const h = await loadHandoff(tx, handoffId);
  const world = await loadWorld(tx, h.responseId, now);
  const step = { handoff: coreAccept(h, orgId, world, now).handoff, actions: [] as EngineAction[] };
  const out = await commit(tx, h, step, now);
  // Active retention once a church has the person.
  await tx`update response set delete_after = ${new Date(now.getTime() + 365 * 86_400_000)} where id = ${h.responseId}`;
  await tx`insert into outbox (channel, template, org_id, response_id, not_before) values ('sms', 'person.church_will_contact', ${orgId}, ${h.responseId}, ${now})`;
  await audit(tx, { actor, orgId, action: 'handoff.accept', subject: `handoff:${handoffId}` });
  return out;
}

export async function pass(tx: Tx, handoffId: string, orgId: string, reason: PassReason, actor: string | undefined, now: Date): Promise<Handoff> {
  const h = await loadHandoff(tx, handoffId);
  const world = await loadWorld(tx, h.responseId, now);
  const out = await commit(tx, h, corePass(h, orgId, reason, world, now), now);
  await audit(tx, { actor, orgId, action: 'handoff.pass', subject: `handoff:${handoffId}`, reason });
  return out;
}

export async function contacted(tx: Tx, handoffId: string, orgId: string, actor: string | undefined, now: Date): Promise<Handoff> {
  const h = await loadHandoff(tx, handoffId);
  const holder = h.offers.find((o) => o.outcome === 'accepted');
  if (!holder || holder.orgId !== orgId) throw new Error('not_holder');
  const out = await commit(tx, h, { handoff: recordFirstContact(h, now), actions: [] }, now);
  await audit(tx, { actor, orgId, action: 'handoff.first_contact', subject: `handoff:${handoffId}` });
  return out;
}

export async function parentConfirmed(tx: Tx, handoffId: string, now: Date): Promise<Handoff> {
  const h = await loadHandoff(tx, handoffId);
  await tx`update consent set parent_confirmed_at = ${now} where response_id = ${h.responseId} and parent_confirmed_at is null`;
  const world = await loadWorld(tx, h.responseId, now);
  return commit(tx, h, coreParentConfirmed(h, world, now), now);
}

export async function withdraw(tx: Tx, handoffId: string, now: Date): Promise<Handoff> {
  const h = await loadHandoff(tx, handoffId);
  await tx`update consent set withdrawn_at = ${now} where response_id = ${h.responseId} and withdrawn_at is null`;
  // Deleted within 7 days (the retention job runs nightly; we schedule now).
  await tx`update response set delete_after = ${now} where id = ${h.responseId}`;
  await tx`update handoff_offer set outcome = 'returned', decided_at = ${now} where handoff_id = ${handoffId} and outcome = 'pending'`;
  const out = await commit(tx, h, { handoff: coreWithdraw(h), actions: [] }, now);
  await audit(tx, { action: 'person.withdraw', subject: `handoff:${handoffId}` });
  return out;
}

export async function confirmConnected(tx: Tx, handoffId: string, companion: boolean | undefined, now: Date): Promise<Handoff> {
  const h = await loadHandoff(tx, handoffId);
  if (!['accepted', 'contacted', 'care_team'].includes(h.state)) throw new Error('not_connectable');
  const next: Handoff = { ...h, state: 'closed', personConfirmedConnectedAt: now, companionNamed: companion ?? h.companionNamed };
  return commit(tx, h, { handoff: next, actions: [] }, now);
}

/** Advance one handoff in time. Called by the scheduler for every handoff that is due. */
export async function tickOne(tx: Tx, handoffId: string, now: Date): Promise<Handoff> {
  const h = await loadHandoff(tx, handoffId);
  if (!OPEN.has(h.state)) return h;
  const world = await loadWorld(tx, h.responseId, now);
  return commit(tx, h, coreTick(h, world, now), now);
}
