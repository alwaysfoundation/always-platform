import { createHmac, timingSafeEqual } from 'node:crypto';
import { basicAuth, IntegrationError, requestJson } from './http.js';
import type { ChmsConnector, Fetcher, HandoffPacket } from './types.js';

export type PlanningCenterAuth = { kind: 'token'; appId: string; secret: string } | { kind: 'oauth'; accessToken: string };

export interface PlanningCenterSettings {
  auth: PlanningCenterAuth;
  /** The church's newcomer workflow; each person gets a card in it. */
  workflowId?: string;
}

const BASE = 'https://api.planningcenteronline.com/people/v2';

interface JsonApiOne {
  data: { id: string; type: string };
}

export function planningCenter(settings: PlanningCenterSettings, fetcher: Fetcher = fetch): ChmsConnector {
  const authorization =
    settings.auth.kind === 'token' ? basicAuth(settings.auth.appId, settings.auth.secret) : `Bearer ${settings.auth.accessToken}`;

  const post = (path: string, type: string, attributes: Record<string, unknown>) =>
    requestJson<JsonApiOne>('planning_center', fetcher, `${BASE}${path}`, {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ data: { type, attributes } }),
    });

  return {
    system: 'planning_center',
    // Planning Center hosts in the United States, so the gate refuses it until that is decided.
    dataRegion: () => 'offshore',

    async createPerson(p: HandoffPacket) {
      const person = await post('/people', 'Person', { first_name: p.firstName, ...(p.lastName ? { last_name: p.lastName } : {}) });
      const id = person.data.id;
      if (p.email) await post(`/people/${id}/emails`, 'Email', { address: p.email, location: 'Home', primary: true });
      if (p.mobile) await post(`/people/${id}/phone_numbers`, 'PhoneNumber', { number: p.mobile, location: 'Mobile', primary: true });
      return id;
    },

    async createFollowUp(personId: string) {
      if (!settings.workflowId) return undefined;
      const card = await post(`/workflows/${encodeURIComponent(settings.workflowId)}/cards`, 'WorkflowCard', { person_id: personId });
      return card.data.id;
    },
  };
}

/** X-PCO-Webhooks-Authenticity is the hex HMAC-SHA256 of the raw body, keyed with the secret as text. */
export function verifyPlanningCenterWebhook(rawBody: string, header: string | null | undefined, secret: string): boolean {
  if (!header || !/^[0-9a-f]{64}$/i.test(header)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(header, 'hex'));
}

export interface PlanningCenterEvent {
  name: string;
  resourceType: string;
  resourceId: string;
  /** For workflow cards: the person the card is about, and whether it is complete. */
  personId?: string;
  completed?: boolean;
}

/** Reads an EventDelivery body into ids and flags only. Names, emails and notes are dropped here. */
export function parsePlanningCenterDeliveries(rawBody: string): PlanningCenterEvent[] {
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new IntegrationError('planning_center', 'bad_json');
  }
  const deliveries = (body as { data?: unknown }).data;
  if (!Array.isArray(deliveries)) throw new IntegrationError('planning_center', 'bad_delivery');
  const events: PlanningCenterEvent[] = [];
  for (const d of deliveries) {
    const name = d?.attributes?.name;
    const payloadText = d?.attributes?.payload;
    if (typeof name !== 'string' || typeof payloadText !== 'string') continue;
    let payload: any;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      continue;
    }
    const resource = payload?.data;
    if (typeof resource?.type !== 'string' || typeof resource?.id !== 'string') continue;
    const event: PlanningCenterEvent = { name, resourceType: resource.type, resourceId: resource.id };
    if (resource.type === 'WorkflowCard') {
      const personId = resource.relationships?.person?.data?.id;
      if (typeof personId === 'string') event.personId = personId;
      event.completed = Boolean(resource.attributes?.completed_at);
    }
    events.push(event);
  }
  return events;
}
