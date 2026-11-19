import { basicAuth, IntegrationError, requestJson } from './http.js';
import type { ChmsConnector, DataRegion, Fetcher, HandoffPacket } from './types.js';

export interface ElvantoSettings {
  apiKey: string;
  /** The church's Elvanto address, e.g. gracechurch.elvanto.com.au. */
  accountDomain: string;
  /** People Category for new contacts, so they land on the church's follow-up list. */
  categoryId?: string;
  /** A group that starts the church's pathway, e.g. a newcomers' group. */
  pathwayGroupId?: string;
}

type ElvantoReply<T> = ({ status: 'ok' } & T) | { status: 'fail'; error?: { code?: number } };

const BASE = 'https://api.elvanto.com/v1';

/** Elvanto keeps Australian accounts on Australian servers; the .com.au address is how we tell them apart. */
export function elvantoRegion(accountDomain: string): DataRegion {
  return /^[a-z0-9-]+\.elvanto\.com\.au$/i.test(accountDomain.trim()) ? 'AU' : 'offshore';
}

export function elvanto(settings: ElvantoSettings, fetcher: Fetcher = fetch): ChmsConnector {
  const headers = { authorization: basicAuth(settings.apiKey, 'x'), 'content-type': 'application/json' };

  async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const reply = await requestJson<ElvantoReply<T>>('elvanto', fetcher, `${BASE}/${method}.json`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (reply.status !== 'ok') throw new IntegrationError('elvanto', `fail_${reply.error?.code ?? 'unknown'}`);
    return reply;
  }

  return {
    system: 'elvanto',
    dataRegion: () => elvantoRegion(settings.accountDomain),

    async createPerson(p: HandoffPacket) {
      const reply = await call<{ person: { id: string } }>('people/create', {
        firstname: p.firstName,
        // Elvanto requires a last name; many people give only a first name.
        lastname: p.lastName?.trim() || '-',
        ...(p.email ? { email: p.email } : {}),
        ...(p.mobile ? { mobile: p.mobile } : {}),
        ...(settings.categoryId ? { category_id: settings.categoryId } : {}),
      });
      return reply.person.id;
    },

    async addToPathway(personId: string) {
      if (!settings.pathwayGroupId) return undefined;
      await call('groups/addPerson', { group_id: settings.pathwayGroupId, person_id: personId });
      return settings.pathwayGroupId;
    },

    async createFollowUp() {
      return settings.categoryId;
    },
  };
}
