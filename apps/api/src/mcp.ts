import type { Hono } from 'hono';
import type { Env } from './auth.js';

/**
 * The Always MCP server, version 1 (RFC 0001, part 3). Stateless, over Streamable HTTP at POST /mcp.
 *
 * Read-only and holds no personal data: every tool reads the same public endpoints a website can.
 * Nothing here can see a response, a person, an inbox, or any young person's information,
 * and nothing here can act. Later versions that help a team with adults who agreed to AI help
 * will need sign-in, the `ai.assist` consent purpose, and a person approving every action.
 */
const PROTOCOL = '2025-06-18';
const STEPS = ['church', 'explore', 'talk', 'youth', 'group', 'help', 'read'];

const TOOLS = [
  {
    name: 'find_churches',
    title: 'Find churches near a postcode',
    description: 'Find churches and ministries in Australia from the Always church feed, nearest first. Only churches that chose to be in the feed appear. Use welcoming=true for churches ready to welcome people this month, and youth=true for verified youth partners. Returns facts about churches only, never about people.',
    inputSchema: {
      type: 'object',
      properties: {
        postcode: { type: 'string', pattern: '^\\d{4}$', description: 'Australian postcode, like 2150' },
        step: { type: 'string', enum: STEPS, description: 'A next step the church offers' },
        welcoming: { type: 'boolean', description: 'Only churches welcoming people now' },
        youth: { type: 'boolean', description: 'Only verified youth partners' },
        radiusKm: { type: 'number', minimum: 1, maximum: 200 },
        limit: { type: 'number', minimum: 1, maximum: 25 },
      },
      required: ['postcode'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'verify_church',
    title: 'Check whether a church is verified',
    description: 'Check whether a church on Always is verified with its denomination or network, whether it is a verified youth partner, and whether it is welcoming people now. Takes the church slug from find_churches.',
    inputSchema: { type: 'object', properties: { slug: { type: 'string' } }, required: ['slug'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_events',
    title: 'List upcoming Christian events',
    description: 'Upcoming Christian events in Australia listed on Always: worship nights, outreach, youth camps, courses and training.',
    inputSchema: { type: 'object', properties: { state: { type: 'string', enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] }, limit: { type: 'number', minimum: 1, maximum: 50 } } },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'safety_obligations',
    title: 'List Always Safety obligations',
    description: 'List the safety obligations in the open Always Safety register for a country or region (AU, US, CA, GB, EU, NZ), optionally for one area. Each comes with its official source. The register is a draft; it is a guide to common obligations, not legal advice.',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string', enum: ['AU', 'US', 'CA', 'GB', 'EU', 'NZ'] },
        area: { type: 'string', enum: ['privacy', 'child_safety', 'charity', 'messages'] },
      },
      required: ['country'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'safety_check',
    title: 'Run the Always Safety check-up',
    description: 'Run the stateless Always Safety check-up for a ministry from organisation facts only (never anyone\'s personal details). Nothing is stored. Returns which obligations apply and what to look at first. Not legal advice.',
    inputSchema: {
      type: 'object',
      properties: {
        countries: { type: 'array', items: { type: 'string', enum: ['AU', 'US', 'CA', 'GB', 'EU', 'NZ'] }, minItems: 1 },
        states: { type: 'array', items: { type: 'string', enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] }, description: 'Australian states, when Australia is chosen' },
        collectsPersonalInfo: { type: 'boolean' },
        providesHealthService: { type: 'boolean' },
        usesOverseasServices: { type: 'boolean' },
        worksWithChildren: { type: 'boolean' },
        onlineServicesForChildren: { type: 'boolean' },
        sendsEmailOrSms: { type: 'boolean' },
        registeredCharity: { type: 'boolean' },
        isChurch: { type: 'boolean' },
      },
      required: ['countries', 'collectsPersonalInfo', 'providesHealthService', 'usesOverseasServices', 'worksWithChildren', 'onlineServicesForChildren', 'sendsEmailOrSms'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'how_always_works',
    title: 'How Always works',
    description: 'A short guide to how Always connects someone who says yes to Jesus with a next step, the consent and age rules, and how developers can build on it. Use before explaining Always to someone.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

const GUIDE = `Always is a free, open-source network run by the Always Foundation in Australia.
When someone says yes to Jesus at church, a camp, an event or online, they choose what would help next
(a church, a course, someone to talk to, a youth group, reading the Bible). With their permission, Always
introduces them to one partner church or ministry nearby. The church accepts or passes; if it passes, the
next church nearby is asked. If no one can help, the Always care team does. A real person gets in touch.

Rules that never change: nothing is shared without the person's permission; their details stay in Australia
and go only to the church that welcomes them; under 15s need a parent or guardian and give their own agreement;
young people only meet verified youth partners; no AI ever touches a young person's information.

Always Safety is the shared source of truth for ministry safety rules: an open register of obligations for
Australia, the United States, Canada, the United Kingdom, the European Union and New Zealand (a draft, with
official sources), a stateless check-up and guardrails. It is not legal advice; each ministry remains responsible
for its own legal advice and decisions. Use safety_obligations and safety_check.

Builders: the church feed and verification are open (https://api.alwaysfoundation.org/v1/feed/churches,
/v1/verify/{slug}). Sending a person to a church uses the Handoff API with consent and needs a member key.
The SDK is in the open-source repository (github.com/alwaysfoundation/always-platform). It is free and open
source: check it with your own developers and lawyers, and report bugs to security@alwaysfoundation.org
(security issues) or as GitHub issues. Docs: https://alwaysfoundation.org/#/docs`;

type RpcReq = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: any };

export function mountMcp(app: Hono<Env>) {
  const get = async (path: string) => {
    const res = await app.request(path);
    return { ok: res.ok, status: res.status, body: (await res.json().catch(() => ({}))) as any };
  };

  const NOTICE = 'A guide to common obligations, not legal advice. The register is a draft.';
  const COUNTRY_CODES = ['AU', 'US', 'CA', 'GB', 'EU', 'NZ'];

  async function callTool(name: string, args: any): Promise<{ text: string; structured?: unknown; isError?: boolean }> {
    if (name === 'how_always_works') return { text: GUIDE };
    if (name === 'safety_obligations') {
      const country = String(args?.country ?? '');
      if (!COUNTRY_CODES.includes(country)) return { text: `Please choose one of ${COUNTRY_CODES.join(', ')}.`, isError: true };
      const r = await get('/v1/safety/register');
      if (!r.ok) return { text: `The register returned ${r.status}.`, isError: true };
      const items = ((r.body.obligations ?? []) as any[])
        .filter((o) => (o.country ?? 'AU') === country && (!args?.area || o.area === args.area))
        .map((o) => ({ id: o.id, area: o.area, title: o.title, summary: o.summary, status: o.status, sources: (o.law ?? []).map((l: any) => ({ name: l.name, url: l.url })) }));
      const text = items.length ? items.map((o) => `- ${o.title}${o.status === 'watch' ? ' (watching)' : ''}: ${o.summary} Source: ${o.sources.map((x: any) => x.name).join('; ')}`).join('\n') + `\n\n${NOTICE}` : 'No obligations for that selection yet.';
      return { text, structured: { registerVersion: r.body.version, items, notice: NOTICE } };
    }
    if (name === 'safety_check') {
      const res = await app.request('/v1/safety/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: args ?? {} }) });
      if (!res.ok) return { text: 'Those answers could not be checked. Every yes/no question needs an answer, and Australia needs at least one state.', isError: true };
      const a = (await res.json()) as any;
      const todo = (a.items as any[]).filter((i) => i.status !== 'met');
      const text = `${a.summary.required} required obligations apply. To look at first:\n${todo.slice(0, 10).map((i) => `- ${i.title}: ${i.guidance}`).join('\n')}\n\n${NOTICE}`;
      return { text, structured: a };
    }
    if (name === 'find_churches') {
      if (!/^\d{4}$/.test(String(args?.postcode ?? ''))) return { text: 'Please give a four-digit Australian postcode.', isError: true };
      const q = new URLSearchParams({ postcode: String(args.postcode), limit: String(Math.min(Number(args.limit ?? 10), 25)) });
      if (args.step && STEPS.includes(args.step)) q.set('step', args.step);
      if (args.welcoming) q.set('welcoming', 'true');
      if (args.youth) q.set('youth', 'true');
      if (args.radiusKm) q.set('radiusKm', String(args.radiusKm));
      const r = await get(`/v1/feed/churches?${q}`);
      if (!r.ok) return { text: `The church feed returned ${r.status}.`, isError: true };
      const items = r.body.items as any[];
      const text = items.length
        ? items.map((c) => `- ${c.name} (${[c.suburb, c.denomination, c.distanceKm != null ? `${c.distanceKm} km` : null].filter(Boolean).join(', ')})${c.welcomingNow ? ', welcoming now' : ''}${c.youthPartner ? ', youth partner' : ''}. ${c.url}`).join('\n')
        : 'No churches in the Always feed near that postcode yet.';
      return { text, structured: { items } };
    }
    if (name === 'verify_church') {
      const r = await get(`/v1/verify/${encodeURIComponent(String(args?.slug ?? ''))}`);
      if (r.status === 404) return { text: 'No church with that slug on Always.', isError: true };
      const v = r.body;
      return { text: `${v.name}: ${v.verified ? 'verified' : 'not yet verified'}${v.youthPartner ? ', verified youth partner' : ''}${v.welcomingNow ? ', welcoming now' : ''}.`, structured: v };
    }
    if (name === 'list_events') {
      const q = new URLSearchParams({ limit: String(Math.min(Number(args?.limit ?? 10), 50)) });
      if (args?.state) q.set('state', args.state);
      const r = await get(`/v1/events?${q}`);
      const items = (r.body.items ?? []) as any[];
      return { text: items.length ? items.map((e) => `- ${e.title}, ${new Date(e.starts_at).toISOString().slice(0, 10)}${e.suburb ? `, ${e.suburb}` : ''}${e.url ? ` ${e.url}` : ''}`).join('\n') : 'No upcoming events listed.', structured: { items } };
    }
    return { text: `Unknown tool: ${name}`, isError: true };
  }

  async function handle(m: RpcReq) {
    const reply = (result: unknown) => ({ jsonrpc: '2.0', id: m.id ?? null, result });
    const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id: m.id ?? null, error: { code, message } });
    switch (m.method) {
      case 'initialize':
        return reply({
          protocolVersion: PROTOCOL,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'always', title: 'Always', version: '1.0.0' },
          instructions: 'Read-only tools for the Always network: find partner churches near an Australian postcode, see which are partner churches, list events, and use Always Safety (the open register of ministry safety obligations and a stateless check-up). No personal data is available here. Always Safety is not legal advice.',
        });
      case 'ping':
        return reply({});
      case 'tools/list':
        return reply({ tools: TOOLS });
      case 'tools/call': {
        const out = await callTool(m.params?.name, m.params?.arguments ?? {});
        return reply({ content: [{ type: 'text', text: out.text }], ...(out.structured ? { structuredContent: out.structured } : {}), isError: !!out.isError });
      }
      default:
        return fail(-32601, 'Method not found');
    }
  }

  app.post('/mcp', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body) return c.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
    const msgs: RpcReq[] = Array.isArray(body) ? body : [body];
    if (msgs.length > 20) return c.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Too many requests in one batch' } }, 400);
    const out = [];
    for (const m of msgs) if (m.id !== undefined && m.id !== null) out.push(await handle(m));
    if (!out.length) return c.body(null, 202); // notifications only
    return c.json(Array.isArray(body) ? out : out[0]);
  });
  app.get('/llms.txt', (c) => c.text(`# Always API

> Open infrastructure from the Always Foundation for evangelists, churches and ministries: find partner churches, see which are partner churches, list events, and hand someone a next step with their consent.

## Open, no personal data
- [Church feed](https://api.alwaysfoundation.org/v1/feed/churches?postcode=2150): churches near a postcode; filters welcoming, youth, step
- [Whole feed, JSON Lines](https://api.alwaysfoundation.org/v1/feed/churches.jsonl)
- [Verify a church](https://api.alwaysfoundation.org/v1/verify/{slug})
- [Events](https://api.alwaysfoundation.org/v1/events)
- [MCP server](https://api.alwaysfoundation.org/mcp): read-only tools find_churches, verify_church, list_events, safety_obligations, safety_check, how_always_works
- [Always Safety register](https://api.alwaysfoundation.org/v1/safety/register): open register of ministry safety obligations for AU, US, CA, GB, EU and NZ (draft; not legal advice)
- [Always Safety check-up](https://api.alwaysfoundation.org/v1/safety/check): POST organisation facts; nothing is stored

## Members only, with consent
- Handoff API (POST /v1/responses): send a person who said yes to a church, with their consent receipt
- Church inbox, reports and webhooks

## Rules
${GUIDE}

## More
- [OpenAPI](https://github.com/alwaysfoundation/always-platform/blob/main/api/openapi.yaml)
- [SDK](https://www.npmjs.com/package/@always/sdk)
`));
  app.get('/mcp', (c) => c.json({ error: 'Use POST for MCP requests.' }, 405));
}
