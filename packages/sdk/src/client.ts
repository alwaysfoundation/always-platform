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
  constructor(private opts: { baseUrl?: string; token?: string; org?: string; fetch?: typeof fetch } = {}) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const f = this.opts.fetch ?? fetch;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.opts.token) headers.authorization = `Bearer ${this.opts.token}`;
    if (this.opts.org) headers['x-always-org'] = this.opts.org;
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

  /** Open compliance data and the stateless check-up. No token needed for these. */
  compliance = {
    register: (version?: string) => this.req<ComplianceRegister>('GET', version ? `/v1/compliance/register/${encodeURIComponent(version)}` : '/v1/compliance/register'),
    versions: () => this.req<{ versions: { version: string; status: string; publishedAt: string; summary: string | null }[] }>('GET', '/v1/compliance/register/versions'),
    changes: () => this.req<{ versions: { version: string; publishedAt: string; summary: string | null; changes: { obligationId: string; title: string; change: 'added' | 'changed' | 'removed'; what: string[] }[] }[] }>('GET', '/v1/compliance/changes'),
    check: (profile: ComplianceProfile, answers: Record<string, 'yes' | 'no' | 'unsure' | 'not_applicable'> = {}) =>
      this.req<ComplianceAssessment>('POST', '/v1/compliance/check', { profile, answers }),
  };

  /** Signed webhooks, including compliance change alerts. The secret is returned once, on create. */
  webhooks = {
    list: () => this.req<{ endpoints: { id: string; url: string; events: string[]; active: boolean }[] }>('GET', '/v1/webhooks'),
    create: (url: string, events: string[]) => this.req<{ id: string; url: string; events: string[]; secret: string }>('POST', '/v1/webhooks', { url, events }),
    remove: (id: string) => this.req<{ ok: true }>('DELETE', `/v1/webhooks/${id}`),
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

export interface ComplianceProfile {
  states: AuState[];
  collectsPersonalInfo: boolean;
  turnoverOver3m: boolean;
  providesHealthService: boolean;
  usesOverseasServices: boolean;
  worksWithChildren: boolean;
  onlineServicesForChildren: boolean;
  sendsEmailOrSms: boolean;
  acncRegistered: boolean;
  basicReligiousCharity: boolean;
  acncMediumOrLarge: boolean;
}

export interface ComplianceRegister {
  version: string;
  status: 'draft' | 'reviewed';
  notice: string;
  profileQuestions: { id: keyof ComplianceProfile; type: 'states' | 'boolean'; label: string; help?: string }[];
  obligations: { id: string; area: string; title: string; summary: string; status: string }[];
}

export interface ComplianceAssessment {
  registerVersion: string;
  items: { obligationId: string; title: string; summary: string; strength: 'required' | 'recommended'; status: 'met' | 'attention' | 'check' | 'upcoming'; guidance: string }[];
  summary: { required: number; met: number; attention: number; check: number; upcoming: number };
  notice: string;
}
