import type { AgeBand, ConsentInput } from './consent.js';

export type Step = 'church' | 'explore' | 'talk' | 'youth' | 'group' | 'help' | 'read';
export type AuState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';

export interface NewResponse {
  firstName?: string;
  contact: { kind: 'mobile' | 'email'; value: string };
  parentContact?: { kind: 'mobile' | 'email'; value: string };
  suburb: string;
  postcode: string;
  state: AuState;
  ageBand: AgeBand;
  step: Step;
  language?: string;
  note?: string;
  placementId?: string;
  campaignId?: string;
  consent: ConsentInput;
}

export class AlwaysError extends Error {
  constructor(public status: number, public code: string) {
    super(`${status} ${code}`);
  }
}

/**
 * The Always API client. Server-side only when you pass a secret token (alw_live_...).
 * Never ship a secret token to a browser or app bundle: use the widget with your own
 * backend endpoint, or a publishable placement key.
 */
export class AlwaysClient {
  constructor(private opts: { baseUrl?: string; token?: string; org?: string; appKey?: string; fetch?: typeof fetch } = {}) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const f = this.opts.fetch ?? fetch;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.opts.token) headers.authorization = `Bearer ${this.opts.token}`;
    if (this.opts.org) headers['x-always-org'] = this.opts.org;
    if (this.opts.appKey) headers['x-always-key'] = this.opts.appKey;
    const res = await f(`${this.opts.baseUrl ?? 'https://api.alwaysfoundation.org'}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const json = (await res.json().catch(() => ({}))) as any;
    if (!res.ok) throw new AlwaysError(res.status, json.error ?? 'request_failed');
    return json as T;
  }

  directory = {
    search: (q: { q?: string; state?: AuState; kind?: 'church' | 'ministry'; limit?: number; offset?: number } = {}) =>
      this.req<{ items: DirectoryItem[] }>('GET', `/v1/directory?${new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))}`),
    tally: () => this.req<{ total: number; byState: { state: AuState; kind: string; n: number }[] }>('GET', '/v1/directory/tally'),
    get: (slug: string) => this.req<ChurchPage>('GET', `/v1/orgs/${encodeURIComponent(slug)}`),
    claim: (orgId: string, b: { email: string; role: string; evidence?: string }) => this.req<{ status: 'pending' }>('POST', `/v1/orgs/${orgId}/claims`, b),
  };

  /** The church feed: facts about churches that opted in, never people. Safe to call from a browser. */
  feed = {
    churches: (q: FeedQuery = {}) => {
      const p = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v !== undefined) p.set(k, String(v));
      return this.req<{ items: FeedChurch[]; licence: string }>('GET', `/v1/feed/churches?${p}`);
    },
    /** Whether a church is verified and welcoming now. */
    verify: (slug: string) => this.req<Verification>('GET', `/v1/verify/${encodeURIComponent(slug)}`),
  };

  /** Evangelist API: Scripture with an evangelism layer. Approved content only unless `drafts` is set. */
  evangelist = {
    passages: (q: { theme?: string; q?: string; drafts?: boolean } = {}) =>
      this.req<{ items: EvangelistPassage[]; licence: string }>('GET', `/v1/evangelist/passages?${evQuery(q)}`),
    passage: (id: string, opts: { drafts?: boolean } = {}) =>
      this.req<EvangelistPassage & { objections: { id: string; question: string }[] }>('GET', `/v1/evangelist/passages/${encodeURIComponent(id)}?${evQuery(opts)}`),
    objections: (opts: { drafts?: boolean } = {}) =>
      this.req<{ items: { id: string; question: string; status: string }[] }>('GET', `/v1/evangelist/objections?${evQuery(opts)}`),
    objection: (id: string, opts: { drafts?: boolean } = {}) =>
      this.req<EvangelistObjection>('GET', `/v1/evangelist/objections/${encodeURIComponent(id)}?${evQuery(opts)}`),
    themes: (opts: { drafts?: boolean } = {}) => this.req<{ themes: { id: string; passages: number }[] }>('GET', `/v1/evangelist/themes?${evQuery(opts)}`),
  };

  responses = {
    create: (r: NewResponse) => this.req<{ responseId: string; handoffId: string; state: string }>('POST', '/v1/responses', r),
  };

  inbox = {
    list: () => this.req<{ items: InboxItem[] }>('GET', '/v1/inbox'),
  };

  handoffs = {
    accept: (id: string) => this.req<{ state: string }>('POST', `/v1/handoffs/${id}/accept`),
    pass: (id: string, reason: 'capacity' | 'language' | 'fit' | 'safeguarding' | 'other') => this.req<{ state: string }>('POST', `/v1/handoffs/${id}/pass`, { reason }),
    contacted: (id: string) => this.req<{ state: string }>('POST', `/v1/handoffs/${id}/contacted`),
    activity: (id: string, kind: 'call' | 'message' | 'text' | 'met' | 'note' | 'reply_received', note?: string) => this.req<{ ok: true }>('POST', `/v1/handoffs/${id}/activity`, { kind, note }),
  };

  profile = {
    get: () => this.req<Record<string, unknown>>('GET', '/v1/org/profile'),
    update: (p: Record<string, unknown>) => this.req<{ ok: true }>('PUT', '/v1/org/profile', p),
  };

  /** Person self-service, with the private link token from their text message. */
  person = {
    status: (token: string) => this.req<{ state: string; church: string | null }>('GET', `/v1/me/${token}`),
    withdraw: (token: string) => this.req<{ state: 'withdrawn' }>('POST', `/v1/me/${token}/withdraw`),
    connected: (token: string, companion?: boolean) => this.req<{ state: string }>('POST', `/v1/me/${token}/connected`, { companion }),
  };
}

export interface DirectoryItem {
  id: string;
  slug: string | null;
  kind: 'church' | 'ministry' | 'network';
  display_name: string;
  denomination: string | null;
  trust_level: 'listed' | 'claimed' | 'verified' | 'verified_youth';
  suburb: string | null;
  state: AuState | null;
  website: string | null;
}

export interface ChurchPage extends DirectoryItem {
  description: string | null;
  welcome_line: string | null;
  brand_colour: string | null;
  page_layout: Record<string, unknown>;
  offers: Step[];
}

export interface InboxItem {
  handoffId: string;
  state: string;
  offer: 'pending' | 'accepted';
  deadline: string;
  firstName: string | null;
  suburb: string;
  ageBand: AgeBand;
  step: Step;
  contact?: { kind: 'mobile' | 'email'; value: string };
  note?: string | null;
}

export interface FeedQuery {
  postcode?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  step?: Step;
  /** Only churches welcoming people this month. */
  welcoming?: boolean;
  /** Only verified youth partners. */
  youth?: boolean;
  state?: AuState;
  limit?: number;
}

export interface FeedChurch {
  slug: string;
  name: string;
  kind: 'church' | 'ministry' | 'network';
  denomination: string | null;
  suburb: string | null;
  state: AuState | null;
  postcode: string | null;
  location: { lat: number; lng: number } | null;
  steps: Step[];
  languages: string[];
  serviceTimes: string | null;
  welcomingNow: boolean;
  youthPartner: boolean;
  verified: boolean;
  distanceKm?: number;
  url: string;
  updatedAt: string | null;
}

export interface Verification {
  slug: string;
  name: string;
  verified: boolean;
  youthPartner: boolean;
  welcomingNow: boolean;
  verifiedAt: string | null;
}

export interface EvangelistPassage {
  id: string; ref: string; translation: string; text: string; themes: string[];
  explain: string; whenToShare: string; status: 'draft' | 'approved';
}
export interface EvangelistObjection {
  id: string; question: string; answer: string; tips: string[]; status: 'draft' | 'approved';
  passages: EvangelistPassage[];
}
function evQuery(q: { theme?: string; q?: string; drafts?: boolean }): string {
  const p = new URLSearchParams();
  if (q.theme) p.set('theme', q.theme);
  if (q.q) p.set('q', q.q);
  if (q.drafts) p.set('drafts', '1');
  return p.toString();
}
