'use client';
/**
 * The demo account: a made-up church that runs entirely in this browser. Nothing is sent to Always.
 * Every person in it is invented. Changes last until the demo is closed.
 */
import type { Org } from './api';
import { EXAMPLES } from './examples';

const KEY = 'always.demo';

type State = {
  org: Org;
  team: { members: { id: string; email: string; role: string; you: boolean }[]; invites: { id: string; email: string; role: string }[] };
  inbox: Record<string, unknown>[];
  feedOptIn: boolean;
  page?: Partial<{ title: string; steps: string[]; showAlways: boolean }>;
};

const fresh = (): State => ({
  org: {
    id: 'demo-hope-church', name: 'Hope Church', kind: 'church', partner: true, role: 'admin', careTeam: false,
    modules: { respond: 'on', connect: 'on', safety: 'on' },
    brand: { primary: '#1F3A5F', accent: '#F2C14E', heading: 'modern', logo: null },
  },
  team: {
    members: [
      { id: 'u1', email: 'you@hopechurch.example', role: 'admin', you: true },
      { id: 'u2', email: 'sam@hopechurch.example', role: 'follow_up', you: false },
      { id: 'u3', email: 'priya@hopechurch.example', role: 'youth', you: false },
    ],
    invites: [{ id: 'i1', email: 'jordan@hopechurch.example', role: 'follow_up' }],
  },
  inbox: [
    { handoffId: 'h1', state: 'offered', offer: 'pending', suburb: 'Parramatta', ageBand: '25-34', step: 'church', language: 'en' },
    { handoffId: 'h2', state: 'accepted', offer: 'accepted', firstName: 'Alex (example)', suburb: 'Westmead', ageBand: '35-44', step: 'group',
      contact: { kind: 'mobile', value: '0400 000 000' }, note: 'Made-up person for the demo.' },
    { handoffId: 'h3', state: 'offered', offer: 'pending', suburb: 'Harris Park', ageBand: '18-24', step: 'explore', language: 'en' },
  ],
  feedOptIn: true,
});

export const isDemo = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
export function startDemo() { try { localStorage.setItem(KEY, JSON.stringify(fresh())); } catch { /* storage unavailable */ } }
/** The look someone tried in the demo, carried into real sign-up. The made-up name stays behind. */
export function demoLook() {
  try { const b = (JSON.parse(localStorage.getItem(KEY) ?? 'null') as State | null)?.org.brand; return b ? { primary: b.primary ?? undefined, accent: b.accent ?? undefined, heading: b.heading, logo: b.logo ?? null } : null; } catch { return null; }
}
export function endDemo() { try { localStorage.removeItem(KEY); } catch { /* fine */ } }

type Page = { title: string; steps: string[]; showAlways: boolean };
const pageOf = (s: State): Page => ({ title: `Next steps with ${s.org.name}`, steps: ['church', 'explore', 'talk', 'read'], showAlways: true, ...(s.page ?? {}) });
const load = (): State => { try { return JSON.parse(localStorage.getItem(KEY) ?? '') as State; } catch { return fresh(); } };
const save = (s: State) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* fine */ } };

/** Answers the app's API calls for the demo church. */
export async function demoApi(path: string, method: string, body: unknown): Promise<unknown> {
  const s = load();
  const b = (body ?? {}) as Record<string, unknown>;
  await new Promise((r) => setTimeout(r, 120));
  if (path === '/v1/account/orgs' && method === 'GET') return { orgs: [s.org] };
  if (path.endsWith('/modules') && method === 'PUT') {
    const on = new Set(b.modules as string[]);
    s.org.modules = Object.fromEntries((['respond', 'connect', 'safety'] as const).map((k) => [k, on.has(k) ? 'on' : 'off'])) as Org['modules'];
    save(s); return { modules: s.org.modules };
  }
  if (path.endsWith('/brand') && method === 'PUT') { s.org.brand = { ...s.org.brand, ...(b as Partial<Org['brand']>) }; save(s); return { brand: s.org.brand }; }
  if (path.endsWith('/team')) return s.team;
  if (path.endsWith('/invites') && method === 'POST') {
    s.team.invites.push({ id: `i${Date.now()}`, email: String(b.email), role: String(b.role) }); save(s); return { ok: true };
  }
  if (/\/invites\/[^/]+$/.test(path) && method === 'DELETE') { s.team.invites = s.team.invites.filter((i) => !path.endsWith(i.id)); save(s); return { ok: true }; }
  if (/\/members\/[^/]+$/.test(path) && method === 'DELETE') { s.team.members = s.team.members.filter((m) => m.you || !path.endsWith(m.id)); save(s); return { ok: true }; }
  if (/\/page$/.test(path) && method === 'PUT') { s.page = { ...pageOf(s), ...b }; save(s); return { ok: true }; }
  if (/\/page$/.test(path)) { const pg = pageOf(s); return { ...pg, slug: 'hope-church-demo', active: true, url: `${location.origin}/p/hope-church-demo` }; }
  if (path === '/v1/pages/hope-church-demo') return { slug: 'hope-church-demo', ministry: s.org.name, ...pageOf(s), look: s.org.brand };
  if (path === '/v1/pages/hope-church-demo/respond') return { ok: true };
  if (path === '/v1/inbox') return { items: s.inbox };
  if (path.startsWith('/v1/handoffs/')) {
    const [, , , id, action] = path.split('/');
    const item = s.inbox.find((i) => i.handoffId === id);
    if (item && action === 'accept') { item.offer = 'accepted'; item.state = 'accepted'; item.firstName = 'Taylor (example)'; item.contact = { kind: 'email', value: 'taylor@example.org' }; }
    if (item && action === 'pass') s.inbox = s.inbox.filter((i) => i !== item);
    if (item && action === 'contacted') item.state = 'contacted';
    save(s); return { ok: true };
  }
  if (path === '/v1/org/feed' && method === 'PUT') { s.feedOptIn = !!b.optIn; save(s); return { ok: true }; }
  if (path === '/v1/org/feed') {
    return { optedIn: s.feedOptIn, at: new Date().toISOString(), slug: 'hope-church-demo', welcomingNow: true, youthPartner: false,
      checks: { verified: true, trained: true, confirmedRecently: true, onTimeRate: 0.94, recentOffers: 12 } };
  }
  if (path.startsWith('/v1/org/report?')) return { ...(EXAMPLES.find((e) => e.slug === 'local-church') ?? EXAMPLES[0]!).report, organisation: s.org.name, example: true };
  if (path === '/v1/org/report-shares' && method === 'GET') return { items: [] };
  if (path === '/v1/org/report-shares') return { token: 'demo' };
  if (path.startsWith('/v1/org/report')) return { ok: true };
  return { items: [] };
}
